# Technical specification — «Закріпи! Готово! Рух!»

| Field | Value |
|---|---|
| Document version | 1.1 |
| Date | 2026-10-21 |
| Describes | Implementation state of commit "Implement MVP" (M0–M5) + owner change requests CR-1…CR-41 (§27) |
| Product source | `PRD.md` v0.1 |
| Audience | AI coding agents and human reviewers |

---

## 0. How to use this document

### 0.1 Role of each document

1. `PRD.md` says **what** the product does (product side).
2. **This specification says how it is built** (technical side): modules, data shapes, algorithms, formulas, keys, file formats, test strategy. It is the technical source of truth for the whole project.
3. `docs/ARCHITECTURE.md` explains the original design rationale. Where it and this document differ, this document wins.
4. `docs/DECISIONS.md` logs every interpretation of, or deviation from, the PRD (ids `D-n`). This specification references them.
5. `docs/CTA/` holds open problems (`P-*`), actions (`A-*`) and ideas (`I-*`).
6. `docs/ASSET_SPEC.md` is the art contract; `docs/data-authoring.md` is the instructor guide for JSON data.

### 0.2 Change workflow (this file drives implementation)

1. **Specify first.** Every change starts as an edit of this file: the affected sections are rewritten to describe the target behaviour, and a row is added to §27 "Change log" with status `Proposed`.
2. **Mark the delta.** Changed or new requirements are tagged inline with `[CR-n]` (change request number from §27). Sections carry an implementation status: ✅ implemented, 🟡 partial, ⏳ planned.
3. **Implement the delta.** An agent implementing `CR-n` must: (a) read §27 and every `[CR-n]` tag, (b) change code, data, locales and tests so the system matches the spec, (c) update the status markers, remove resolved `[CR-n]` tags, set the §27 row to `Implemented` with the date, (d) record any interpretation in `docs/DECISIONS.md`.
4. **Not only what is asked.** When implementing, keep the whole spec consistent: if a change affects other sections (data schema, i18n keys, tests, UI, rendering), update them in the same change. If the code and the spec disagree outside the change, either fix the code or flag it in §26.
5. **Definition of done** for any change: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run e2e` pass; new rules have tests (§23); new user-facing strings exist in `uk` and `en` (§21).
6. Requirements are referenced as `S§<section>.<item>` (this file) and `§<section>` (PRD).

### 0.3 Non-negotiable engineering rules

1. **Pure engine.** `src/engine/**` has no imports from `src/game`, `src/ui`, `src/app`, `src/i18n`, Phaser or Preact, and does not use `window`, `document`, `localStorage`, `performance`, `Math.random` or `Date.now`. Enforced by ESLint (`eslint.config.js`).
2. **Determinism.** All randomness goes through the seeded RNG in `GameState.rng` (§16). Same scenario + seed + action history + roll script ⇒ deep-equal state.
3. **Data-driven numbers.** Every tunable number lives in `src/data/*.json`. Code may contain only structural constants (array indices, rendering layout).
4. **i18n only.** The engine emits i18n keys + params, never text. The UI shows text only through `t()` / `tl()`.
5. **Equipment accountability.** Items are never created, destroyed, duplicated or teleported; `checkInvariants` and `checkTransition` run after every step in dev/test (§15).
6. **Impossible vs unsafe.** Physically impossible actions fail `validate` (disabled in UI with a reason key). Unsafe-but-possible actions pass and only produce `assess` hints.

---

## 1. Technology stack ✅

| Concern | Choice (exact versions in `package.json`) |
|---|---|
| Language | TypeScript 5.9, `strict`, ES2022, JSX via Preact |
| Build / dev | Vite 7 (`base: "./"`, static output in `dist/`) |
| UI | Preact 10 + `@preact/signals` 2 (DOM overlay) |
| Rendering | Phaser 3.90 (`pixelArt: true`, `roundPixels: true`) |
| i18n | `intl-messageformat` 10 (ICU, Ukrainian plurals via `Intl.PluralRules`) |
| Validation | Ajv 8 (runtime for imported scenarios) |
| Fonts | `@fontsource/press-start-2p` (titles), `@fontsource/tiny5` (body) — bundled, no network (D-34) |
| Tests | Vitest 3 (unit, scenario, data), Playwright 1.56 (e2e) |
| Lint | ESLint 9 + typescript-eslint 8 |
| Assets | `sharp` 0.34 in `tools/process-assets.mjs` |
| CI | GitHub Actions: lint → typecheck → test → build → deploy `dist` to GitHub Pages (`.github/workflows/ci.yml`) |
| Node | 22 |

Scripts: `dev`, `build` (typecheck + vite build), `typecheck`, `test`, `lint`, `e2e`, `assets`, `sim`, `letsvibe`.

---

## 2. Repository layout ✅

```
PRD.md                      product requirements
specification.md            this document
README.md
docs/
  ARCHITECTURE.md           design rationale
  DECISIONS.md              D-n interpretation log
  ASSET_SPEC.md             art contract
  ASSET_PROMPTS.md          image-generation prompts
  data-authoring.md         instructor guide
  CHANGELOG.md              milestone notes
  CTA/                      problems, actions, ideas
assets/
  raw/<group>/<id>.jpg      original generations (inputs of npm run assets)
  <group>/<id>.png          processed game art
  manifest.json             generated asset registry
src/
  main.tsx                  entry: fonts, CSS, settings, <App/>
  engine/                   pure game logic (S§4–S§17)
    model/types.ts          all domain types
    model/selectors.ts      derived read-only queries
    data/types.ts           GameData types
    geometry/hill.ts        s ↔ world, zones, elevation
    rng/rng.ts              mulberry32 + named / scripted rolls
    knots/evaluate.ts       evaluateKnot
    knots/instance.ts       knot creation, contexts, anchors
    actions/defs.ts         all action definitions
    actions/movement.ts     movement budget + constraints
    actions/options.ts      getActionOptions for the UI
    hazards/falls.ts        fall chance, protection chains, injuries
    hazards/rockfall.ts     rockfall
    resolution/tx.ts        StepTx working copy
    resolution/resolve.ts   resolveStep pipeline
    invariants/invariants.ts
    scenario/create.ts      createGame
    scenario/validate.ts    hill / team / equipment validation
    scenario/kit.ts         item factory, «Типовий набір»
    stats/stats.ts          computeStats, items left
    index.ts                createEngine (public API)
  data/                     JSON rules (S§6) + load.ts + schemas/
  app/                      store, controller, settings, persistence
  i18n/                     i18n.ts + locales/<uk|en>/<area>.json
  ui/                       App router, screens, panels, dialogs, components, CSS
  game/                     Phaser view (S§20)
tests/
  engine/dsl.ts             scenario DSL
  engine/unit/              unit tests
  engine/scenarios/         PRD §24.2 scenario tests
  data/                     data + locale tests
  e2e/                      Playwright
tools/
  process-assets.mjs        asset pipeline
  sim.ts                    headless journal printer
  letsvibe.mjs              voice playtest: game + mic recording → OpenRouter STT → change-request prompt (README)
```

Dependency direction: `ui`, `game` → `app` → `engine`; `ui`/`game` → `i18n`; `app` → `data`; `engine` → `data/types` only. `ui` and `game` never import each other; they share state through `app/store.ts`.

---

## 3. Architecture overview ✅

1. **Data layer** (`src/data`): JSON + `load.ts` exporting `gameData: GameData` (frozen), `hillPresets: HillConfig[]` (default first), `kits: KitDef[]`.
2. **Engine** (`src/engine`): `createEngine(gameData)` returns pure functions over plain JSON state.
3. **Application** (`src/app`): signals store, `GameController` functions, settings, `localStorage` persistence, scenario import.
4. **Presentation**: Preact DOM UI for every screen and panel; Phaser canvas only for the hill view inside the game screen.

Step lifecycle: UI collects one `ActionParams` per member into `session.plan` → `executeStep()` validates, drops invalid actions, calls `engine.resolveStep` → new state + events stored in `session` → Phaser timeline animates `prevState → state` using events → `animating=false` → next planning.

---

## 4. Domain model ✅ (`src/engine/model/types.ts`)

All entities are plain JSON (no classes, Maps, cycles). Ids are strings. Generated ids use `state.nextId` with prefixes: `k` knot, `a` attachment, `b` base, `y` belay, `n` rope node, `r` rockfall.

### 4.1 Positions

1. `Position = { obstacleIndex: number; s: number }` — `s` in metres along the path (S§5). MVP: `obstacleIndex = 0`.
2. Adjacency: `|s1 − s2| ≤ rules.adjacencyM` (2 m) on the same obstacle.

### 4.2 Scenario (configuration)

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | |
| `id`, `name` | string | |
| `route.obstacles` | `HillConfig[]` | MVP: exactly one |
| `season` | `"spring" \| "summer" \| "autumn" \| "winter"` | each season has its own rain and mud probability (S§6.5) |
| `mode` | `"learning" \| "exam"` | |
| `seed` | number | 32-bit |
| `team` | `MemberConfig[]` | 2–7 |
| `items` | `ItemConfig[]` | each with `assignedTo` or `null` (not taken); no weight |
| `weights` | `EquipmentWeights` | snapshot of the weight settings (S§18.5) written by `startGame`; the only source of every weight in the game |
| `maxSteps` | `number \| null` | loss when reached |

`HillConfig`: `id, nameKey?, name?, type:"hill", routeType ("ascent"|"descent"|"ascent_descent"), startZoneM, finishZoneM, summitZoneM?, sections: SectionConfig[], descentSections?: SectionConfig[], trees: Tree[], basePoints: BasePoint[]`. A scenario embeds a **copy** of the hill chosen from the obstacle library (S§18.6), so later edits of the library hill never change saved scenarios.
`SectionConfig = { lengthM, angleDeg, surface: "grass"|"ground"|"rock"|"scree" }`. `Tree = { id, s, size: "small"|"large", kind?: "conifer"|"deciduous" }`. `BasePoint = { id, s, anchorType: "tree"|"rock_outcrop"|"bolt", treeId? }`.

**Base points are not bases**. A base point is only a *place where a base can be built* (a natural or artificial anchor). The route never contains ready-made bases: `GameState.bases` is always empty at step 0 and every base is built by a team member with `make_base` (S§9.2). There is no scenario field for pre-built bases. A hill may have no base points at all except the mandatory one in the finish zone (S§17.2.1). In UI text base points are called «місце для бази» / "base spot", never «база». **Every large tree is a base spot by default** (D-66): `basePointsOf(hill)` (`geometry/hill.ts`, memoised by hill identity) returns the configured base spots plus `{ id: "bp@<treeId>", s, anchorType: "tree", treeId }` for each `large` tree without a configured spot (same tree, or a spot within 0.5 m). Small trees are base spots only where configured. Engine (options, make_base, anchor kind / support, start position, validation), renderer, map icon and labels all use `basePointsOf`.

`MemberConfig = { id, name, appearance: { row: 0..6, jacketColor? } }` (D-36, D-37). Members have no per-member base weight: everybody carries the same base backpack, `weights.backpackBaseKg` (default 15 kg in every season), which is set only in Settings. Members have **no role**: all members are equal and the team order (index in `team`) is the only ordering. The former `role` field (`leader|member|last`) is removed from the model, the engine, the UI and the data; imported files that still contain `role` are accepted and the field is dropped (S§18.4). `appearance.row` is not chosen by the player: it is assigned automatically to a random row not used by another member (S§19.2.5).

`ItemConfig = { id, type, props, assignedTo: { memberId, as: "worn"|"carried" } | null }` — no weight: an item's weight is always `defaultWeight(scenario.weights, type, props)` (S§17.3).
`ItemProps`: `lengthM, diameterMm, kind (static|dynamic), color, lengthCm, locking, shape (hms|d|oval), model (atc|figure8), arms, loopKnot { knotId, control }`.

`EquipmentWeights = { backpackBaseKg, ropePerMeterKg (at 10 mm), cordPerMeterKg, slingKg { 60, 120, 240 }, carabinerKg { locking, nonLocking }, belayDeviceKg { atc, figure8 }, harnessKg, helmetKg, lanyardKg, glovesKg, cramponsKg, iceAxeKg, ascenderKg }`. Defaults in `src/data/weights.json`; the values in use come from Settings.
Item types: `rope, cord, sling, carabiner, belay_device, ascender, harness, helmet, lanyard, gloves, crampons, ice_axe, backpack` (backpack is implicit, D-37; `ascender` = «жумар», a carried item with no action yet, D-51).

**Individual equipment** (D-46, D-49, D-50): every member gets the **same** personal set from `src/data/individual.json`; it is never part of `scenario.items`, is not offered in «Що беремо» (catalog / pool) and is not shown on the equipment screen. `always`: helmet (worn), harness (worn), belay gloves «страхувальні рукавиці» (worn), belay device ATC «спусковий пристрій» (carried), ascender «жумар» (carried), 2-arm lanyard «вус самостраховки» (carried), **2 prusik loops** «прусики» (cord 1.5 m × 6 mm pre-tied with Грепвайн, carried); `winter` adds crampons (worn) and ice axe (carried). `individualKit(data, season)` returns the entries; `isIndividual(type)` is true for every type in `always ∪ winter` (`scenario/kit.ts`). Configured items of these types (old files) are ignored.

### 4.3 GameState

| Field | Content |
|---|---|
| `schemaVersion`, `scenario` | immutable copy of the scenario |
| `step` | number of resolved steps |
| `rng` | `{ algo: "mulberry32", s }` |
| `outcome` | `in_progress \| won \| lost \| aborted` |
| `simTimeS` | Σ step durations |
| `members` | `MemberState`: config fields (`id, name, appearance`) + `baseWeightKg` (= `weights.backpackBaseKg`) + `abilities: {}` (never read), `pos`, `status (ok\|fallen_caught\|injured\|finished)`, `forcedSkipNextStep` |
| `items` | `ItemState`: `id, type, weightKg` (computed once by `createGame` from `scenario.weights`), `props, location` — the id set equals `itemIds` forever |
| `ropes` | `RopeLayout` per rope in use |
| `knots` | `KnotInstance` per knot currently tied |
| `weather` | `"dry" \| "mud" \| "rain"` — rolled once by `createGame` from the season (S§6.5), constant for the whole game |
| `bases`, `attachments`, `belays` | structures (below); all empty at step 0 — bases exist only after `make_base` |
| `hazards.pendingRockfalls` | `PendingRockfall[]` |
| `protocol` | `ProtocolState` (S§13) |
| `stats` | `StatsCounters` (S§14) |
| `log` | every `GameEvent` so far (journal) |
| `nextId`, `itemIds` | id counter, initial item ids |

### 4.4 Item location (single source of truth)

```ts
type ItemLocation =
  | { kind: "carried"; memberId }
  | { kind: "worn"; memberId }
  | { kind: "in_use"; structure: StructureRef }   // rope | base | attachment | belay | knot
  | { kind: "on_ground"; pos };
```

Which items are `in_use` where:

| Structure | Items |
|---|---|
| `rope` (layout) | the rope itself |
| `base` | sling + carabiner (`sling`), carabiner (`bolt`), none (`direct`) |
| `attachment` | carabiner (`lanyard_carabiner`); cord + carabiner (`grabbing_knot`); none (`hand`). The lanyard stays `carried`. |
| `belay` | device + carabiner (`device`) or carabiner(s) (`knot`) |
| `knot` | carabiner of a tie-in via carabiner, or own carabiner of a Карабінна удавка on a carabiner-less base |

### 4.5 Rope layout

1. `RopeLayout = { ropeId, nodes: RopeNode[] }`, nodes ordered end A → end B.
2. `RopeNode = { id, pos, attach }`, `attach` one of:
   1. `member_harness { memberId, knotId }` — follows the member's position.
   2. `base { baseId, mode: "fixed", knotId }` — tied to a base with a knot.
   3. `base { baseId, mode: "running" }` — runs through the base carabiner (intermediate protection).
   4. `base { baseId, mode: "doubled" }` — doubled around / through the anchor (descent).
   5. `belay { belayId }` — through the belayer's braking; follows the belayer.
   6. `free` — lying / hanging end.
3. Used length = Σ |sᵢ − sᵢ₊₁| + `knotRopeAllowanceM` × (knots whose `itemId` is this rope). Must be ≤ `props.lengthM`.
4. **Derived segments** (never stored):
   1. *Fixed segment*: consecutive nodes both `base` (any mode) at different `s`; `lower`/`upper` by elevation.
   2. *Hanging strand*: a `free` end node adjacent (in node order) to a `fixed` or `doubled` base node and lower in elevation.
   3. `belayableSegments(state)` = fixed segments + hanging strands; key `"<ropeId>:<lowerNodeId>:<upperNodeId>"`.

### 4.6 Other structures

1. `KnotInstance = { id, knotId, context, control (none|single|double), turns, tiedBy, step, preTied, itemId, evaluation, revealed }`.
2. `BaseState = { id, basePointId, pos, construction (sling|direct|bolt), itemIds, carabinerId, builtBy, step }`.
3. `Attachment = { id, memberId, method (hand|lanyard_carabiner|grabbing_knot), target: segment{ropeId,lowerNodeId,upperNodeId} | base{baseId}, itemIds, knotId, step }`.
4. `BelayRelation = { id, belayerId, climberId, ropeId, mode (lower|upper), braking: device{itemId,carabinerIds} | knot{knotId,carabinerIds}, anchor: base{baseId} | body, step, distanceAtSetM, inactiveThisStep }`.
5. `PendingRockfall = { id, createdStep, sourceMemberId, pos, threatened[], warned }`.

### 4.7 Events

`GameEvent = { id: "<step>:<seq>", step, phase, type, severity (info|hint|warning|danger), messageKey, params, refs { members?, items?, knots?, ruleIds?, rolls? } }`. Event `type` values are stable identifiers used by the renderer (S§20.6) and tests; `messageKey` is the i18n key (S§21).

---

## 5. Geometry ✅ (`engine/geometry/hill.ts`)

1. Path layout (D-10): `[0, startZoneM]` flat start zone → sections from `s = startZoneM` → (ascent_descent) flat summit zone of `summitZoneM` (default 6) → descent sections → flat finish zone of `finishZoneM`. `finishStart` = end of last section; `totalLength = finishStart + finishZoneM`.
2. `normaliseSections` adds `direction` (`up` for ascent sides, `down` for descent) and `startS`.
3. `buildHillGeometry(hill)` → `segments[]` each `{ s0, s1, angleDeg, sign (+1 up, −1 down, 0 flat), surface, section, zone, x0, y0 }`; memoised in a `WeakMap` by object identity — **editors must create a new hill object on every change**.
4. `toWorld(s)` → metres `(x, y)`, y up. `elevationAt`, `angleAt`, `zoneAt` (`start|summit|finish|slope`), `isSafeZone` (any zone except slope), `steepestBetween(a,b)`, `downhillDir(s)` (−1/+1 in `s`; in flat zones looks at the neighbouring slope; summit → descent side).
5. "Below" and "lower node" always compare elevation (D-3). Distances (fall, slide, move) use path distance `|Δs|`.

---

## 6. Data files ✅ (`src/data`)

All numbers below are current defaults. Types: `engine/data/types.ts`.

### 6.1 `rules.json`

| Key | Value | Use |
|---|---|---|
| `adjacencyM` | 2 | S§4.1 |
| `knotRopeAllowanceM` | 1 | S§4.5.3 |
| `maxThingsPerCarabiner` | 3 | S§15 |
| `minStepSeconds` | 5 | S§8.6 |
| `maxMembersPerSegment` | 1 | P4 |
| `angleBands` | ≤15° gentle 6 m; ≤25° 4 m; ≤35° 3 m; ≤45° 2 m; ≤90° 1.5 m | move per step |
| `moveModifiers` | grabbingKnot 0.7, snow 0.8 (snow, snow_scree), mud 0.8, rock 0.9 (rock, icy_rock, wet_rock), **uphill 1.5** (segments climbed in the move direction) | S§10.1 |
| `weight` | comfortKg 25, heavyKg 30, maxKg 35, heavyMoveFactor 0.85, overMoveFactor 0.7, overFallFactor 1.3 | S§10.3 |
| `team` | min 2, max 7, default 5 | |
| `hill` | total 10–300 m; section 3–60 m; angle 0–55°; warn ≥35° longer than 25 m without base point | |
| `unsafeDetachDeg`, `unprotectedHintDeg` | 25, 25 | hints |
| `staticLoadDeg` | 35 | S§12.5 |
| `safeGrabbingMaxDeg` | 55 | friction-hitch self-belay on a fixed rope: no terrain fall below this angle (S§12.1) |

### 6.2 `hazards.json`

1. `fall`: `pFallMax 0.5`; `baseByAngle` ≤15 → 0, ≤25 → 0.01, ≤35 → 0.03, ≤45 → 0.06, else 0.12; `surface` grass 1.0, ground 1.0, rock 1.2, scree 1.8, snow 1.3, icy_rock 1.5, snow_scree 2.0, mud 1.5, wet_rock 1.4; `method.hand 0.5`; `mistakes`: winterNoCrampons ×2.0 (≥25°), overloaded ×1.3, uncoordinated ×1.5, crowdedSegment ×1.3, unwarnedRock ×3.0.
2. `knots.ratings`: correct 0/0, acceptable 0/0.05, wrong 0.3/0.8, dangerous 0.6/1.0 (static/shock).
3. `knots.modifiers` (additive shock unless noted): missingControl +0.25 (+0.05 static), turnsBelowMin +0.4, constantLoadOnlyShock +0.5, diameterRatio outside [0.4, 0.7] +0.6, carabinerMissing +0.1, minSupportDiameter +0.5, cordNotLooped +0.4, twoCarabinersMissing +0.3.
4. `anchors` (shock/static): tree_large 0/0, tree_small 0.15/0.02, rock_outcrop 0.02/0, bolt 0/0.
5. `carabiner.nonLockingShock` 0.1.
6. `injury`: slackM 1; slide threshold 8 m on ≥35° → p 0.1; caught belay fall: `longFall { freeM 4, perM { rock 0.02, default 0.012 }, max 0.6 }` — p = min(max, perM × (length − freeM)) × helmet 0.6 (S§12.3); belayer pulled p 0.7 on ≥25°; unprotected: slide ≥5 m with steepest ≥30° → p 0.9 (rock 1.0); slide stops below 20°.
7. `rockfall`: pDislodge rock/scree/snow_scree/wet_rock 0.05; pHit 0.4; pInjuryRock 0.8 × helmet 0.25.
8. Rock-type surfaces (rock injury threshold, rock slide injury, rock move factor): `rock`, `icy_rock`, `wet_rock`.

### 6.3 Other files

| File | Shape |
|---|---|
| `actions.json` | durations (S) — S§9 table |
| `commands.json` | `[{ key, textKey, hintKey, wrongKeys[2] }]` × 11 (S§13.1) |
| `protocol.json` | `[{ id P1–P7, enabled, severity, messageKey "rule.Pn", physical }]` |
| `equipment.json` | `[{ type, nameKey, icon, wearable, defaults: ItemProps }]` (no weights) |
| `individual.json` | `{ always: KitEntry[], winter: KitEntry[] }` — the per-member individual equipment (S§4.2) |
| `seasons.json` | per season `{ pRain, pMud }` and `surfaceMap` (S§6.5) |
| `weights.json` | default `EquipmentWeights` (S§4.2): backpack 15 kg; rope 0.07 kg/m at 10 mm; cord 0.03 kg/m; sling 60/120/240 cm → 0.03/0.06/0.12; carabiner locking 0.08 / non-locking 0.05; device ATC 0.08 / figure-8 0.10; harness 0.4; helmet 0.35; lanyard 0.15; gloves 0.1; crampons 0.9; ice axe 0.5; ascender 0.2. Exposed as `gameData.weights` |
| `knots.json` | 24 × `KnotDef` (S§11.1) |
| `contexts.json` | `{ <CONTEXT>: { nameKey, ratings: { knotId: rating \| { rating, requires, otherwise } }, default, deviceRating? } }` |
| `glossary.json` | list of `term.*` keys (PRD §4) |
| `presets/hills/*.json` | `HillConfig` × 6 (S§6.4) — the built-in, read-only part of the obstacle library (S§18.6) |
| `presets/kits/typical.json` | `KitDef` (S§17.3); team entries use `assign: first \| last \| spread_heavy` (team order, no roles) |
| `schemas/scenario.schema.json` | JSON Schema draft-07 of `Scenario` (import validation) |

### 6.4 Hill presets (D-10 coordinates)

| id | Route | Sections (length/angle/surface) | Base points (s) |
|---|---|---|---|
| `skhyl-z-derevamy` (default) | ascent | 15/15 grass, 20/28 grass, 20/38 ground, 15/45 rock | start 3 (large tree), mid1 41 (large tree), mid2 61 (outcrop), top 79 (large tree) |
| `pologyi-travianystyi` | ascent | 20/10, 20/15, 20/20 grass | 3, 26, 70 (trees) |
| `skelno-osypnyi` | ascent | 15/25 scree, 20/35 scree, 20/45 rock, 15/50 rock | 3 tree, 21 outcrop, 41 bolt, 61 bolt, 79 outcrop |
| `spusk-zi-schylu` | descent | 15/45 rock, 20/38 ground, 20/28 grass, 15/15 grass | 3 tree, 21 outcrop, 41 tree, 61 tree, 81 tree |
| `cherez-vershynu` | ascent_descent | preset 1 ascent + summit 6 + 20/35, 20/25, 15/15 grass | 3, 41, 61, summit 79, 102, finish 141 |
| `osinnii-lyst-2026-2-2` «Осінній Лист 2026 2.2» | ascent, stage 39 m (start zone 4, finish zone 4) | 6/20 grass, 7/35 ground, 6/50 ground, 7/42 ground, 5/28 grass | start 2 (tree ⌀ 60 cm girth = small), ППС 9, 14, 19.5, 25, 31 (small trees ≤ 60 cm), finish 37 (tree 1 m girth = large); 16 small decorative trees (no extra base spots) |

All presets use `startZoneM 6`, `finishZoneM 8`, except «Осінній Лист 2026 2.2» (4 / 4, a 39 m competition stage). Base points in the table are base *spots* (anchors); no preset contains a built base. Every preset has a base point in the finish zone; the start and summit base points are optional and kept as convenient anchors.

### 6.5 Seasons and weather (`seasons.json`)

1. Seasons: `spring`, `summer`, `autumn`, `winter`. Probabilities (defaults):

   | Season | `pRain` (rain) | `pMud` (mud without rain) |
   |---|---|---|
   | spring | 0.35 | 0.6 |
   | summer | 0.15 | 0.2 |
   | autumn | 0.45 | 0.6 |
   | winter | 0 | 0 |

2. `createGame` rolls `weather:rain` with `pRain`; if no rain, `weather:mud` with `pMud` (both rolls always advance the RNG). Result `weather`: `rain` \| `mud` \| `dry`. P(mud only) = (1 − pRain) × pMud. A `setup` event `weather.set` (`event.weather.<weather>`, `refs.rolls`) is logged at step 0.
3. Surface mapping `mapSurface(data, season, weather, s)` (`model/selectors.ts`, also used by the renderer and previews): winter → `surfaceMap.winter` (grass/ground → snow, rock → icy_rock, scree → snow_scree); else `rain` → `surfaceMap.rain` (grass, ground → `mud`; rock → `wet_rock`; scree unchanged); `mud` → `surfaceMap.mud` (ground → `mud`); `dry` → unchanged. New surfaces `mud`, `wet_rock` (S§6.1, S§6.2).
4. Winter individual equipment (crampons, ice axe) is added to every member only in winter (`individual.json` → `winter`); the typical kit is the same in every season.

### 6.6 Loading

`src/data/load.ts` statically imports JSON (bundled by Vite) and casts to `GameData`. Validity is guaranteed by `tests/data/data.test.ts` in CI (cross-references, probability ranges, preset validity, locale coverage). Imported user scenarios are always validated at runtime (S§18.4).

---

## 7. Engine public API ✅ (`engine/index.ts`)

```ts
createEngine(data: GameData): Engine
interface Engine {
  data: GameData;
  createGame(scenario, opts?: { rolls?: RollScript }): GameState;  // throws ScenarioError on errors; rolls force weather:*
  getActionOptions(state, memberId): ActionOption[];     // S§9.3
  validatePlan(state, plan): PlanValidation;             // members[m]: main action; commands[m]: the command (CR-37) — ok, reasonKey, hints[], durationS
  resolveStep(state, plan, opts?): { state, events };    // S§8
  evaluateKnot(input): KnotEvaluation;                   // S§11.3
  getStats(state): Stats;                                // S§14
  getOutcome(state): Outcome;
  giveUp(state): GameState;                              // outcome "aborted"
  replay(scenario, history, opts?): GameState;
}
ResolveOptions = { rolls?: RollScript; checkInvariants?: boolean /* default true */ }
```

The engine has no module-level state; tests create engines with modified data freely.

---

## 8. Step resolution ✅ (`resolution/resolve.ts`, `resolution/tx.ts`)

### 8.1 Algorithm

1. If `outcome ≠ in_progress` return input unchanged.
2. When `checkInvariants`: deep-freeze the input. `state = structuredClone(input)`, `step += 1`.
3. **Snapshot** (§10.3): ids of attachments, belays, bases, knots, and members whose status is `fallen_caught`. Then every `fallen_caught` member becomes `ok`.
4. **Plan normalisation**: per active member (not injured / finished), in **team order**: at most **one command** (`kind: "command"`) plus **one main action** (any other kind; missing → `skip`) (CR-37). A command does not use the member's step: it is not a main action, does not make the member busy and is not counted in active / skipped steps. Commands still resolve in the `commands` phase (first).
5. **Forced skip**: members with `forcedSkipNextStep` lose all actions this step (flag cleared).
6. **Busy**: members whose action is not `skip | command | belay | stop_belay`. For each belay, `inactiveThisStep = busy(belayer)` (§11.3.3, D-20).
7. **Phases** in fixed order; inside a phase, actions in team order. Each action is **re-validated against the current state** — on failure emit `action.failed` and skip (it never throws).

   | # | Phase | Actions |
   |---|---|---|
   | 1 | `commands` | `command` |
   | 2 | `detach` | rockfall warnings (S§12.7) and forced-skip events first; then `detach`, `pass`, `pickup`, `wear` |
   | 3 | `build` | `make_base`, `tie_in`, `fix_rope` |
   | 4 | `attach` | `attach`, `clip` |
   | 5 | `belay` | `belay`, `stop_belay` |
   | 6 | `movement` | protocol pre-check (P1/P2/P4, S§13.2) then `move` |
   | 7 | `hazardRolls` | static-load rolls, terrain fall rolls, rock dislodge rolls |
   | 8 | `hazardResolution` | resolve each queued fall, then rockfall hits |
   | 9 | `bookkeeping` | stats, time, knot reveal, protocol window trim, outcome, `step.done` |

8. Invariants (`checkInvariants` + `checkTransition`) when enabled; violations throw `InvariantViolation`. The production app passes `checkInvariants: import.meta.env.DEV`.
9. Events are appended to `state.log` and returned.

### 8.2 StepTx

`StepTx` holds `data`, the mutable `state`, `phase`, `events`, `script`, `snapshot`, and per-step sets: `busy`, `moved` (member → from/to s), `uncoordinated`, `unwarnedRockThreat`, `falls` (queue of `{memberId, cause, params}`), `loadedKnots`, `durations`. Helpers: `emit`, `roll(key,p)`, `newId(prefix)`, `setLocation`, `violation(ruleId, member, params)` (counts + event + mistake), `mistake(key, params, ref)`.

### 8.3 Effectiveness rule

Hazard resolution accepts only protection present **both** in the snapshot and the current state (attachments, belays, bases). Protection created this step does not protect this step.

### 8.4 Duration

Step duration = `max(minStepSeconds, durations of executed actions)`; `simTimeS += duration`.

### 8.5 Outcome (bookkeeping)

1. Any member `injured` → `lost` (`event.game_lost_injury`).
2. Else every member in the finish zone (`s ≥ finishStart`) → `won`, all members `finished` (D-31).
3. Else `maxSteps` reached → `lost`.

---

## 9. Actions ✅ (`actions/defs.ts`)

### 9.1 Contract

```ts
interface ActionDef<P> {
  kind; phase;
  validate(ctx, m, p): { ok: true } | { ok: false; reasonKey; params? };  // physical only
  assess(ctx, m, p): Hint[];                                              // unsafe hints
  apply(tx, m, p): void;                                                  // effects + events
  duration(ctx, m, p): number;
}
```

`validateAction` first rejects: unknown member, `injured` member, game over, unknown kind. Registry: `ACTIONS`. Mapping to PRD actions: D-14.

### 9.2 Action catalogue

| Kind | Params | Preconditions (reason keys) | Effects | Duration (s) |
|---|---|---|---|---|
| `skip` | — | — | none | 0 |
| `command` | `command, recipient, misunderstood?` | known command / member | logs to `protocol.recent`, updates protocol flags (S§13), `event.command`; `misunderstood` → `event.command_misunderstood`, no effect | 5 |
| `move` | `toward: finish\|start, distanceM, targetS?` (`targetS` = the point chosen with a right-click, display only — the engine ignores it) | `distanceM > 0`; reach ≥ 0.05 (S§10) | moves `min(distanceM, reach)`, syncs harness/belay nodes, distance stats by elevation sign; Гарда clamp → `knot.garda_blocks_feed` | 30 + 1/deg above 15° (max angle at start/end) |
| `attach` | `method, target, knot?` | target exists; member within segment span ± adjacency or adjacent to base; grabbing only on segments; not the same target+method; one hand max; non-hand ≤ max(1, lanyard arms); items: harness worn (non-hand), lanyard with a free arm + any carabiner, or cord + carabiner; knot chosen for grabbing | creates attachment, items `in_use`; grabbing knot instance (`SELF_BELAY_GRAB`, eval input computed **before** items move); P3 if segment not ready | hand 5, lanyard 15, grabbing 45 (+10 per control knot) |
| `clip` | `ropeId, baseId` | member tied into the rope; adjacent to base; base has carabiner; not already on this rope; carabiner load < max | inserts `running` node next to the member's harness node | 15 |
| `tie_in` | `ropeId, knot, viaCarabiner` | harness worn; rope carried by member (deploy) or in use with a free **end** adjacent; not already tied in; locking carabiner if `viaCarabiner` | knot `TIE_IN_END`; deploy → nodes `[harness(m), free(m.pos)]`; else the free end becomes `member_harness` | 60 + 10/control |
| `fix_rope` | `ropeId, baseId, method: knot\|doubled, knot?` | adjacent to base; rope carried, or in use with a fixable node (own harness node at the base, a free end at the base, or a free end within the member's reach, D-17); `doubled` only for carried ropes; not while the member is on belay on that rope; base carabiner not full | knot context from base (S§11.2); carried+knot → `[fixed(base), free(thrown end)]`; carried+doubled → `[free, doubled(base), free]` ends thrown `len/2`; own harness node → replaced by fixed node (tie-in knot removed, D-16); udavka on carabiner-less base takes member's locking carabiner | knot 60 + 10/control; doubled 40 |
| `make_base` | `basePointId, construction: sling\|direct\|bolt` — the **only** way a base comes into existence | adjacent to base point; no base there; `bolt` only on bolt points and vice versa; sling + locking carabiner (`sling`), locking carabiner (`bolt`) | base with items `in_use` | 120 |
| `belay` | `climberId, braking: device\|knot, knot?, anchor: base\|body` | not self; **the belayer is self-secured at a base** (non-hand attachment to a base, `reason.belayer_not_secured`); climber tied in; a `free` node of a climber's rope adjacent to belayer; not already belaying them; `anchor: base` needs an attachment to a base; device + locking carabiner, or carabiner(s) for the knot (Гарда takes two if available) | belay relation; mode `lower` if belayer elevation ≤ climber; node becomes `belay`; braking knot `BELAY_LOWER/UPPER`; `distanceAtSetM` stored | 45 |
| `stop_belay` | `belayId` | member is the belayer | P6 if climber has not shouted `secured`; braking items back to belayer; node `free` | 10 |
| `detach` | `what` (below) | per target | per target | per target |
| `pass` | `toMemberId, itemIds (1–3)` | receiver adjacent, not injured; items carried by giver; receiver ≤ maxKg | items carried by receiver | 10 per item |
| `pickup` | `itemIds` | items `on_ground` adjacent; ≤ maxKg | carried | 5 per item |
| `wear` | `itemId` | carried wearable (harness, helmet, gloves, crampons), not already worn type; safe position (safe zone or attached to a base) | worn | 30 |

Worn items can never be taken off: there is no «Зняти» action (no taking off the helmet, harness, crampons or gloves). A worn item stays worn until the end of the game; it cannot be passed or dropped.

`detach.what` targets:

| Target | Preconditions | Effect | Duration |
|---|---|---|---|
| `attachment` | own attachment | items back to member, grabbing knot removed | 20 |
| `untie` (node) | node adjacent; own harness node — while on belay on that rope only if the climber is self-secured (non-hand attachment) **and** shouted `secured` («Сам!») in an earlier step (`climberSecured[belay] < current step`), else `reason.still_on_belay`; any `fixed` node, or `doubled` node when rope unused | node → `free`; knot removed; knot carabiners to member; untying own harness while on belay **ends those belays** (braking items back to the belayer, node `free`, `event.belay_ended_by_climber`) — the belayer below does not have to stop it first | 30 (+60 when `untieExtraThin` knot in `ANCHOR_THIN`) |
| `unclip` | `running` node adjacent | node removed | 20 |
| `dismantle_base` | adjacent; no rope node / attachment / belay uses it; ≤ maxKg | base items carried by member | 60 |
| `coil` | every node adjacent; all nodes `free`; nobody tied/attached/belaying; ≤ maxKg | layout removed, rope carried | 60 |
| `pull_down` | rope has a `doubled` node or a `fixed` node with a `releasable` knot; member below that anchor along the rope span (D-18); rope unused; no `running` nodes; ≤ maxKg | rope (+ udavka carabiner) carried by member; base stays | 30 |

### 9.3 Action options for the UI (`actions/options.ts`)

`getActionOptions(ctx, m)` returns `ActionOption[]`:
`{ id, group (move|attach|tie|base|belay|command|detach|items|skip), labelKey, labelParams, params (template), needs?: { knot: {context} | command | items: {choices, max} }, enabled, reasonKey?, reasonParams? }`.

1. Every option is validated with a probe (placeholder knot `providnyk_visimka_odnym` / `uiaa`, smallest item set) so disabled options carry the reason.
2. Move options: `move:finish` and `move:start`; label `action.move_up|move_down|move_flat_<toward>` from the elevation change 0.5 m ahead (D-11). They need no parameter: `distanceM` = the full reach this step (no metre selection). Moving to an exact point is done with a right-click on the hill view (S§19.3.9).
3. Generated per context: segment attach (grab, lanyard, hand), base attach, clip, tie-in per rope, fix per rope×base (+ doubled for coiled ropes), make base per base point × construction, belay per climber × braking with `anchor: base` only — **only when the member is clipped to a base and only enabled ones** (no belay options at all otherwise; body belay stays valid in the engine but is not offered, CR-33), stop belay, command, detach per attachment / node / rope / base, pass per adjacent member, pickup, wear. There is no drop («Покласти на землю») action: items reach the ground only through base failures; `pickup` stays. Move options are still generated (reasons, tests) but the action picker does not show them (S§19.3.5).

### 9.4 Hints (`assess`, learning mode only)

`hint.move_unprotected` (≥25° and not protected), `hint.belay_not_effective_yet`, `hint.wait_belay_ready`, `hint.crowded_segment`, `hint.hand_no_protection`, `hint.carabiner_slides`, `hint.wait_fixed_rope_ready`, knot evaluation messages, `hint.small_tree_anchor`, `knot.garda_blocks_feed`, `hint.body_belay_steep`, `hint.belay_next_step`, `hint.wait_secured`, `hint.detach_last_protection`. "Protected" = any non-hand attachment or being a belay climber.

---

## 10. Movement ✅ (`actions/movement.ts`)

1. **Terrain budget** (`terrainReach`): budget fraction 1.0 consumed segment by segment: `full = band(angle).moveM × weightFactor × (grabbingKnot ? 0.7 : 1) × surfaceFactor × (uphill ? moveModifiers.uphill : 1)`, where uphill = the segment rises in the move direction (`sign × dir > 0`); crossing a boundary uses `toBoundary / full` of the budget (D-12).
2. **Weight factor**: total ≤ comfort → 1; ≤ heavy → 0.85; ≤ max → 0.7 (S§17.4).
3. **Constraints** (`constraintReach`, minimum wins, with reason key):
   1. route ends → `reason.route_end`;
   2. attached to a base → stay within adjacency → `reason.secured_to_base`;
   3. attached to a segment → stay within its span → `reason.segment_end`;
   4. tied into a rope → used length ≤ rope length (binary search, convex) → `reason.rope_too_short`;
   5. Гарда lower belay → distance from belayer ≤ `distanceAtSetM + slackM` → `reason.garda_blocks_feed` (D-19).
4. `reach = min(terrain, constraints)` rounded down to 0.01 m.

---

## 11. Knots ✅

### 11.1 Catalogue (`knots.json`)

`KnotDef = { id, nameKey, descriptionKey, enRef, category (join_same|join_diff|loop|attach_support|grabbing|braking), controlKnotsRequired, minTurns?, controlNotNeededFromTurns?, constantLoadOnly?, endsMustBeJoined?, diameterRatio?, minSupport?: "thick", requires: ("locking_carabiner"|"two_carabiners")[], releasable?, untieExtraThin?, feedsInLowerBelay?, icon }`. 24 knots per PRD §13.2. Knots are shown by **name as text** (no knot art).

### 11.2 Context derivation (`knots/instance.ts`)

| Action | Context |
|---|---|
| `tie_in` | `TIE_IN_END` |
| `fix_rope` | base has carabiner → `ANCHOR_CARABINER`; else small tree → `ANCHOR_THIN`; rock outcrop → `ANCHOR_ROCK` (direct knots around rock are one rating step worse than around a tree — prefer the base carabiner); else (large tree) `ANCHOR_THICK` |
| `fix_rope` direct, ratings | `ANCHOR_CARABINER`: Провідник вісімка («8К», figure-eight on a carabiner), Стремено correct; `ANCHOR_THICK` (large tree): Булінь, Зустрічна вісімка (tied around the tree), Штик (товста), Карабінна удавка correct; `ANCHOR_ROCK`: the same knots one step worse |
| `attach` grabbing | `SELF_BELAY_GRAB` — every knot of category `grabbing` (Прусик, Прусик одним, Австрійський схоплюючий, Бахмана) is rated `correct` (any friction hitch serves as self-belay; diameter / control modifiers still apply) |
| `belay` knot | `BELAY_LOWER` / `BELAY_UPPER` by mode |
| pre-tied cord loop | `LOOP_CORD` |
| (no action yet) | `TIE_IN_MIDDLE`, `JOIN_SAME`, `JOIN_DIFF` (D-15) |

Support: rock outcrop / large tree = thick; small tree = thin; bolt = none. Anchor kind for failure: `tree_large | tree_small | rock_outcrop | bolt`.

### 11.3 `evaluateKnot(data, input)`

Input: `knotId, context, control, turns, ropeDiameterMm?, cordDiameterMm?, cordLooped?, lockingCarabiners, carabiners, support?, loadType?`.

1. Base rating = context entry, conditional entries apply `otherwise` without a locking carabiner, unknown → context default.
2. Base probabilities from `hazards.knots.ratings`.
3. Additive modifiers in this order (each adds a message key + rule id): missing control (if required and not waived by `controlNotNeededFromTurns`); single control → hint only; turns below `minTurns`; constant-load-only under shock; diameter ratio outside [min, max] (`cord_too_thick` / `cord_too_thin`); unlooped cord for `endsMustBeJoined`; missing locking carabiner; missing second carabiner; thin support for `minSupport: thick`.
4. Cap at 1.0, round to 1e-6. Output `{ rating, failProbStatic, failProbShock, messages[] }`; first message is always `knot.rating.<rating>`.
5. The same function powers UI hints and engine rolls.

### 11.4 Knot instance lifecycle

`createKnot` evaluates, stores, counts stats (`knots.total`, by rating, `missingControl`, per member, `knotHistory`), emits `knot.tied` (`event.knot_tied_rated` in learning, `event.knot_tied` in exam), and logs mistakes for non-correct knots. `revealed` is `true` in learning; in exam it becomes `true` when the knot is loaded (rolled) (D-30).

### 11.5 Functional effects

1. Гарда in lower belay: S§10.3.5.
2. Static load: S§12.5.
3. Extra untie time: S§9.2 (`untieExtraThin`).

---

## 12. Hazards ✅ (`hazards/falls.ts`, `hazards/rockfall.ts`)

### 12.1 Terrain fall chance (movers only)

`p = base(angle) × surface × Π mistakes × method`, capped at `pFallMax`, where `angle` is the steepest crossed angle and `surface` that of the steepest crossed segment (season- and weather-mapped, S§6.5). Mistakes: winter surface ≥25° without worn crampons; weight band over/max; `uncoordinated` (P1/P2 this step); member on a segment with more than `maxMembersPerSegment`; unwarned-rock threat. Method: hand attachment ×0.5. Members attached to a base do not roll. Members attached with a **grabbing knot (friction hitch) to a fixed-rope segment** do not roll either when the steepest crossed angle is below `safeGrabbingMaxDeg` (55°): movement along a fixed rope on a friction hitch is safe. Roll key `fall:terrain:<m>`. Learning mode emits `event.fall_chance` when the roll misses and mistakes applied.

### 12.2 Fall resolution order (`resolveFall`)

1. Count `falls.total`, emit `event.fall.<cause>` (`terrain`, `knot_failed`, `pulled`).
2. Try every attachment in snapshot ∩ current (non-hand), then every belay as climber. First that holds wins; else unprotected.

### 12.3 Protection chains

`rollChain` rolls elements in order and stops at the first failure (emits `event.chain_failed`, runs the element's failure effect).

| Protection | Elements | Holds → result |
|---|---|---|
| Attachment to base | base anchor | caught in place |
| Grabbing knot on segment | grabbing knot (shock), [non-locking carabiner 0.1], fixed-node knots of both segment ends, base anchors of both ends | caught in place, `fallen_caught`, no injury |
| Lanyard carabiner on segment | [non-locking carabiner], end knots, end anchors | slide to segment's lower node; injury 0.1 if slide ≥ 8 m and steepest ≥ 35° |
| Belay | tie-in knot, anchors of running bases, braking knot (if knot), belayer base anchor (if anchored) | caught; see below |

Belay result: protection point `pp` = highest running base below the climber (elevation, snapshot bases), else the belayer. Upper belay (or belayer above): fall length = `slackM`, end = climber − slack downhill. Lower belay: length = `2·|p − pp| + slackM`, end = `pp − slackM` downhill. Injury chance grows with the fall length: `p = min(longFall.max, longFall.perM[rock-type ? rock : default] × max(0, length − longFall.freeM)) × (helmet ? 0.6 : 1)`; rolled when p > 0. Without intermediate points a fall high above the belayer is long and dangerous; every clipped intermediate point (running base) shortens it. **A belay protects only after its belayer shouted `belay_ready`** («Страховка готова!») — before that the belay is skipped in the chain (`event.belay_not_ready`), so the fall is resolved by other protection or is unprotected. P7 if no `hold` this/previous step. Body-anchored belay on ≥25° at the belayer: roll 0.7 `belayer_pulled:<b>`; the belayer falls recursively (depth ≤ team size); if their fall is unprotected/injured, the climber is unprotected (D-26).

Failure effects: grabbing knot / carabiner → attachment removed (items back to member); anchor knot → node `free`; base anchor → `removeBase` (items on ground, nodes free, attachments removed, belays to body); tie-in knot → harness node `free`; braking knot → belay removed.

### 12.4 Unprotected slide

Slide downhill segment by segment until a segment with angle < 20° or a flat zone; stop earlier where a rope the member is tied into becomes tight (D-28). Injury if distance ≥ 5 m and steepest ≥ 30°: p 0.9 (rock/icy at start 1.0). Otherwise the member continues from the stop point.

### 12.5 Static load (§13.6.2, D-25)

1. Each member who moved over steepest ≥ `staticLoadDeg` while attached to a segment — **except with a grabbing knot** (friction hitch: the rope stays fixed) — rolls `failProbStatic` of each fixed end knot (`static:<m>:knot:<k>`); failure frees the node and queues a fall (`knot_failed`).
2. Each member who was `fallen_caught` at step start rolls their tie-in knot's static probability.

### 12.6 Injury

`injuryRoll(key injury:<m>)` → `injured` status, `stats.injuries`, mistake entry, outcome `lost` at bookkeeping.

### 12.7 Rockfall timeline

1. Movement phase of step N: each mover whose end segment surface has `pDislodge` rolls `rockfall:dislodge:<m>`. Threatened = active members with lower elevation.
2. If `rock` was shouted in step N → warned: threatened get `forcedSkipNextStep`. Else, if anyone is threatened → pending.
3. Step N+1 detach phase: pending + `rock` shouted in N+1 → warned, threatened lose their N+1 actions (forced skip). Still unwarned → threatened members get the ×3 fall factor if they move.
4. Step N+1 hazard resolution: unwarned pending rocks → P5 + `rockfall:hit:<r>:<m>` with `pHit`; a hit rolls injury `0.8 × (helmet ? 0.25 : 1)`.

---

## 13. Commands and protocol ✅

### 13.1 Commands

`belay_ready, go, stop, take_in, give_slack, secured, fixed_rope_ready, fixed_rope_free, rock, hold, understood` («Зрозумів.» — acknowledges that the recipient heard an instruction; logged, no protocol effect, CR-36). Text is always shown in Ukrainian (`cmd.<key>`), English hint `cmd.<key>.hint`, wrong phrasings `cmd.wrong.<key>.1|2`.

### 13.2 Protocol state and rules

`ProtocolState = { recent[{step, memberId, command, recipient}] (kept 2 steps), belayReady{belayId: step}, climberGo{belayId: step}, climberSecured{belayId: step}, readySegments{segmentKey: step}, flagged{} }`.

| Rule | Trigger | Physical |
|---|---|---|
| P1 | climber `move`s while on a belay that existed at step start (snapshot) with no `belay_ready` by the belayer since the belay was set (once per belay). A belay set up this step does not trigger P1 (the belayer can shout only from the next step) | ×1.5 fall; and the belay does not protect (S§12.3) |
| P2 | same, without `go` by the climber (once per belay) | ×1.5 fall |
| P3 | `attach` to a segment not in `readySegments` | — |
| P4 | a mover's segment has more members than `maxMembersPerSegment` (once per segment per step) | ×1.3 fall |
| P5 | unwarned rock resolves | hits |
| P6 | `stop_belay` before the climber's `secured` (a climber who untied after `secured` ends the belay without P6) | — |
| P7 | fall caught on belay without `hold` this/previous step | — |

`fixed_rope_ready` marks **all** segments existing at that moment as ready. `secured` / `go` / `belay_ready` apply to all belays where the shouter has the corresponding role.

### 13.3 Language practice (§12.2.3)

UI-only: the command dialog offers 3 shuffled phrasings (deterministic by step + member); a wrong pick sends `misunderstood: true`.

---

## 14. Statistics ✅ (`stats/stats.ts`)

`StatsCounters`: `steps`; `falls {total, selfBelay, belay, unprotected}`; `injuries[{memberId, causeKey, params}]`; `knots {total, correct, acceptable, wrong, dangerous, missingControl, preTied}`; `commands {issued, violations{P*}}`; `rockfall {total, warned, hits}`; `members{ activeSteps, skippedSteps, forcedSkips, distanceUpM, distanceDownM, falls, knots{rating}, commands, maxWeightKg, overloadedSteps }`; `knotHistory[]`; `mistakes[{step, key, params, ref}]`.

`computeStats` adds `outcome`, `simTimeS` and `itemsLeft`: items not carried/worn whose position is outside the finish zone (a rope counts as left unless all nodes are in the finish zone) (D-32). Active step = an executed non-skip action; skipped = skip or failed action; forced skips counted separately.

---

## 15. Invariants ✅ (`invariants/invariants.ts`)

`checkInvariants(data, state)`:
1. 9.2.2 item id set equals `itemIds`.
2. 9.2.1 every location target exists and lists the item (two-way); worn only for wearables; every rope layout's rope is `in_use` in that layout; base/attachment item lists match locations.
3. 9.2.4 rope used length ≤ length.
4. 9.2.5 carabiner load ≤ max (S§9.2: ropes in a base carabiner; lanyards not counted, D-23).
5. 9.5.2.4 no member above `maxKg`.

`checkTransition(data, prev, next)` — 9.2.3: an item newly held by a member must have been within adjacency of that member at step start (exceptions: pulled-down ropes, knot carabiners, base failures).

---

## 16. Randomness ✅ (`rng/rng.ts`)

1. mulberry32, state in `GameState.rng.s`; `createRng(seed)`.
2. `roll(rng, key, p, script)` always advances the PRNG, then uses the scripted outcome if any (`RollScript = Record<string, boolean>`, exact keys or prefix patterns ending in `*`, longest prefix wins).
3. Roll keys: `fall:terrain:<m>`, `chain:<m>:<attachmentId|belayId>:knot:<k>:shock`, `chain:<m>:<id>:carabiner`, `chain:<m>:<id>:base:<b>`, `belayer_pulled:<m>`, `injury:<m>`, `static:<m>:knot:<k>`, `rockfall:dislodge:<m>`, `rockfall:hit:<r>:<m>`, `weather:rain`, `weather:mud` (createGame). `replay` passes `opts.rolls` to `createGame` too. Each roll's `{key, p, roll, hit}` goes into the explaining event's `refs.rolls`.

---

## 17. Scenario creation, validation, kits, weight ✅

### 17.1 `createGame`

Validates (errors throw `ScenarioError`), clones the scenario, places every member at the start-zone base point if the hill has one, otherwise at the middle of the start zone (D-13), creates no bases, creates every member's individual equipment from `individualKit(data, season)` (ids `<type>@<memberId>`, or `<type>@<memberId>#<n>` when the entry count is > 1; configured items of individual types, e.g. from old files, are ignored; the two prusik loops count as pre-tied knots), creates `ItemState`s only for assigned items with `weightKg = defaultWeight(scenario.weights, type, props)` and sets every member's `baseWeightKg = scenario.weights.backpackBaseKg`, creates the RNG, empty protocol and stats, counts pre-tied cord loops as pre-tied knots (no instance, D-29), records initial weights.

