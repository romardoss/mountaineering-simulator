# Problems

Status of all items: **Open** (2026-10-20) unless marked otherwise.

## P-PRD — PRD inconsistencies

Found while writing `docs/ARCHITECTURE.md` (its §11 holds the proposed assumptions; they are what the architecture currently follows).

1. **P-PRD-1 — Protocol violations vs. physics.** §12.2.2 says violations other than P5 have no physical consequence, but §14.1.2.3–4 makes P1/P2/P4 multiply fall probability. *Assumption:* §14.1.2 wins.
2. **P-PRD-2 — Stats list only P1–P5** (§16.1.6), while §12.2.1 defines P1–P7. *Assumption:* stats count every rule in `protocol.json`.
3. **P-PRD-3 — "Below" defined by `s`** (§14.2.2.2, §14.4.2). On the descent side of `ascent_descent`, lower `s` means higher elevation. *Assumption:* "below" and fall line use elevation; fall length uses path distance.
4. **P-PRD-4 — `PRD.md` location.** §20.2 places it in `/docs/`, it is at the repo root. *Assumption:* stays at root.
5. **P-PRD-5 — Duplicate numbering.** §8 has two items numbered 5; in §17.4 the descent tactic is numbered 6 and sits outside the list. References like `§8.5` are ambiguous.
6. **P-PRD-6 — Backpack weight listed as future scope** (§25.6) but already in MVP (§9.5).
7. **P-PRD-7 — When a paid-out rope becomes `in_use`** is undefined (§9.5.3). *Assumption:* as soon as one end is tied to a harness or base.
8. **P-PRD-8 — Rope retrieval by the last member** (§17.4.5) has no explicit action in §11. *Assumption:* untying the bottom end re-ties it as a `member_harness` node that follows the member.
9. **P-PRD-9 — "Loading the rope" for `hold` / P7** (§12.2.1.7) is not a defined state. *Assumption:* loaded when `fallen_caught`, or hanging on a segment on ≥ 35°.

## P-SPEC — `ASSET_PROMPTS.md` vs. PRD

1. **P-SPEC-1 — Character model.** PRD §8.3 and §18.3.1 describe layered sprites (body base, hair, outfit, helmet, harness, backpack) with palette-swap recolouring and a «Випадково» randomiser. ASSET_PROMPTS uses fixed whole-body rows: member *i* = row *i*. The team appearance editor must shrink to "pick a row / recolour a row".
2. **P-SPEC-2 — Worn gear baked into sprites.** Every sprite always shows helmet and harness, but the PRD allows a member without them (§9.3.6 warning; helmet changes injury odds in §14.2, §14.4). The mistake would be invisible on screen.
3. **P-SPEC-3 — Shared colours break row recolouring.** ASSET_PROMPTS §2.3 promises every part in a row has its own exact ramp, but:
   1. Row 2 pants and row 4 backpack contain `#3A3A48` — the fixed harness colour. Recolouring either part also recolours the harness.
   2. Row 2 hair `#3A2414` and row 6 hair `#5C3A22` differ by one hex digit from boots `#3A2416` / `#5A3A22`; palette snapping will likely merge them.
4. **P-SPEC-4 — No knot icons.** PRD §13.4.1 and §18.5.4.2 require a 16×16 icon per knot; the batch excludes them on purpose.
5. **P-SPEC-5 — No palette files.** PRD §18.1.4 expects `assets/palettes/*.json`; colours exist only inline in prompts.
6. **P-SPEC-6 — Winter missing.** No winter terrain, characters, trees, backgrounds, crampons or ice-axe icons. Acceptable until M6.
7. **P-SPEC-7 — `ARCHITECTURE.md` treats assets as out of scope.** The art set is now defined, so the assets section (manifest, loader, Preload scene, recolouring) can be written.
8. **P-SPEC-8 — Lying / falling poses do not fit 16×32 cells.** `team_fall`, `team_slide`, `team_hang`, `team_injured` are horizontal poses far wider than 16 px. The cell size in the prompts is wrong for these animations.
9. **P-SPEC-9 — Terrain target sizes too small.** Fills are 32×32 and edges 32×8 logical px, but the generated textures carry far more detail; downscaling to spec size destroys them.

## P-CODE — found during implementation

1. **P-CODE-1 — No idle/walk/climb sheets yet**: the renderer uses `team_tie_knot` frame 0 with a bob as idle/walk.
2. **P-CODE-2 — `team_injured` sprites are small** (scaled ×0.51 to fit the 32×32 cell). Needs a 64×32 cell or a redraw.
4. **P-CODE-4 — Ropes jump to their final layout** at the start of a step animation; only harness and belay nodes move with the members.
5. **P-CODE-5 — Speech bubbles disappear** when a step's animation ends.
6. **P-CODE-6 — Crowded member labels** can overlap the START label.
7. **P-CODE-7 — Member cards use emoji icons** (🔗 👕 🎒) which fall back to the system font; replace with pixel icons when `icon_*` art exists.
8. **P-CODE-8 — Ukrainian names are not declined**: messages are phrased so names stay in the nominative («{member}: …»).
9. **P-CODE-9 — No winter art**: winter terrain is tinted summer textures plus a snow band.
3. **P-CODE-3 — Pixelify Sans lacks І, О, П** in its Cyrillic subset — rejected; Press Start 2P + Tiny5 used (D-34).

## P-ART — defects in generated images (`assets/raw/`)

1. **P-ART-1 — Not post-processed.** All 19 files are JPEG (`.jfif`) at generation scale with a chroma background, not PNG-32 at logical size. JPEG artefacts blur the `#00FF00` edge, so chroma removal needs a tolerance.
2. **P-ART-2 — `team_slide`: wrong member.** Row 1, frame 2 shows member 2 (blue jacket, orange helmet) instead of member 1.
3. **P-ART-3 — `team_celebrate`: inconsistent frame count.** Row 1 has 6 frames, rows 2–7 have 7. Spec: 6.
4. **P-ART-4 — Team sheets off-grid.** The model padded cells; sheet aspect ratios (~0.56–0.67) do not match 7 rows × N frames of 16×32 (e.g. 0.29 for 4 frames). Frames must be detected and sliced, not uniformly downscaled.
5. **P-ART-5 — `tree_conifer_large`: rope baked in.** A red rope is tied around the trunk. The game draws ropes itself, so the tree would always look like an anchor.
6. **P-ART-6 — `terrain_grass_fill` is not a fill.** It contains two grass bands over soil strata; tiled vertically it puts grass stripes underground. Ground, rock and scree fills are fine.
7. **P-ART-7 — Pixel grid not respected.** None of the images sit on the requested 4×/8×/16×/32× logical grid; effective pixel size varies inside the same image.
