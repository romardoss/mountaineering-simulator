# «Закріпи! Готово! Рух!»

A step-by-step pixel-art learning game about mountaineering and sport-tourism technique, knots and Ukrainian terminology. Requirements: [`PRD.md`](PRD.md). Technical specification (how it is built, drives all changes): [`specification.md`](specification.md). Design rationale: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md), open items: [`docs/CTA/`](docs/CTA/README.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit + scenario tests, data and locale checks
npm run e2e        # Playwright smoke test (needs `npx playwright install chromium`)
npm run build      # static build in dist/
npm run assets     # assets/raw/** → game PNGs + assets/manifest.json
npm run sim -- scenario.json history.json en   # headless journal of a recorded game
npm run letsvibe   # voice playtest → change-request prompt (see below)
```

### Voice playtest (`letsvibe`)

`npm run letsvibe` starts the game, opens it in the browser and records the microphone while you play and talk. Press **Enter** or **q** in the terminal to finish: the recording is transcribed (OpenRouter `openai/whisper-large-v3`) and an OpenRouter LLM (`anthropic/claude-sonnet-5.5`) turns your remarks into a numbered change-request prompt for the coding agent. Item 1 of the prompt always asks to update the specifications first, and the prompt always ends by asking the agent to clarify anything unclear from the audio before making changes. The prompt is printed, copied to the clipboard and saved with the audio and transcript in `.letsvibe/<date_time>/`. **Ctrl+C** aborts and keeps the audio.

1. Needs `ffmpeg` and `OPENROUTER_API_KEY` (environment, or `OPENROUTER_API_KEY=...` in `.env.local`; it is not exposed to the game bundle).
2. `-- --no-game` records without starting the game; `-- --from .letsvibe/<session>` re-processes a saved recording (e.g. after an API error).
3. Optional env: `LETSVIBE_STT_MODEL`, `LETSVIBE_LLM_MODEL`, `LETSVIBE_LANGUAGE` (e.g. `uk`; default auto-detect), `LETSVIBE_AUDIO_INPUT` (ffmpeg input, default `-f pulse -i default` on Linux/WSLg, `-f avfoundation -i :0` on macOS).

## Layout

| Path | What |
|---|---|
| `src/engine` | Pure, deterministic game rules (no DOM, no Phaser) |
| `src/data` | JSON rules, presets, kits, schemas — editable without code ([guide](docs/data-authoring.md)) |
| `src/app` | Session store, game controller, persistence, settings |
| `src/ui` | Preact screens, panels, dialogs |
| `src/game` | Phaser hill view |
| `src/i18n` | `uk` (default) and `en` locales |
| `tests` | Vitest engine/data tests, Playwright e2e |