### 17.2 Validation (`scenario/validate.ts`) — `Issue = { level, key, params }`

1. Hill: section length/angle ranges, total length, configured base points inside the route, tree reference; warning for steep long sections without a base point. The only mandatory base point is **one in the finish zone** (`validate.no_finish_base`, error) — the team must be able to build a base there to finish the route safely. Base points in the start and summit zones are optional (`validate.no_start_base` and `validate.no_summit_base` are removed). A hill with zero intermediate base points is valid.
2. Team: size, unique ids, non-empty names. No role checks (`validate.one_leader` / `validate.one_last` are removed).
3. Equipment: error over `maxKg`, error wearing a non-wearable; warnings: heavy, no locking pear-shaped carabiner (`validate.no_hms`), no rope or rope shorter than the longest section, unassigned items.

### 17.3 Kits (`scenario/kit.ts`)

1. `defaultWeight(weights, type, props)`: rope `lengthM × ropePerMeterKg × (d/10)²` (D-38); cord `lengthM × cordPerMeterKg`; sling by `lengthCm` from `slingKg`; carabiner by `locking`; device by `model`; others the per-type value. Weights are never stored per item in a configuration.
2. `makeItem(data, id, type, props, assignedTo)` merges catalog defaults (props only).
3. `memberLoadKg(data, scenario, memberId)` = `backpackBaseKg` + weight of the individual equipment for `scenario.season` + Σ `defaultWeight(scenario.weights, …)` of the member's assigned items (configured individual items are skipped); used by configuration validation and screens.
4. `buildKit(data, kit, team, season)` — `typical.json` (team gear only — individual equipment is automatic): per member 2 locking pear-shaped carabiners (carried); team: 2 × 50 m 10 mm dynamic ropes spread over the middle members, 4 slings + 4 locking carabiners to the **first member in team order** (`assign: first`). `assign: last` remains available for data.

