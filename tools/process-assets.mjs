// Asset post-processing (docs/ASSET_PROMPTS.md §4): assets/raw/**/*.jpg → assets/<group>/<id>.png + assets/manifest.json.
// Usage: npm run assets [-- --contact <dir>]
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "assets/raw");
const OUT = path.join(ROOT, "assets");

const CELL = 32; // team sheet cell size (deviation from 16×32: lying/falling poses are wide)
const STANDING_HEIGHT = 30; // target height of a standing figure in px
const ROWS = 7;

// ---------- image helpers ----------

async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, px: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

function newImage(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}

async function savePng(img, file) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(img.px), { raw: { width: img.w, height: img.h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

// ---------- chroma key ----------

function isChroma(r, g, b) {
  return g > 200 && r < 100 && b < 100 && g > 2.2 * Math.max(r, b) + 40;
}

/** Returns a Uint8Array mask: 1 = opaque sprite pixel, 0 = background. Despills the halo. */
function chromaMask(img) {
  const { w, h, px } = img;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = isChroma(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) ? 0 : 1;
  // Despill: two passes removing green-dominant pixels next to background.
  for (let pass = 0; pass < 3; pass++) {
    const rm = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!m[i]) continue;
        const nearBg = (x > 0 && !m[i - 1]) || (x < w - 1 && !m[i + 1]) || (y > 0 && !m[i - w]) || (y < h - 1 && !m[i + w]);
        if (!nearBg) continue;
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
        if (g > 2.5 * Math.max(r, b) + 30) rm.push(i);
      }
    for (const i of rm) m[i] = 0;
  }
  // Clamp remaining green spill on the border.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      const nearBg = (x > 0 && !m[i - 1]) || (x < w - 1 && !m[i + 1]) || (y > 0 && !m[i - w]) || (y < h - 1 && !m[i + w]);
      if (!nearBg) continue;
      const r = px[i * 4], b = px[i * 4 + 2];
      const mx = Math.max(r, b);
      if (px[i * 4 + 1] > 1.8 * mx + 30) px[i * 4 + 1] = Math.round(1.8 * mx + 30);
    }
  return m;
}

// ---------- connected components ----------

function components(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = comps.length;
    let sp = 0;
    stack[sp++] = s;
    label[s] = id;
    let area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, sx = 0, sy = 0;
    while (sp) {
      const i = stack[--sp];
      const x = i % w, y = (i / w) | 0;
      area++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && mask[i - 1] && label[i - 1] < 0) { label[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && label[i + 1] < 0) { label[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && mask[i - w] && label[i - w] < 0) { label[i - w] = id; stack[sp++] = i - w; }
      if (y < h - 1 && mask[i + w] && label[i + w] < 0) { label[i + w] = id; stack[sp++] = i + w; }
    }
    comps.push({ id, area, x0, y0, x1, y1, cx: sx / area, cy: sy / area });
  }
  return { label, comps };
}

/** Removes components smaller than minArea from the mask (in place). */
function despeckle(mask, w, h, minArea) {
  const { label, comps } = components(mask, w, h);
  for (let i = 0; i < w * h; i++) if (mask[i] && comps[label[i]].area < minArea) mask[i] = 0;
}

/** Box erosion with radius r using an integral image. */
function erode(mask, w, h, r) {
  const W = w + 1;
  const ii = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += mask[y * w + x];
      ii[(y + 1) * W + x + 1] = ii[y * W + x + 1] + row;
    }
  }
  const out = new Uint8Array(w * h);
  const full = (2 * r + 1) ** 2;
  for (let y = r; y < h - r; y++)
    for (let x = r; x < w - r; x++) {
      const a = (y - r) * W + (x - r), b = (y - r) * W + (x + r + 1), c = (y + r + 1) * W + (x - r), d = (y + r + 1) * W + (x + r + 1);
      if (ii[d] - ii[b] - ii[c] + ii[a] === full) out[y * w + x] = 1;
    }
  return out;
}

// ---------- block downsampling ----------

