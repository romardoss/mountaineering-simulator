# Ideas for the future

Not committed scope. Promote an idea to `ACTIONS.md` (or the PRD) when it is agreed.

## Art and assets

1. **I-ART-1 — Gear overlays.** Draw helmet, harness, crampons and backpack as small overlay sprites on top of a "bare" team sheet, so worn equipment is visible and correct (solves P-SPEC-2, prepares winter crampons).
2. **I-ART-2 — Row-consistency checker.** In the post-processing script, compare silhouettes column by column across the 7 rows and flag frames whose pose or member differs (would have caught P-ART-2 and P-ART-3 automatically).
3. **I-ART-3 — Dev asset preview page** (`/dev/assets`, PRD §18.5.6) that shows raw vs. processed side by side, animated, with recolour preview.
4. **I-ART-4 — Winter batch prompts.** Write `ASSET_PROMPTS_WINTER.md` reusing the summer structure, once the summer batch is approved (M6).
5. **I-ART-5 — Knot icon batch.** A separate prompt batch for the 24 knot icons (§13.2), possibly as small diagrams rather than pictures.
6. **I-ART-6 — Generate at final size where the tool allows** (or use a pixel-art-specific model), to avoid off-grid pixels and lossy downscaling.

## Gameplay and learning

1. **I-GAME-1 — Show the fall chance.** Since every roll records its probability, show "fall chance 9 %" in the journal and in learning-mode hints.
2. **I-GAME-2 — Replay viewer.** Use the deterministic history to replay a finished game step by step on the results screen.
3. **I-GAME-3 — Instructor scenario packs.** Share scenarios with a fixed seed so a class plays the same situation and compares results.

## Engineering

1. **I-ENG-1 — Code-split Phaser** (bundle is 1.7 MB, 0.49 MB gzipped) so menus load faster.
2. **I-ENG-2 — Tutorial scenario** (PRD §17.3, M7): script the canonical tactic from `tests/engine/scenarios/golden.test.ts` as guided steps.
3. **I-ENG-3 — Property tests** with fast-check: random valid plans never break invariants (ARCHITECTURE §8).