### 17.4 Weight

Total = `baseWeightKg` (= `weights.backpackBaseKg`, the same for every member) + worn and carried gear (including the individual equipment); `in_use` and `on_ground` items count for nobody. Bands: comfort ≤25, heavy ≤30, over ≤35, max >35 (impossible).

---

## 18. Application layer ✅ (`src/app`)

### 18.1 Store (`store.ts`, Preact signals)

| Signal | Content |
|---|---|
| `route` | `{ name: RouteName, back? }` — `menu, obstacle, hill, season, team, equipment, readiness, game, results, glossary, knots, settings, scenarios, library, hill_editor` |
| `draft` | `Scenario` being configured (`defaultScenario()`: default preset, 5 members with random distinct sprite rows, typical kit, random seed). Its `weights` is replaced by the current settings wherever it is shown or validated (`withWeights(scenario)`) |
| `editingHill` | `HillConfig \| null` — the hill open in the obstacle constructor (never the draft) |
| `session` | `{ scenario, state, history, plan: Record<memberId, ActionParams> (main action), commands: Record<memberId, ActionParams> (command slot, CR-37), goals: Record<memberId, number> (target `s` of a right-click move, not saved), prevState, lastEvents, startedAt, realTimeMs }` |
| `selectedMember`, `animating` | UI/renderer coordination |
| `lastResult` | `ResultRecord` of the finished game |