/**
 * Colour of a source block: transparent if fewer than half the pixels are opaque, otherwise the
 * average of the most common 4-bit-quantised colour bin (removes JPEG noise, keeps hard edges).
 * `inside(x, y)` optionally restricts which source pixels count as part of the sprite.
 */
const bins = new Int32Array(4096);
const binR = new Float64Array(4096), binG = new Float64Array(4096), binB = new Float64Array(4096);
function blockColor(img, mask, sx0, sy0, sx1, sy1, inside, opaqueOnly = false) {
  const { w, h, px } = img;
  const xa = Math.max(0, Math.floor(sx0)), xb = Math.min(w, Math.ceil(sx1));
  const ya = Math.max(0, Math.floor(sy0)), yb = Math.min(h, Math.ceil(sy1));
  const total = Math.max(1, (Math.ceil(sx1) - Math.floor(sx0)) * (Math.ceil(sy1) - Math.floor(sy0)));
  const used = [];
  let opaque = 0;
  for (let y = ya; y < yb; y++)
    for (let x = xa; x < xb; x++) {
      const i = y * w + x;
      if (mask && !mask[i]) continue;
      if (inside && !inside(x, y)) continue;
      opaque++;
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      if (bins[k] === 0) used.push(k);
      bins[k]++; binR[k] += r; binG[k] += g; binB[k] += b;
    }
  let best = -1, bestN = 0;
  for (const k of used) if (bins[k] > bestN) { bestN = bins[k]; best = k; }
  const res = opaque === 0 || (!opaqueOnly && opaque * 2 < total)
    ? null
    : [Math.round(binR[best] / bestN), Math.round(binG[best] / bestN), Math.round(binB[best] / bestN)];
  for (const k of used) { bins[k] = 0; binR[k] = 0; binG[k] = 0; binB[k] = 0; }
  return res;
}

/** Downsample a rectangular source region to an opaque/transparent target of tw×th. */
function downsample(img, mask, sx, sy, sw, sh, tw, th, opaqueOnly = false) {
  const out = newImage(tw, th);
  const bx = sw / tw, by = sh / th;
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const c = blockColor(img, mask, sx + x * bx, sy + y * by, sx + (x + 1) * bx, sy + (y + 1) * by, null, opaqueOnly);
      if (c) setPx(out, x, y, c);
    }
  return out;
}

function setPx(img, x, y, c) {
  const i = (y * img.w + x) * 4;
  img.px[i] = c[0]; img.px[i + 1] = c[1]; img.px[i + 2] = c[2]; img.px[i + 3] = 255;
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      if (!src.px[si + 3]) continue;
      const X = dx + x, Y = dy + y;
      if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
      dst.px.set(src.px.subarray(si, si + 4), (Y * dst.w + X) * 4);
    }
}

function crop(img, x, y, w, h) {
  const out = newImage(w, h);
  for (let j = 0; j < h; j++) out.px.set(img.px.subarray(((y + j) * img.w + x) * 4, ((y + j) * img.w + x + w) * 4), j * w * 4);
  return out;
}

// ---------- team sheets ----------

/** Splits sorted values into k groups at the k−1 largest gaps. */
function splitByGaps(items, key, k) {
  const s = [...items].sort((a, b) => key(a) - key(b));
  const gaps = s.slice(1).map((it, i) => ({ i: i + 1, g: key(it) - key(s[i]) }));
  const cuts = gaps.sort((a, b) => b.g - a.g).slice(0, k - 1).map((g) => g.i).sort((a, b) => a - b);
  const groups = [];
  let prev = 0;
  for (const c of [...cuts, s.length]) { groups.push(s.slice(prev, c)); prev = c; }
  return groups;
}

