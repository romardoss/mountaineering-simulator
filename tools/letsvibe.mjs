#!/usr/bin/env node
// letsvibe: playtest with your voice.
//   1. starts the game (Vite dev server) and opens it in the browser,
//   2. records the microphone while you play,
//   3. on Enter / q in this terminal: stops, transcribes the recording (OpenRouter STT)
//      and asks an OpenRouter LLM to turn the notes into a change-request prompt
//      for the coding agent. The prompt always starts with the "update the specification" line
//      and ends with a request to ask about anything unclear before changing code.
//
// Usage:  npm run letsvibe [-- --no-game] [-- --from .letsvibe/<session>]
// Needs:  ffmpeg, OPENROUTER_API_KEY (env, .env or .env.local).
// Env:    LETSVIBE_STT_MODEL (default openai/whisper-large-v3), LETSVIBE_LLM_MODEL (default anthropic/claude-sonnet-5.5),
//         LETSVIBE_LANGUAGE (ISO-639-1, default auto), LETSVIBE_AUDIO_INPUT (ffmpeg input args, default per OS).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://openrouter.ai/api/v1";
const CHUNK_S = 240; // keeps each STT request well under the 60 s upstream timeout
// Always appended after the change list, so unclear voice notes are resolved before any edit.
const CLARIFY_LINE =
  "Before making any changes: if anything in this prompt is not clear from the audio (especially items marked \"unclear in recording\"), ask me about it first and wait for my answer.";
const SPEC_LINE =
  "1. Update the specifications (`specification.md`: affected sections + a new CR row in §27; `PRD.md` and `docs/DECISIONS.md` where product behaviour or interpretations change) based on the instructions below, then implement them and keep tests, locales and docs consistent.";

// ---------------------------------------------------------------- setup

loadEnvFiles([".env", ".env.local"]);
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const KEY = process.env.OPENROUTER_API_KEY;
const STT_MODEL = process.env.LETSVIBE_STT_MODEL || "openai/whisper-large-v3";
const LLM_MODEL = process.env.LETSVIBE_LLM_MODEL || "anthropic/claude-sonnet-5.5";
const LANGUAGE = process.env.LETSVIBE_LANGUAGE || undefined;