Also: `engine` (single instance), `data`, `go(name, back?)`, `updateDraft`, `defaultTeam`, `DEFAULT_NAMES`, `randomFreeRow(used)`.

### 18.2 Controller (`controller.ts`)

`startGame(scenario)` (writes `scenario.weights = settings.weights` before `createGame`, so the saved game and its replay keep the weights it started with), `continueGame()` (dev: replays history and warns on mismatch), `setPlannedAction(m, params|null)` (also clears the member's goal), `planMoveTo(m, s)` (S§19.3.9), `executeStep()` (validates, drops invalid, resolves, stores, re-plans goal moves for the next step, sets `animating` when there are visual events, autosaves, finishes on game end), `giveUp()`, `replaySameScenario()`, `editScenario()` (opens the play flow at the hill choice, S§19.2.3), `savedScenarios/saveScenario/deleteScenario`, `resultsHistory()`, `hasSavedGame()`.

### 18.3 Persistence (`persistence/storage.ts`)

Records are stored as `{ schemaVersion: 1, data }`; `migrate()` upgrades step by step; every access is wrapped in try/catch.

| Key | Content |
|---|---|
| `zgr.v1.settings` | `Settings` |
| `zgr.v1.scenarios` | saved scenarios |
| `zgr.v1.current` | `{ scenario, history, state, savedAt, realTimeMs }` (removed when the game ends) |
| `zgr.v1.results` | last 50 `ResultRecord`s |
| `zgr.v1.obstacles` | user-made hills of the obstacle library (`HillConfig[]`) |

`downloadJson(filename, data)` and `pickJsonFile()` handle export/import.

### 18.4 Scenario import

`importScenario.ts → validateScenarioJson(x)`: Ajv against `scenario.schema.json`, then `validateScenario` errors. The schema still allows a legacy `member.role` (any of the old values), legacy `member.baseWeightKg`, `item.weightKg`, `props.baseWeightKg` and harness / helmet items; `validateScenarioJson` strips them from the returned scenario and fills `weights` from the current settings (an imported `weights` is ignored: weights come from Settings only).

### 18.5 Settings (`settings.ts`)

`{ locale: uk|en, termHints: boolean|null (null = auto: on in EN), phraseChoice, pixelScale: 0(auto)|2|3|4, sound (MVP off), animationSpeed: 1|2|4, weights: EquipmentWeights }`; persisted by an effect that also sets `locale` and `<html lang>`. `weights` starts as `gameData.weights` and stored values are merged over it key by key. Settings is the **only** place where the base backpack weight (10–25 kg, default 15) and the standard equipment weights (0–5 kg per item, 0.01–0.2 kg/m for rope and cord) are set; no configuration screen edits weights.

### 18.6 Obstacle library (`app/obstacles.ts`)

1. Obstacles are **predefined before the game**. The library is the list of playable hills: built-in presets (`hillPresets`, read-only, S§6.4) followed by user-made hills from `zgr.v1.obstacles`.
2. API: `libraryHills(): HillConfig[]` (presets + user hills), `userHills()`, `saveUserHill(hill)` (insert or replace by id), `deleteUserHill(id)`, `isPreset(id)`. The display name is `hillTitle(hill)` in `ui/format.ts` (`nameKey` → `t`, else `name`, else id), because `app` does not depend on `i18n`.
3. A user hill must pass `validateHill` without errors to be saved. User hills always have `name` (non-empty) and an id with prefix `hill_`; they never have `nameKey`.
4. Only hills from the library can be played; the play flow never edits a hill. Deleting a library hill does not affect saved scenarios or results (they hold copies).

---

## 19. User interface ✅ (`src/ui`)

### 19.1 Shell

`App.tsx` switches on `route`, reading `locale` so a language switch re-renders everything. Each screen renders `TopBar` (brand → menu, optional back, UA/EN toggle). Components (`components/common.tsx`): `LangToggle`, `TopBar`, `Term` (bilingual hint: EN "Fixed rope (перила)" when hints are on, UK shows English on hover), `Modal` (focus trap, Esc), `WeightBar` (base vs gear, comfort/heavy ticks, band colour), `Sprite` (team sheet frame via CSS background), `Msg`. Styles: `styles.css` (tokens from the summer palette), `config.css`, `game.css`.

### 19.2 Configuration flow (`screens/`, `cfgShared.tsx` FlowSteps/FlowNav)

Play flow (`FLOW`): `obstacle → hill → season → team → equipment → readiness`. The obstacle constructor is **not** part of the play flow.

1. `MainMenu`: key art, Play («Грати», fresh draft → `obstacle`), Continue (if a save exists), **Obstacle constructor** («Конструктор перешкод» → `library`), Scenarios, Glossary, Knots, Settings.
2. `ObstacleSelect`: Hill active; rock/ravine/river locked «Незабаром»; disabled "Add to chain". Choosing Hill opens the list of predefined hills.
3. `HillSelect` (route `hill`): the obstacle library (S§18.6) as cards — title, built-in / «мій» badge, small SVG side-view preview in the draft season, total length, height gain, steepest angle, route type, number of base spots. Clicking a card copies the hill into `draft.route.obstacles[0]` (selected card highlighted); Next is enabled when a hill is selected. A link «Відкрити конструктор» opens `library` (back → `hill`). No hill editing here.
4. `ObstacleLibrary` (route `library`): the same list with actions — built-in hill: «Копіювати й змінити» (new user hill `hill_*`, name «<title> (копія)»); user hill: Edit, Duplicate, Delete (confirm); «Новий схил» (copy of the default preset with a new id and name). Edit/new open `hill_editor` with the hill in `editingHill`.
5. `HillEditor` (route `hill_editor`, the former `HillConfig` editor): name field, route type, section editors (sliders, surface, reorder/add/remove; descent side + summit zone), zone sizes, tree and **base spot** lists, SVG live preview from engine geometry (summer/winter preview toggle, click-to-add tree/base spot), `validateHill` messages, length / height gain / steepest. «Зберегти» (blocked by errors or an empty name) stores the hill with `saveUserHill` and returns to `library`; «Скасувати» discards changes. Built-in presets are never edited in place.
6. `SeasonMode`: four seasons (весна, літо, осінь, зима), each with its description and «Дощ: n % · Багнюка: n %» from `seasons.json`; mode, optional "refresh typical kit", seed and step limit (advanced). No weights here.
7. `Team`: size 2–7; per member card: sprite (read-only), name. No base weight input (set in Settings). No role select and no role hint. No appearance picker: a new member gets `randomFreeRow` (a random sprite row 0–6 not used by another member; with ≤ 7 members a free row always exists, so all members always look different and the "same look" warning is removed). «Випадково» stays: it shuffles names and gives every member a new random distinct row. The member number (`#n`, team order) is a badge in the **top-right corner of the card**, not next to / under the sprite.
8. `Equipment`: the pool lists **groups**, not single items. A group = all items with equal `type` and `props` (key: type + canonical JSON of props). Each group row: icon, label, **count** input (1–50; raising it adds unassigned copies, lowering it removes unassigned copies first, then assigned ones from the last member in team order), per-type property editor (applies to every item of the group; refused with `ui.cfg.eq.err_over_max` if any member would exceed `maxKg`), the per-item weight **read-only** from Settings, distribution line «не взято: n · <member> ×k …», assign select (assigns **one** free item of the group; disabled when none is free), remove-group button. Selecting a group and clicking a member column also assigns one free item (worn if wearable and the member does not wear that type yet). Member columns show only their **carried** items, grouped the same way («Карабін муфт.», «Петля (строп) 120 см»); the «Одягнено» label and worn items are not shown. Carried groups have quantity controls **− n +**: − returns one piece of the group to the pool (unassigned); + gives the member one more piece — a free piece of the group if there is one, otherwise a new copy (the group count grows); + is refused with `ui.cfg.eq.err_over_max` if the member would exceed `maxKg`; the shown quantity always equals the member's pieces of that group. Individual equipment never appears in the pool, the catalog or the member lists (S§4.2); the weight bar still includes it. Catalog: rope, sling, carabiner. Carabiner labels never show the shape («HMS»): «Карабін муфт.» / «Карабін без муфти»; the shape option is labelled «грушоподібний» / «D-подібний» / «овальний». The main rope diameter is fixed at **10 мм** (default in `equipment.json`); the rope editor has no diameter input (length, kind, colour only). Catalog add with count creates/extends a group; «Типовий набір» (learning only). The engine and saved scenarios still hold individual `ItemConfig`s (equipment accountability is unchanged); grouping is presentation only.
9. `Readiness`: summary, issues (learning: warnings + errors; exam: errors), weight distribution + rebalancing tip (learning), save, export JSON, Start (blocked by errors).
10. `Scenarios`: saved list (open → readiness, export, delete), import JSON.

### 19.3 Game screen

1. Layout: CSS grid — top bar (hill name, season, weather chip «сухо / багнюка / дощ», mode, Glossary, Knots, Give up with confirm, UA/EN), hill view (`mountHillView`), journal (right), member cards + step controls (bottom).
2. Keyboard: `1–9` select member, `A`/`ф` open the action picker, `Enter` execute step (disabled while animating), `Esc` close dialogs. Canvas-focused keys: arrows pan, `+/−` zoom, `F` follow, `Space` skip animation.
3. `MemberCards`: portrait (hang/injured/celebrate sheets by status), number + name, status **only when not fine** (no «у нормі»: shown for `fallen_caught`, `injured`, `finished`, CR-41), `s` / zone / angle, attachments, tie-ins, belays, **team gear only as icons** — one `ItemIcon` per group of equal items with «×N» when N > 1, tooltip = item name — plus one «Особисте спорядження» icon whose tooltip lists the member's individual set (CR-40), weight bar, planned action label, planned command line («Команда «…»» with ✕), invalid reason, learning hints.
4. `Journal`: `state.log` grouped by step (newest first), severity styles, `formatEvent`; exam mode hides hint-level entries and fall chances.
5. `ActionPicker`: stages `list → knot | command | items → confirm (learning hints) → setPlannedAction`. Movement is not in the picker: members move only by a right-click on the hill (S§19.3.9). The items group has no drop. Disabled options show their reason text.
6. `KnotDialog`: all 24 knots grouped by category as **text tiles**; **no control-knot selector** — the chosen knot always gets its control knots tied correctly (`control = controlKnotsRequired > 0 ? "double" : "none"`, `controlFor(def)` in `knots/evaluate.ts`); turns (only with `minTurns`); "via locking carabiner" for tie-in; learning mode shows live `evaluateKnot` rating, failure %, messages and description; exam mode shows none.
7. `CommandDialog`: Ukrainian text always, English hint in EN; recipient; phrase-choice mode. «Страховка готова!» is offered only to a member who is the belayer of a belay that **already exists** (set up in an earlier step), never while the belay is being set up (CR-34). A chosen command goes to the member's command slot; it does not replace the planned action (CR-37).
8. Step controls: step number, simulated time (`hh:mm:ss`), planned step duration, «Виконати крок».
11. **Hover command button** (CR-35): when the pointer is over a member sprite (the hand cursor already shows it is clickable), a small speech-bubble button appears above the member's label; clicking it selects the member and opens the `CommandDialog` for them (store signal `commandDialogFor`). It hides 0.6 s after the pointer leaves both the member and the button, during animations and when the game is over.
9. **Right-click move**: a right-click on a point of the hill view sends the **selected** member to that point (`planMoveTo(m, s)`):
   1. Ignored while animating, when the game is over, or for injured / finished members. `s` is clamped to the route; a click within 0.05 m of the member clears their goal.
   2. Sets `goals[m] = s` and plans `{ kind: "move", toward, distanceM: |s − pos|, targetS: s }`. The engine moves `min(distanceM, reach)` (S§9.2), so a far point takes several steps.
   3. After each step the controller re-plans the move toward the goal for the next step while the member is `ok`, the step brought them closer and they are not yet within 0.05 m; otherwise the goal is cleared. Choosing any other action for the member (picker, skip, Esc) clears the goal.
   4. The member card shows «Іти до {s} м»; the planned move is validated like any action (invalid reason / learning hints on the card).
10. **Station icon** (left-click): a left-click (no drag) on a base spot **or on its support** — the tree (within half the tree's width: small 1 m, large 1.7 m) or rock outcrop (1.5 m), not only the spot marker (CR-38) — when the selected member is adjacent to it, shows a station icon **with a short text label** above the spot (`bridge.stationAt(basePointId)` → `{ label, enabled, reason?, plan }`):
    1. Spot without a base → label «Організувати базу»; plans `make_base` on a **sling + locking carabiner by default** (bolt on bolts). If the member lacks the sling or the carabiner, a warning dialog «Немає петлі / муфтованого карабіна — базу буде організовано без петлі (мотузку в'язати прямо до опори)» asks «Все одно організувати» / «Скасувати»; confirming plans the direct base (CR-39). The action picker shows the same warning before a direct base is planned.
    2. Built base through which the selected member can clip the rope they are tied into (a `clip` option, e.g. the leader on lower belay) → label «Організувати проміжний пункт страховки»; plans `clip` (the rope runs through the base carabiner as an intermediate protection point, S§12.3).
    3. Enabled → clicking the icon plans the action and hides it; disabled → grey icon with the reason under the label. A click anywhere else hides it.

### 19.4 Results and references

1. `Results`: outcome banner; team totals; per-member table; learning summary (`stats.mistakes`) with links to knot reference / glossary; knot history with ratings (revealed here in exam mode); previous attempts of the same scenario; Replay, Edit, Menu, Export JSON.
2. `Glossary`: all `term.*` with Ukrainian, English and meaning, plus the command list.
3. `KnotReference`: every knot (name, EN reference, category, control knots, turns, requirements, description, ratings per context).
4. `Settings`: language, term hints, phrase choice, pixel scale, animation speed, sound, and **Weights**: base backpack weight and one input per standard equipment weight (S§18.5), with «Скинути до стандартних» (reset to `gameData.weights`). Changes apply to the next started game; a game in progress keeps the weights it started with.

### 19.5 Text helpers (`format.ts`, `dialogs/labels.ts`)

`localizeParams` maps raw params: `member/climber/belayer/to` → names; `knot` → knot name; `command` → Ukrainian command; `reason`, `element`, `cause` → translated keys; `rating`, `item`, `context`, `action`, `anchor` → their namespaces; `recipient: all` → «всім»; `f0…fn` fall factors → "label ×value" list. Ropes are labelled "мотузка N", bases "база на X м".

---

## 20. Rendering ✅ (`src/game`)

1. **Mount**: `mountHillView(container)` creates a Phaser game after fonts load; `input.keyboard` disabled (keys handled on the focused canvas). Integer zoom = `settings.pixelScale` or the largest zoom that still shows ≥ 400×200 logical px; the logical size is `container / zoom` (adaptive, recomputed by a `ResizeObserver`). Overlay DOM buttons: 1×, 2×, follow, skip. The browser context menu is disabled on the canvas; a **right-click** on the hill calls `bridge.moveTo(s)` with `s = world.sAtX(pointer.worldX)` (binary search, x is monotonic in s). Goal points are drawn as a small yellow cross with the member number. Effects on `session`, `selectedMember`, `settings`, `locale` call `hill.refresh()`. Unmount disposes everything and sets `animating=false`.
2. **Scenes**: `BackgroundScene` (sky gradient with dithering, generated far/mid/near mountain layers with scroll factors 0.1/0.3/0.6 — the parallax follows the camera **in the same frame** (`bg.follow(camera)` from `HillScene.update`), layer textures are keyed by season, weather **and view height** and are `PARALLAX_PAD` (64 px) taller than the view so a vertical shift never shows a gap; the vertical shift is clamped to the pad (CR-32), one palette per season (spring: fresh light blue sky and light green hills; summer: deep blue sky, sun and clouds; autumn: warm hazy sky, ochre / rust hills; winter: pale sky and snowfall); weather `rain` switches to a grey sky without sun and adds falling rain streaks; `mud` has no sky change, `VIEW_W/VIEW_H` live-bound to the adaptive size) and `HillScene` (world, camera, members, ropes, timeline).
3. **World mapping** (`render/world.ts`): 12 px per metre; margins 160 px sides, 170 px top, 90 px bottom; harness at feet −12 px, hands −14 px; world y down.
4. **Terrain** (`render/terrain.ts`): per geometry segment a masked `TileSprite` fill (128×128 textures) and a rotated edge strip (128×32), flat zones extended; winter: snow drawn flat with dithering, icy rock / snowy scree tinted with a snow band; `mud` = ground texture tinted brown with darker puddle dots, `wet_rock` = rock texture tinted blue-grey. Season tint on grass and trees: spring — flowers (white / pink / yellow pixels) along grass edges and a light green tree tint; autumn — ochre grass tint and orange / rust deciduous trees. Previews (`HillEditor`, `HillSelect`) use the same season / surface colours. Trees, rock outcrops, bolts, base point markers, start/summit/finish flags.
5. **Dynamic** (`render/dynamic.ts`): bases (sling + carabiner + flag), dropped items, ropes redrawn every frame through node chains (fixed segments taut, others sagging, free ends coiled; colour from `props.color`), self-belay lines.
6. **Members** (`render/members.ts`): sprite row = `appearance.row`; sheets `team_shout 4, tie_knot 6, belay 4, celebrate 6, fall 4, slide 3, hang 3, injured 2` at 32×32, pivot (16,31); idle = `team_shout` frame 0 (no idle/walk art); members at the same spot spread 1.25 m apart; number labels (full name when selected), pointer + ring for the selected member, planned-action icon; walk = 1 px bob, lean on ≥25°. **Idle stroll** (cosmetic, D-65): a member who is `ok`, has no planned action, is not tied in, attached or belaying, and stands in a safe zone (start / summit / finish) now and then walks 0.3–1 m sideways or back (or returns) at 0.35 m/s with the walk bob, staying inside the same zone and at least 0.7 m from teammates; each member waits 8–15 s (random) between strolls and only one member strolls at a time. It is a display offset only (state, journal and replay unchanged) and resets immediately when the member gets a task, a new step is animated or the member stops being idle.
7. **Animation** (`anim/timeline.ts`): three phases per step — (1) moves, action poses (knot/base/attach/item → tie_knot, belay → belay, commands → shout + speech bubble with Ukrainian text and English line in EN); (2) falls (fall → slide tween → hang / injured / idle), falling stones, red flash on rock hits; (3) celebrate on win. Timing ÷ `animationSpeed`. Skip jumps to the final state. `setAnimating(false)` when done.
8. **Assets** (`assets.ts`): `manifest` from `assets/manifest.json`, `assetUrl(id)` via `import.meta.glob`; missing art → `render/textures.ts` placeholders with the contract sizes.

---

## 21. Internationalisation ✅ (`src/i18n`)

1. Flat keys in `locales/<uk|en>/<area>.json`, merged by `import.meta.glob`. Areas: `common`, `engine` (owned by the engine: events, reasons, hints, knots, terms, items, commands, rules, validation, enums), `config` (`ui.cfg.*`), `game` (`ui.game.*`, `ui.res.*`, `ui.ref.*`, `ui.set.*`, `group.*`), `view` (`ui.view.*`).
2. `t(key, params)` (active locale, subscribes components), `tl(locale, key, params)`, `tUk`. Missing keys render `⟦key⟧` in dev.
3. ICU MessageFormat; Ukrainian plurals `one/few/many/other`.
4. Engine key namespaces: `event.*`, `reason.*`, `hint.*`, `knot.<id>.name|description`, `knot.msg.*`, `knot.rating.*`, `rating.*`, `context.*`, `category.*`, `control.*`, `cmd.*`, `rule.P*`, `summary.*`, `injury.*`, `factor.*`, `chain.*`, `anchor.*`, `action.*` (option labels), `actionkind.*`, `validate.*`, `term.*` (+ `.meaning`), `item.*`, `status.*`, `zone.*`, `outcome.*`, `method.*`, `season.*`, `mode.*`, `surface.*`, `route.*`, `anchorType.*`, `treeSize.*`, `preset.hill.*`, `kit.*`.
5. Ukrainian phrasing keeps member names in the nominative («{member}: …»), because names are not declined.
6. Default member names are Ukrainian in both locales: Саша, Рома, Єгор, Надя, Владік, Ксеня, Денис, Марго, Андрій, Світлана, Міша, Богдан (`DEFAULT_NAMES` in `app/store.ts`; «Випадково» picks from them).

---

## 22. Asset pipeline ✅ (`tools/process-assets.mjs`)

1. Input `assets/raw/<group>/<id>.(jpg|png)` with `#00FF00` chroma; output `assets/<group>/<id>.png` + `assets/manifest.json`.
2. Steps: chroma key with tolerance + despill → strict 0/255 alpha → block-majority downscale (not point sampling) → per-type layout.
3. Team sheets: connected components → 7 rows by vertical gaps → frames sorted by x → uniform per-sheet scale (standing figure ≈ 30 px) → 32×32 cells, feet on row 31, centred. Known source defects patched in code (celebrate row lengths, slide row 1 frame 2).
4. Terrain: fills 128×128 opaque, edges 128×32; trees fitted to 24×40 / 40×72; key art 480×270.
5. Manifest entry: `{ file, width, height, frameWidth?, frameHeight?, frames?, rows? }`. Contract: `docs/ASSET_SPEC.md`.

---

## 23. Testing and quality ✅

| Level | Location | What |
|---|---|---|
| Scenario DSL | `tests/engine/dsl.ts` | `Game` wrapper (validates plans, records per-step roll scripts, `replay()`), `scenario()`, `team()`, `preset()`, `flatHill()`, `steepHill()`, `K()` knot choice, `mv()`, `say()`, `CALM` script (no random falls / rocks) |
| Scenario | `tests/engine/scenarios/` | M1 walk-up; §24.2.1 golden path + .10 determinism; §24.2.2–.9, .11–.14 |
| Unit | `tests/engine/unit/invariants.test.ts`, `config.test.ts` | one test per §9.2 rule + random play; base-spot validation, no pre-built bases, no roles, kit by team order, legacy `role` import |
| Data | `tests/data/data.test.ts` | contexts → knots, probabilities in [0,1], presets valid, kits build, texts for every knot/term/item/command/context/rule/preset, uk/en key parity, ICU parse, every key literal in `src` exists |
| App | `tests/app/goals.test.ts` | right-click goal: multi-step walk, goal cleared by another action |
| E2E | `tests/e2e/smoke.spec.ts` | Play → Hill → pick the default predefined hill → defaults → start, right-click on the hill plans «Іти до …», play steps, switch to EN; obstacle constructor: copy a preset, rename, save, the copy appears in the hill list; glossary and knots screens |
| Headless | `npm run sim -- scenario.json history.json [uk\|en]` | prints the journal |

Rules for new work: every new rule gets a scenario or unit test using forced rolls (`RollScript`) instead of searching seeds; tests must not depend on unscripted randomness unless they only assert invariants.

---

## 24. Extension guides

### 24.1 New action

1. Add the params variant to `ActionParams` (types.ts).
2. Implement `ActionDef` in `actions/defs.ts` with the right phase; register in `ACTIONS`.
3. Add options in `actions/options.ts` (group, label key, needs).
4. Add `action.*`, `actionkind.*`, `event.*`, `reason.*` keys in both locales; durations in `actions.json`.
5. Renderer pose mapping (`anim/timeline.ts` `ACTION_POSE`) if it has a visual.
6. Tests (DSL) and a D-n entry if it interprets the PRD.

### 24.2 New knot or rating

Data only: `knots.json` + `contexts.json` + `knot.<id>.name|description` in both locales. New modifier kinds need `evaluate.ts` + `hazards.json`.

### 24.3 New obstacle type (post-MVP, PRD §25)

1. Add a config type to the `Obstacle` union and `geometry/<type>.ts` exposing the same queries (`segmentAt`, `toWorld`, `zoneAt`, `downhillDir`).
2. Dispatch geometry by `obstacle.type`; positions already carry `obstacleIndex`.
3. New surfaces / hazards in data, new actions per S§24.1, a renderer for the type, a constructor editor and a selection list in the obstacle library (S§18.6), presets, tests.

### 24.4 New protocol rule

Entry in `protocol.json` + checker code at the right phase (`resolve.ts` / action `apply`) + `rule.Pn` text + stats/results label `ui.res.rule_name.Pn`.

### 24.5 New asset

Raw file in `assets/raw/<group>/<id>`, extend the pipeline if it is a new layout, `npm run assets`, use via `assetUrl(id)` with a placeholder fallback, update `docs/ASSET_SPEC.md`.

---

## 25. Non-functional requirements status

| PRD | Requirement | Status |
|---|---|---|
| §22.1 | Desktop ≥1280×720, mouse + keyboard | ✅ |
| §22.2 | `resolveStep` < 50 ms for 7 members | 🟡 not benchmarked (golden path: ~200 steps in < 1 s) |
| §22.3 | Initial load < 5 MB | ✅ JS 1.7 MB (0.49 MB gzip) + art < 1 MB |
| §22.4 | Deterministic replay | ✅ tested |
| §22.5 | Keyboard access, contrast, names/numbers on members | ✅ |
| §22.6 | No network after load | ✅ fonts bundled |

---

## 26. Known gaps and planned work ⏳

1. M6 winter: rules ✅; winter art ⏳ (tinted summer textures) — A-A-8.
2. M7: tutorial scenario, sound, performance benchmark, final art — I-ENG-2.
3. Missing art: idle/walk/climb sheets, deciduous trees, props, backgrounds, equipment icons, UI art; injured sprites too small — `docs/CTA/PROBLEMS.md` P-CODE-1/2.
4. Renderer: rope layout jumps at animation start; speech bubbles vanish at step end; crowded labels overlap — P-CODE-4…6.
5. `TIE_IN_MIDDLE` and rope joining have no actions (D-15).
6. Palette snapping in the asset pipeline (A-A-4).
7. Property-based tests with fast-check (I-ENG-3); bundle code-splitting (I-ENG-1).
8. PRD owner rulings pending: `docs/CTA/ACTIONS.md` A-R-1 … A-R-10.

---

## 27. Change log

| CR | Date | Summary | Sections | Status |
|---|---|---|---|---|
| CR-0 | 2026-10-20 | Initial specification of the implemented MVP (M0–M5) | all | Implemented |
| CR-1 | 2026-10-21 | Obstacles are predefined before the game: Play → obstacle type → list of predefined hills (presets + user hills); the obstacle constructor is a separate main-menu entry with its own library storage | S§4.2, S§18.1–18.3, S§18.6, S§19.2, S§23, S§24.3 | Implemented 2026-10-21 |
| CR-2 | 2026-10-21 | No bases on the route by default; bases are built only by members (`make_base`). Only a base spot in the finish zone is mandatory; start/summit base spots are optional | S§4.2, S§4.3, S§6.4, S§9.2, S§17.1, S§17.2 | Implemented 2026-10-21 |
| CR-3 | 2026-10-21 | Remove member roles (leader / member / last) from the model, validation, kit, UI and locales; kit uses team order | S§4.2, S§4.3, S§6.3, S§17.2, S§17.3, S§18.4, S§19.2, S§19.3, S§21.4 | Implemented 2026-10-21 |
| CR-4 | 2026-10-21 | Remove the appearance picker; members get a random unused sprite row; «Випадково» stays | S§4.2, S§18.1, S§19.2 | Implemented 2026-10-21 |
| CR-5 | 2026-10-21 | Team screen: member number badge in the top-right corner of the card | S§19.2 | Implemented 2026-10-21 |
| CR-6 | 2026-10-21 | Equipment screen groups identical items into one row with an editable count | S§19.2 | Implemented 2026-10-21 |
| CR-7 | 2026-10-21 | Weights only in Settings: no per-member base weight (one base backpack, default 15 kg in every season), no per-item weight in configuration; standard equipment weights in Settings; `scenario.weights` snapshot written at game start | S§4.2, S§4.3, S§6.1, S§6.3, S§17.1, S§17.3, S§17.4, S§18.1, S§18.2, S§18.4, S§18.5, S§19.2, S§19.4 | Implemented 2026-10-21 |
| CR-8 | 2026-10-21 | Remove the `take_off` action (no «Зняти каску / обв'язку / кішки»); worn items stay worn | S§8.1, S§9.2, S§9.3 | Implemented 2026-10-21 |
| CR-9 | 2026-10-21 | Equipment screen: − / + quantity controls on each grouped item of a member's carried list (e.g. «петлі», «карабіни») | S§19.2 | Implemented 2026-10-21 |
| CR-10 | 2026-10-21 | Harness and helmet are implicit: always worn by every member, not shown or configured on the equipment screen, not in the kit, no «no harness / no helmet» warnings | S§4.2, S§17.1–17.4, S§18.4, S§19.2 | Implemented 2026-10-21 |
| CR-11 | 2026-10-21 | Seasons spring and autumn; per-season probability of rain and mud; weather rolled at game start changes surfaces (mud, wet rock); the look follows season and weather | S§4.2, S§4.3, S§6.1–6.5, S§7, S§12.1, S§16, S§19.2, S§19.3, S§20 | Implemented 2026-10-21 |
| CR-12 | 2026-10-21 | Gloves are «страхувальні рукавиці» and always worn by every member (implicit, like harness and helmet); removed from the equipment catalog, lists and kit | S§4.2, S§17.3, S§19.2 | Implemented 2026-10-21 |
| CR-13 | 2026-10-22 | Equipment screen: no «Одягнено» label and no worn items in member columns | S§19.2 | Implemented 2026-10-22 |
| CR-14 | 2026-10-22 | Individual equipment, the same for every member and not in «Що беремо»: helmet, harness, belay gloves, belay device, жумар (new item), 2 prusik loops; winter adds crampons and ice axe | S§4.2, S§6.3, S§6.5, S§17.1–17.4, S§18.4, S§19.2 | Implemented 2026-10-22 |
| CR-15 | 2026-10-22 | No «HMS» in carabiner names in the equipment UI | S§19.2 | Implemented 2026-10-22 |
| CR-16 | 2026-10-22 | Main rope diameter fixed at 10 мм; no diameter option | S§19.2 | Implemented 2026-10-22 |
| CR-17 | 2026-10-22 | «Вус самостраховки» (lanyard) is individual equipment: one per member, not in «Що беремо» or the kit | S§4.2, S§17.3, S§19.2 | Implemented 2026-10-22 |
| CR-18 | 2026-10-22 | Right-click on the hill sends the selected member to that point (multi-step goal); no metre selection for moves | S§9.2, S§9.3, S§18.1, S§18.2, S§19.3, S§20.1 | Implemented 2026-10-22 |
| CR-19 | 2026-10-22 | Uphill moves cover ×1.5 per step (`moveModifiers.uphill`) | S§6.1, S§10.1 | Implemented 2026-10-22 |
| CR-20 | 2026-10-22 | Left-click on a base spot next to the selected member shows a station icon; clicking it plans «Організувати базу» | S§19.3, S§20.1 | Implemented 2026-10-22 |
| CR-21 | 2026-10-22 | Knot dialog: no control-knot selector; control knots always correct | S§19.3 | Implemented 2026-10-22 |
| CR-22 | 2026-10-22 | A self-secured climber who shouted «Сам!» may untie from the belay rope on the next step; that ends the belay | S§9.2, S§13.2 | Implemented 2026-10-22 |
| CR-23 | 2026-10-22 | Any friction hitch is a correct self-belay on a fixed rope; moving on it is safe below 55° and does not load the rope's anchor knots | S§6.1, S§11, S§12.1, S§12.5 | Implemented 2026-10-22 |
| CR-24 | 2026-10-22 | Remove the drop action («Покласти на землю») | S§8.1, S§9.2, S§9.3 | Implemented 2026-10-22 |
| CR-25 | 2026-10-22 | No movement in the action picker; right-click is the only way to move | S§9.3, S§19.3 | Implemented 2026-10-22 |
| CR-26 | 2026-10-22 | Belay sequence: belayer self-secured at a base → set up the belay → «Страховка готова!»; the belay protects only after that shout; no P1 for a belay set up this step | S§9.2, S§12.3, S§13.2 | Implemented 2026-10-22 |
| CR-27 | 2026-10-22 | Hill-map station icon with a text label: «Організувати базу» (empty spot) / «Організувати проміжний пункт страховки» (clip the rope through a built base) | S§19.3 | Implemented 2026-10-22 |
| CR-28 | 2026-10-22 | Injury on a caught belay fall grows with the fall length; intermediate points shorten falls and reduce it | S§6.2, S§12.3 | Implemented 2026-10-22 |
| CR-29 | 2026-10-22 | Anchor knots: Зустрічна вісімка and Булінь correct around a tree; new `ANCHOR_ROCK` context (direct knots around rock one step worse) | S§11 | Implemented 2026-10-22 |
| CR-30 | 2026-10-22 | Idle members in a safe zone stroll a little now and then (cosmetic, ≤ 1 m, every 8–15 s, one at a time); stops when they get a task | S§20.6 | Implemented 2026-10-22 |
| CR-31 | 2026-10-22 | Every large tree is a base spot by default (station or intermediate protection point); small trees only where configured | S§4.2, S§17.2, S§19.2, S§20 | Implemented 2026-10-22 |
| CR-32 | 2026-10-22 | Background parallax follows the camera in the same frame, never shows gaps when panning (textures per view height, padded) | S§20.2 | Implemented 2026-10-22 |
| CR-33 | 2026-10-22 | Belay options only when the member is clipped to a base, base anchor only, disabled ones hidden | S§9.3 | Implemented 2026-10-22 |
| CR-34 | 2026-10-22 | «Страховка готова!» offered only once the belay exists | S§19.3 | Implemented 2026-10-22 |
| CR-35 | 2026-10-22 | Hover command button over members on the hill view | S§19.3 | Implemented 2026-10-22 |
| CR-36 | 2026-10-22 | New command «Зрозумів.» (`understood`) | S§6.3, S§13.1 | Implemented 2026-10-22 |
| CR-37 | 2026-10-22 | A command does not use the member's step: one action + one command per member per step | S§7, S§8.1, S§18.1, S§19.3 | Implemented 2026-10-22 |
| CR-38 | 2026-10-22 | Clicking the supporting tree / rock also shows the station icon | S§19.3 | Implemented 2026-10-22 |
| CR-39 | 2026-10-22 | Base on sling + carabiner by default; warning dialog before a direct base | S§19.3 | Implemented 2026-10-22 |
| CR-40 | 2026-10-22 | Member cards: team gear as icons «×N»; individual set behind one «Особисте спорядження» icon | S§19.3 | Implemented 2026-10-22 |
| CR-41 | 2026-10-22 | No «у нормі» status on member cards | S§19.3 | Implemented 2026-10-22 |