/** Detects the figure grid of a team sheet: rows of frames with core bboxes and slice bounds. */
function detectTeamGrid(img, mask) {
  const { w, h } = img;
  const r = Math.max(4, Math.round(w / 220));
  const core = erode(mask, w, h, r);
  let { comps } = components(core, w, h);
  const maxA = Math.max(...comps.map((c) => c.area));
  comps = comps.filter((c) => c.area > maxA * 0.04);
  const rows = splitByGaps(comps, (c) => c.cy, ROWS).map((row) => {
    // Merge cores that overlap horizontally (pieces of one figure).
    const sorted = [...row].sort((a, b) => a.x0 - b.x0);
    const frames = [];
    for (const c of sorted) {
      const last = frames[frames.length - 1];
      if (last && c.x0 <= last.x1 + r * 2) {
        last.x1 = Math.max(last.x1, c.x1); last.y0 = Math.min(last.y0, c.y0); last.y1 = Math.max(last.y1, c.y1);
        last.parts.push(c);
      } else frames.push({ x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, parts: [c] });
    }
    // Drop tiny leftovers (pain lines, dust) that survived erosion.
    const maxPart = Math.max(...frames.map((f) => f.parts.reduce((s, p) => s + p.area, 0)));
    return frames.filter((f) => f.parts.reduce((s, p) => s + p.area, 0) > maxPart * 0.2);
  });
  // Row bands: midpoints between neighbouring rows' core extents.
  const ext = rows.map((fr) => ({ top: Math.min(...fr.map((f) => f.y0)), bot: Math.max(...fr.map((f) => f.y1)) }));
  return rows.map((frames, ri) => {
    const top = ri === 0 ? 0 : Math.round((ext[ri - 1].bot + ext[ri].top) / 2);
    const bot = ri === rows.length - 1 ? h : Math.round((ext[ri].bot + ext[ri + 1].top) / 2);
    const fr = frames.map((f, fi) => {
      const left = fi === 0 ? 0 : Math.round((frames[fi - 1].x1 + f.x0) / 2);
      const right = fi === frames.length - 1 ? w : Math.round((f.x1 + frames[fi + 1].x0) / 2);
      // Full bbox of the figure inside its slice (including thin parts removed by erosion).
      let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
      for (let y = top; y < bot; y++)
        for (let x = left; x < right; x++)
          if (mask[y * w + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      return { left, right, top, bot, coreCx: (f.x0 + f.x1) / 2, bx0, by0, bx1, by1 };
    });
    return { top, bot, frames: fr, pitchY: (top + bot) / 2 };
  });
}

/** Renders one frame into a CELL×CELL image: core centre → x = CELL/2, row baseline → bottom row. */
function renderFrame(img, mask, f, baseline, block) {
  const cell = newImage(CELL, CELL);
  const inside = (x, y) => x >= f.left && x < f.right && y >= f.top && y < f.bot;
  for (let cy = 0; cy < CELL; cy++)
    for (let cx = 0; cx < CELL; cx++) {
      const sx0 = f.coreCx + (cx - CELL / 2) * block;
      const sy0 = baseline - (CELL - cy) * block;
      const c = blockColor(img, mask, sx0, sy0, sx0 + block, sy0 + block, inside);
      if (c) setPx(cell, cx, cy, c);
    }
  return cell;
}

const TEAM = {
  team_tie_knot: { frames: 6, standing: true },
  team_belay: { frames: 4, standing: true },
  team_shout: { frames: 4, standing: true },
  team_celebrate: { frames: 6, standing: true },
  team_fall: { frames: 4 },
  team_slide: { frames: 3 },
  team_hang: { frames: 3 },
  team_injured: { frames: 2, fit: true }, // lying figures are ~56 px wide at standing scale → shrink to fit
};

async function processTeam(results) {
  const sheets = {};
  for (const id of Object.keys(TEAM)) {
    const file = path.join(RAW, "characters", `${id}.jpg`);
    if (!existsSync(file)) continue;
    const img = await load(file);
    const mask = chromaMask(img);
    despeckle(mask, img.w, img.h, 60);
    const grid = detectTeamGrid(img, mask);
    const pitch = (grid[grid.length - 1].pitchY - grid[0].pitchY) / (grid.length - 1);
    sheets[id] = { img, mask, grid, pitch };
  }
  // Scale reference: standing figure height relative to the row pitch on standing sheets.
  const ratios = [];
  for (const [id, s] of Object.entries(sheets)) {
    if (!TEAM[id].standing || id === "team_celebrate") continue;
    const hs = s.grid.flatMap((r) => r.frames.map((f) => f.by1 - f.by0)).sort((a, b) => a - b);
    ratios.push(hs[hs.length >> 1] / s.pitch);
  }
  const heightPerPitch = ratios.sort((a, b) => a - b)[ratios.length >> 1];

  for (const [id, s] of Object.entries(sheets)) {
    const warnings = [];
    const expected = TEAM[id].frames;
    if (s.grid.length !== ROWS) warnings.push(`detected ${s.grid.length} rows`);
    let block = (heightPerPitch * s.pitch) / STANDING_HEIGHT;
    if (TEAM[id].fit) {
      const fr = s.grid.flatMap((r) => r.frames);
      const need = Math.max(...fr.map((f) => (f.bx1 - f.bx0 + 1) / (CELL - 2)), ...fr.map((f) => (f.by1 - f.by0 + 1) / (CELL - 1)));
      if (need > block) { warnings.push(`scaled down ×${(block / need).toFixed(2)} to fit the cell`); block = need; }
      for (const f of fr) f.coreCx = (f.bx0 + f.bx1 + 1) / 2;
    }
    const sheet = newImage(CELL * expected, CELL * ROWS);
    s.grid.forEach((row, ri) => {
      let frames = row.frames;
      if (frames.length !== expected) {
        if (id === "team_celebrate" && frames.length === expected + 1) frames = frames.filter((_, i) => i !== 1);
        else {
          warnings.push(`row ${ri + 1}: ${frames.length} frames`);
          while (frames.length < expected) frames = [...frames, frames[frames.length - 1]];
          frames = frames.slice(0, expected);
        }
      }
      // Baseline: lowest figure bottom in the row (ground line), robust to jumping frames.
      const baseline = Math.max(...frames.map((f) => f.by1)) + 1;
      frames.forEach((f, fi) => {
        let src = f;
        // Known defect (P-ART-2): team_slide row 1 frame 2 shows member 2 → reuse frame 1.
        if (id === "team_slide" && ri === 0 && fi === 1) src = frames[0];
        blit(sheet, renderFrame(s.img, s.mask, src, baseline, block), fi * CELL, ri * CELL);
      });
    });
    if (id === "team_slide") warnings.push("row 1 frame 2 replaced by frame 1 (wrong member in raw)");
    if (id === "team_celebrate") warnings.push("rows with 7 frames: 2nd frame dropped");
    await savePng(sheet, path.join(OUT, "characters", `${id}.png`));
    results.push({
      id, group: "characters", file: `characters/${id}.png`, width: sheet.w, height: sheet.h,
      frameWidth: CELL, frameHeight: CELL, frames: expected, rows: ROWS, warnings,
      note: `block ${block.toFixed(2)} src px/px`,
    });
  }
}

// ---------- terrain ----------

function meanDiff(img, ax, ay, bx, by, w, h) {
  let d = 0, n = 0;
  for (let y = 0; y < h; y += 4)
    for (let x = 0; x < w; x += 4) {
      const i = ((ay + y) * img.w + ax + x) * 4, j = ((by + y) * img.w + bx + x) * 4;
      d += Math.abs(img.px[i] - img.px[j]) + Math.abs(img.px[i + 1] - img.px[j + 1]) + Math.abs(img.px[i + 2] - img.px[j + 2]);
      n++;
    }
  return d / n / 3;
}

/** Many generated textures are a 2×2 repetition; use one period when that is the case. */
function tilePeriod(img) {
  const hw = img.w >> 1, hh = img.h >> 1;
  const dx = meanDiff(img, 0, 0, hw, 0, hw, img.h);
  const dy = meanDiff(img, 0, 0, 0, hh, img.w, hh);
  const both = dx < 12 && dy < 12;
  return { w: both ? hw : img.w, h: both ? hh : img.h, dx, dy };
}

function mirrorVertically(img) {
  const out = newImage(img.w, img.h * 2);
  out.px.set(img.px, 0);
  for (let y = 0; y < img.h; y++)
    out.px.set(img.px.subarray(y * img.w * 4, (y + 1) * img.w * 4), (img.h * 2 - 1 - y) * img.w * 4);
  return out;
}

async function processTerrain(results) {
  for (const surface of ["grass", "ground", "rock", "scree"]) {
    const fillId = `terrain_${surface}_fill`;
    const fillFile = path.join(RAW, "terrain", `${fillId}.jpg`);
    if (existsSync(fillFile)) {
      const warnings = [];
      let img = await load(fillFile);
      if (surface === "grass") {
        // Known defect (P-ART-6): grass bands over soil. Keep only the longest soil band.
        let best = { s: 0, e: 0 }, cur = -1;
        const soilRow = (y) => {
          let green = 0;
          for (let x = 0; x < img.w; x += 2) {
            const i = (y * img.w + x) * 4;
            if (img.px[i + 1] > img.px[i] + 15) green++;
          }
          return green / (img.w / 2) < 0.03;
        };
        for (let y = 0; y <= img.h; y++) {
          const soil = y < img.h && soilRow(y);
          if (soil && cur < 0) cur = y;
          if (!soil && cur >= 0) { if (y - cur > best.e - best.s) best = { s: cur, e: y }; cur = -1; }
        }
        const pad = Math.round((best.e - best.s) * 0.06);
        const bh = best.e - best.s - 2 * pad;
        // The raw repeats twice horizontally; keep one period so the aspect ratio stays close to square.
        const half = meanDiff(img, 0, best.s + pad, img.w >> 1, best.s + pad, img.w >> 1, bh) < 12;
        const band = crop(img, 0, best.s + pad, half ? img.w >> 1 : img.w, bh);
        img = mirrorVertically(band);
        warnings.push(`rebuilt from soil band y=${best.s}..${best.e}, mirrored vertically`);
      }
      const p = tilePeriod(img);
      if (p.w !== img.w || p.h !== img.h) warnings.push(`2×2 repeat detected → one period ${p.w}×${p.h}`);
      const out = downsample(img, null, 0, 0, p.w, p.h, 128, 128, true);
      await savePng(out, path.join(OUT, "terrain", `${fillId}.png`));
      results.push({ id: fillId, group: "terrain", file: `terrain/${fillId}.png`, width: 128, height: 128, warnings });
    }
    const edgeId = `terrain_${surface}_edge`;
    const edgeFile = path.join(RAW, "terrain", `${edgeId}.jpg`);
    if (existsSync(edgeFile)) {
      const img = await load(edgeFile);
      const mask = chromaMask(img);
      despeckle(mask, img.w, img.h, 40);
      const out = downsample(img, mask, 0, 0, img.w, img.h, 128, 32);
      await savePng(out, path.join(OUT, "terrain", `${edgeId}.png`));
      results.push({ id: edgeId, group: "terrain", file: `terrain/${edgeId}.png`, width: 128, height: 32, warnings: [] });
    }
  }
}

// ---------- trees ----------

const TREES = { tree_conifer_small: [24, 40], tree_conifer_large: [40, 72], tree_deciduous_small: [24, 40], tree_deciduous_large: [48, 72] };

async function processTrees(results) {
  for (const [id, [tw, th]] of Object.entries(TREES)) {
    const file = path.join(RAW, "trees", `${id}.jpg`);
    if (!existsSync(file)) continue;
    const warnings = [];
    const img = await load(file);
    const mask = chromaMask(img);
    despeckle(mask, img.w, img.h, 200);
    let x0 = img.w, y0 = img.h, x1 = 0, y1 = 0;
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++)
        if (mask[y * img.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (id === "tree_conifer_large") {
      // Known defect (P-ART-5): a red rope is baked around the trunk. Recolour it to trunk brown.
      let n = 0;
      const lowY = y0 + (y1 - y0) * 0.6;
      for (let y = Math.floor(lowY); y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * img.w + x;
          if (!mask[i]) continue;
          const r = img.px[i * 4], g = img.px[i * 4 + 1], b = img.px[i * 4 + 2];
          if (r > 110 && r > g * 1.7 && r > b * 1.7) {
            const light = r > 170;
            img.px[i * 4] = light ? 0x7e : 0x5a; img.px[i * 4 + 1] = light ? 0x55 : 0x3a; img.px[i * 4 + 2] = light ? 0x30 : 0x22;
            n++;
          }
        }
      warnings.push(`rope recoloured to trunk brown (${n} px)`);
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const block = Math.max(bw / tw, bh / th);
    const ow = Math.min(tw, Math.round(bw / block)), oh = Math.min(th, Math.round(bh / block));
    const cx = (x0 + x1 + 1) / 2;
    const fig = downsample(img, mask, cx - (ow * block) / 2, y1 + 1 - oh * block, ow * block, oh * block, ow, oh);
    const out = newImage(tw, th);
    blit(out, fig, Math.floor((tw - ow) / 2), th - oh);
    await savePng(out, path.join(OUT, "trees", `${id}.png`));
    results.push({ id, group: "trees", file: `trees/${id}.png`, width: tw, height: th, warnings });
  }
}

// ---------- key art ----------

async function processArt(results) {
  const file = path.join(RAW, "art", "art_key_art.jpg");
  if (!existsSync(file)) return;
  const img = await load(file);
  const sw = Math.min(img.w, Math.round((img.h * 16) / 9));
  const sh = Math.round((sw * 9) / 16);
  const out = downsample(img, null, (img.w - sw) / 2, (img.h - sh) / 2, sw, sh, 480, 270, true);
  await savePng(out, path.join(OUT, "art", "art_key_art.png"));
  results.push({ id: "art_key_art", group: "art", file: "art/art_key_art.png", width: 480, height: 270, warnings: [] });
}

// ---------- contact sheet ----------

async function contactSheet(results, dir) {
  await mkdir(dir, { recursive: true });
  for (const group of ["characters", "terrain", "trees", "art"]) {
    const items = results.filter((r) => r.group === group);
    if (!items.length) continue;
    const scale = group === "art" ? 2 : 4;
    const gap = 16;
    const tiles = await Promise.all(items.map(async (r) => {
      const buf = await sharp(path.join(OUT, r.file)).resize(r.width * scale, r.height * scale, { kernel: "nearest" }).png().toBuffer();
      return { buf, w: r.width * scale, h: r.height * scale };
    }));
    let x = gap, y = gap, rowH = 0;
    const maxW = Math.max(1600, ...tiles.map((t) => t.w + 2 * gap));
    const placed = tiles.map((t) => {
      if (x + t.w + gap > maxW) { x = gap; y += rowH + gap; rowH = 0; }
      const p = { input: t.buf, left: x, top: y };
      x += t.w + gap; rowH = Math.max(rowH, t.h);
      return p;
    });
    await sharp({ create: { width: maxW, height: y + rowH + gap, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } })
      .composite(placed).png().toFile(path.join(dir, `contact_${group}.png`));
  }
}

// ---------- main ----------

const results = [];
await processArt(results);
await processTeam(results);
await processTerrain(results);
await processTrees(results);

const manifest = {
  _note: "Generated by tools/process-assets.mjs from assets/raw. Team sheets: 7 rows (members 1–7) × `frames` columns of 32×32 cells (deviation from the 16×32 spec: lying/falling poses are wide); pivot (16,31) = feet, bottom-centre of each cell. Characters face right.",
};
for (const r of results) {
  const { id, group: _g, warnings: _w, note: _n, ...rest } = r;
  manifest[id] = rest;
}
await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log("id".padEnd(24), "size".padEnd(10), "frames".padEnd(8), "notes");
for (const r of results)
  console.log(r.id.padEnd(24), `${r.width}×${r.height}`.padEnd(10), String(r.frames ?? "").padEnd(8), [r.note, ...r.warnings].filter(Boolean).join("; "));

const ci = process.argv.indexOf("--contact");
if (ci > 0) await contactSheet(results, process.argv[ci + 1]);