function loadEnvFiles(files) {
  for (const f of files) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function die(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

function has(cmd) {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}

const isWsl = process.platform === "linux" && /microsoft/i.test(readFileSync("/proc/version", "utf8"));

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

// ---------------------------------------------------------------- game

function startGame() {
  return new Promise((ok, fail) => {
    const vite = spawn(join(ROOT, "node_modules", ".bin", "vite"), ["--clearScreen", "false"], { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const onData = (d) => {
      out += d.toString();
      // eslint-disable-next-line no-control-regex -- strip ANSI colours from the vite banner
      const m = out.replace(/\x1b\[[0-9;]*m/g, "").match(/Local:\s+(http:\/\/\S+)/);
      if (m) {
        vite.stdout.off("data", onData);
        ok({ vite, url: m[1] });
      }
    };
    vite.stdout.on("data", onData);
    vite.stderr.on("data", (d) => (out += d.toString()));
    vite.on("exit", (code) => fail(new Error(`vite exited (${code}):\n${out}`)));
  });
}

function openBrowser(url) {
  if (isWsl) spawn("cmd.exe", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
  else if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  else if (has("xdg-open")) spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function stopGame(vite) {
  try {
    process.kill(-vite.pid, "SIGTERM"); // the whole process group (vite + esbuild)
  } catch {
    /* already gone */
  }
}

// ---------------------------------------------------------------- recording

function audioInput() {
  if (process.env.LETSVIBE_AUDIO_INPUT) return process.env.LETSVIBE_AUDIO_INPUT.split(/\s+/);
  if (process.platform === "darwin") return ["-f", "avfoundation", "-i", ":0"];
  return ["-f", "pulse", "-i", "default"]; // Linux desktops and WSLg
}

function startRecording(dir) {
  const ff = spawn(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", ...audioInput(), "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "-f", "segment", "-segment_time", String(CHUNK_S), "-reset_timestamps", "1", join(dir, "chunk_%03d.mp3")],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let err = "";
  ff.stderr.on("data", (d) => (err += d.toString()));
  const done = new Promise((ok) => ff.on("exit", (code) => ok({ code, err })));
  return { ff, done };
}

async function stopRecording(rec) {
  rec.ff.stdin.write("q"); // graceful: ffmpeg finalises the last chunk
  const timer = setTimeout(() => rec.ff.kill("SIGINT"), 5000);
  const r = await rec.done;
  clearTimeout(timer);
  return r;
}

/** Resolves "stop" on Enter / q, "abort" on Ctrl+C. Shows the elapsed time. */
function waitForStop() {
  return new Promise((ok) => {
    const t0 = Date.now();
    const tick = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      process.stdout.write(`\r● REC ${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}  — Enter / q: finish and summarise · Ctrl+C: abort `);
    }, 500);
    const finish = (how) => {
      clearInterval(tick);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      ok(how);
    };
    process.on("SIGINT", () => finish("abort"));
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (b) => {
      const k = b.toString();
      if (k === "\u0003") finish("abort");
      else if (k === "\r" || k === "\n" || k.toLowerCase() === "q") finish("stop");
    });
  });
}

// ---------------------------------------------------------------- OpenRouter

async function openrouter(path, body, attempts = 3) {
  for (let i = 1; ; i++) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "X-Title": "letsvibe" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if (i >= attempts || (res.status < 500 && res.status !== 429)) throw new Error(`${path} → HTTP ${res.status}: ${text.slice(0, 500)}`);
    await new Promise((r) => setTimeout(r, 2000 * i));
  }
}

async function transcribe(dir) {
  const chunks = readdirSync(dir).filter((f) => /^chunk_\d+\.mp3$/.test(f)).sort();
  const parts = [];
  for (const [i, f] of chunks.entries()) {
    const audio = readFileSync(join(dir, f));
    if (audio.length < 2000) continue; // empty tail chunk
    process.stdout.write(`  transcribing ${i + 1}/${chunks.length}…\r`);
    const r = await openrouter("/audio/transcriptions", { model: STT_MODEL, input_audio: { data: audio.toString("base64"), format: "mp3" }, ...(LANGUAGE ? { language: LANGUAGE } : {}) });
    if (r.text?.trim()) parts.push(r.text.trim());
  }
  process.stdout.write("\n");
  return parts.join("\n\n");
}

/** Compact project context: the change log, so the LLM knows what already exists. */
function projectContext() {
  try {
    const spec = readFileSync(join(ROOT, "specification.md"), "utf8");
    const headings = spec.split("\n").filter((l) => /^##\s/.test(l)).join("\n");
    const log = spec.slice(spec.indexOf("## 27. Change log"));
    return `Specification sections:\n${headings}\n\n${log}`;
  } catch {
    return "";
  }
}

async function summarise(transcript) {
  const system = `You turn a game designer's spoken playtest notes into a change request for an AI coding agent (Claude Code) that maintains this repository.
The game: «Закріпи! Готово! Рух!», a turn-based pixel-art training game about mountain-tourism rope technique (hill obstacle, team, equipment, knots, belay, commands). TypeScript engine + Preact UI + Phaser view; specification.md drives implementation.

Rules:
1. Output ONLY the change list, no preamble and no closing remarks. Write in English; keep Ukrainian in-game terms and UI texts exactly as spoken (in Ukrainian).
2. A numbered list, continuing from item 2 (item 1 is added automatically: "update the specifications"). One item per distinct change, concrete and testable: what to change, where in the game (screen / action / rule / data), and the expected behaviour.
3. Merge repeated or corrected remarks into one item; when the speaker changes their mind, keep only the final intent.
4. Drop chit-chat, thinking aloud and observations that ask for no change. Bugs are changes too: describe the observed behaviour and the expected one.
5. Do not invent requirements. If something is ambiguous, keep it and append "(unclear in recording: …)" with the open question.
6. Speech recognition errors are likely (mixed Ukrainian/English, climbing terms): interpret them sensibly.`;
  const user = `${projectContext()}\n\n---\nTranscript of the playtest recording:\n\n${transcript}`;
  const r = await openrouter("/chat/completions", { model: LLM_MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.2 });
  const body = (r.choices?.[0]?.message?.content ?? "").trim();
  if (!body) throw new Error(`empty LLM answer: ${JSON.stringify(r).slice(0, 300)}`);
  // drop a spec line the model may have added anyway; ours is always item 1
  const rest = body.replace(/^\s*1\.\s.*specification.*\n+/i, "");
  return `${SPEC_LINE}\n${rest.trimEnd()}\n\n${CLARIFY_LINE}\n`;
}

function copyToClipboard(text) {
  try {
    if (isWsl) return spawnSync("clip.exe", { input: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]) }).status === 0;
    if (process.platform === "darwin") return spawnSync("pbcopy", { input: text }).status === 0;
    if (has("wl-copy")) return spawnSync("wl-copy", { input: text }).status === 0;
    if (has("xclip")) return spawnSync("xclip", ["-selection", "clipboard"], { input: text }).status === 0;
  } catch {
    /* no clipboard */
  }
  return false;
}

// ---------------------------------------------------------------- main

async function processSession(dir) {
  console.log(`\n▶ Transcribing with ${STT_MODEL}`);
  const transcript = await transcribe(dir);
  writeFileSync(join(dir, "transcript.txt"), transcript + "\n");
  if (!transcript.trim()) die(`nothing was recognised in the recording (${dir}).`);
  console.log(`▶ Summarising with ${LLM_MODEL}`);
  const prompt = await summarise(transcript);
  writeFileSync(join(dir, "prompt.md"), prompt);
  console.log(`\n${"─".repeat(72)}\n${prompt}${"─".repeat(72)}`);
  console.log(`Saved: ${join(dir, "transcript.txt")}\n       ${join(dir, "prompt.md")}`);
  if (copyToClipboard(prompt)) console.log("Copied the prompt to the clipboard.");
}

async function main() {
  if (!KEY) die("OPENROUTER_API_KEY is not set (export it, or put OPENROUTER_API_KEY=... into .env.local).");
  const from = option("--from");
  if (from) {
    if (!existsSync(from)) die(`no such session: ${from}`);
    return processSession(resolve(from));
  }
  if (!has("ffmpeg")) die("ffmpeg is required for recording (sudo apt install ffmpeg).");

  const dir = join(ROOT, ".letsvibe", stamp());
  mkdirSync(dir, { recursive: true });

  let game = null;
  if (!flag("--no-game")) {
    console.log("▶ Starting the game…");
    game = await startGame().catch((e) => die(e.message));
    console.log(`  ${game.url}`);
    openBrowser(game.url);
  }

  const rec = startRecording(dir);
  const early = await Promise.race([rec.done, new Promise((r) => setTimeout(() => r(null), 1500))]);
  if (early) {
    if (game) stopGame(game.vite);
    die(`recording failed to start:\n${early.err || `ffmpeg exited with ${early.code}`}\nSet LETSVIBE_AUDIO_INPUT, e.g. "-f alsa -i default".`);
  }
  console.log(`▶ Recording to ${dir}`);

  const how = await waitForStop();
  const r = await stopRecording(rec);
  if (game) stopGame(game.vite);
  if (r.code && r.code !== 255 && r.err) console.warn(`ffmpeg: ${r.err.trim()}`);
  if (how === "abort") {
    console.log(`Aborted. The audio is kept in ${dir}; process it later with: npm run letsvibe -- --from ${dir}`);
    process.exit(0);
  }
  try {
    await processSession(dir);
  } catch (e) {
    die(`${e.message}\nThe audio is kept; retry with: npm run letsvibe -- --from ${dir}`);
  }
  process.exit(0);
}

main();
