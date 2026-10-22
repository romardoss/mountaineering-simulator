# PRD — «Закріпи! Готово! Рух!»: покрокова навчальна гра з техніки гірського та спортивного туризму

> Game title: **«Закріпи! Готово! Рух!»**. The title is shown in Ukrainian in both locales (it is a sequence of real rope-team commands). Repository / package slug: `zakripy-gotovo-rukh`.

| Field | Value |
|---|---|
| Document version | 0.1 (MVP scope) |
| Date | 2026-10-20 |
| Owner | Roman |
| Status | Draft — ready for implementation of Milestones M0–M2, open questions in §26 |
| Audience | AI coding agents and human reviewers |

---

## 0. How to use this document (for AI agents)

1. This PRD is the single source of truth. When something is ambiguous, prefer the simplest interpretation that keeps the rules in §0.2 true, and record the assumption in `docs/DECISIONS.md`.
2. Non-negotiable engineering rules:
   1. The game-logic engine (`src/engine`) is pure TypeScript with **zero** imports from the rendering or UI layers. It must run headless in unit tests.
   2. All randomness goes through a **seeded RNG** stored in game state. Same scenario + same seed + same actions ⇒ identical result.
   3. Every tunable number (probabilities, speeds, durations, thresholds) lives in data files under `src/data/`, never hard-coded in logic.
   4. Every user-facing string goes through i18n keys. Ukrainian (`uk`) is the primary and default language; English (`en`) is a complete second locale.
   5. Equipment objects are never created, destroyed, duplicated or moved without an explicit action (see §9). This is enforced by invariant checks that run after every step in dev and test builds.
   6. **Physically impossible** actions are disabled in the UI (with a reason). **Unsafe but possible** actions are allowed — the game teaches through consequences.
3. Work in the milestone order of §23. Each milestone has a Definition of Done; do not start the next milestone until the current one passes its tests.
4. Lists in this document are numbered for reference. Refer to requirements as `§<section>.<item>` in commits and PRs.

---

## 1. Product overview

### 1.1 Summary

A 2D web game in pixel-art style, side view, with turn-based (step-by-step) decisions. The player leads a team of tourists/climbers through mountain obstacles. On each step the player chooses what every team member does: move, tie a knot, organise belay, build a base, shout a command, or skip. Equipment is real, finite and accountable. Mistakes in tactics, belay or knots lead to falls and injuries, exactly as they would in real life.

### 1.2 Goals

1. Teach **tactics and techniques** of mountaineering and sport tourism (спортивний туризм): order of movement, fixed ropes (перила), self-belay (самостраховка), team belay, bases/anchors, rope management, standard commands.
2. Teach **knots**: which knot is correct, acceptable or wrong for each situation, including control knots (контрольні вузли), based on the knot list of the Globus school (§13).
3. Teach **Ukrainian language**: all terminology, commands, UI and feedback are in Ukrainian by default; a full English version lets non-Ukrainian speakers play and switch between languages to learn the Ukrainian terms.
4. Be **beautiful and inspiring**: colourful characters and gear, detailed mountains, parallax backgrounds, at least two seasons.

### 1.3 Non-goals (for MVP)

1. Real-time action or physics-based control of characters.
2. Multiplayer, accounts, backend, leaderboards.
3. Obstacles other than the hill (vertical rock, ravine, river are later — §25).
4. Exact physical simulation of rope dynamics. Rules are simplified but must be **directionally correct** (a correct real-world technique never leads to a worse outcome than an incorrect one).

---

## 2. Target users

1. Beginners in sport tourism and mountaineering (club members, school/university tourism sections) who want to rehearse techniques before field training.
2. Instructors who want a tool to demonstrate tactics and typical mistakes.
3. Learners of Ukrainian who are interested in outdoor topics (secondary audience; served by the full English locale and the language switch).

---

## 3. Scope

### 3.1 MVP (v0.1) — "agile first slice"

1. One obstacle type: **Hill (Схил)** — §7.
2. Hill is split into **sections**, each with its own angle, length and surface.
3. Hill has predefined **base points** where bases (intermediate and main) can be organised.
4. Team configuration (size, names, colours) — §8.
5. Equipment configuration and assignment before start; strict accountability — §9.
6. Step-by-step game loop with all player actions — §10, §11.
7. Commands — §12.
8. Knot selection with data-driven correctness rules — §13.
9. Falls, belay resolution, rockfall, injuries — §14.
10. End-of-game statistics — §16.
11. Two seasons: **summer** and **winter** (visual + rule modifiers) — §7.5, §18.
12. Two modes: **Навчальний** (learning, with hints) and **Іспит** (exam, no hints) — §17.
13. Full Ukrainian and English UI with a language switch — §19.
14. Equipment weight and member carrying capacity — §9.5.
15. Configurable route direction: ascent, descent, or ascent + descent — §7.1.7.
16. Desktop browsers only — §22.
17. Local persistence (configurations and results in `localStorage`, JSON import/export of scenarios).

### 3.2 Post-MVP (backlog, not to be implemented now)

1. Obstacle chains (several obstacles one after another) — data model must already support it (§5.2).
2. Vertical rock, ravine, river — §25.
3. More seasons (spring/autumn), weather, time of day.
4. Evacuation of an injured member instead of instant loss.

---

## 4. Glossary (UI terms)

All terms below must exist in `src/i18n/uk.json` and in the in-game Glossary screen (Словник).

| Key | Українською | English hint | Meaning in game |
|---|---|---|---|
| `term.hill` | Схил | Hill / slope | Obstacle type for MVP |
| `term.section` | Ділянка | Section | Part of the hill with one angle and surface |
| `term.base` | База / станція | Base / anchor station | Safe point where members can self-secure, attach ropes, belay |
| `term.intermediate_base` | Проміжна база | Intermediate base | Base between start and finish, splits fixed rope and limits fall length |
| `term.anchor` | Опора / точка опори | Anchor / support | Tree, rock outcrop or bolt a base is built on |
| `term.fixed_rope` | Перила | Fixed rope | Rope fixed between bases, others move along it with self-belay |
| `term.self_belay` | Самостраховка | Self-belay | Member's own attachment to a fixed rope or base |
| `term.belay` | Страховка | Belay | One member protects another with a rope |
| `term.lower_belay` | Нижня страховка | Belay from below | Belayer below, climber goes up, rope is paid out |
| `term.upper_belay` | Верхня страховка | Belay from above | Belayer above, rope is taken in |
| `term.belayer` | Страхувальник | Belayer | Member who belays |
| `term.leader` | Перший (направляючий) | Leader | First member who goes up and fixes the rope |
| `term.last` | Замикаючий | Last member | Member who removes ropes and goes last |
| `term.harness` | Страхувальна система (обв'язка) | Harness | Worn equipment |
| `term.helmet` | Каска | Helmet | Worn equipment |
| `term.rope` | Основна мотузка | Main rope | Rope with length and diameter |
| `term.cord` | Репшнур | Accessory cord | Thin rope for grabbing knots |
| `term.sling` | Петля (стропа) | Sling | Loop for anchors |
| `term.carabiner` | Карабін | Carabiner | Locking (муфтований) or non-locking |
| `term.lanyard` | Вус самостраховки | Self-belay lanyard | Connects harness to rope/base |
| `term.belay_device` | Страхувальний пристрій | Belay device | Device for belay/descent |
| `term.knot` | Вузол | Knot | See §13 |
| `term.control_knot` | Контрольний вузол (контролька) | Back-up / stopper knot | Prevents the main knot from untying |
| `term.crampons` | Кішки | Crampons | Winter equipment |
| `term.ice_axe` | Льодоруб | Ice axe | Winter equipment |
| `term.step` | Крок | Step / turn | One planning + resolution cycle |
| `term.fall` | Зрив | Fall | A member loses footing |
| `term.injury` | Травма | Injury | Leads to game loss in MVP |
| `term.rockfall` | Камінь / каменепад | Rockfall | Hazard event |

---

## 5. Domain model

### 5.1 Core entities

All entities have a stable string `id`. All are plain serializable objects (JSON-safe) stored in `GameState`.

1. **Scenario** — everything configured before the game: route (list of obstacles), season, team, equipment pool and assignment, mode, RNG seed.
2. **Route** — ordered list of `Obstacle`s. MVP: exactly one `Obstacle` of type `hill`.
3. **Obstacle (Hill)** — sections, trees, base points, start zone, finish zone (§7).
4. **Member** — a person in the team (§8).
5. **Item** — a piece of equipment (§9).
6. **Base** — a station organised during the game on a base point (§11.6).
7. **Rope state** — how a rope is currently laid out: ordered chain of rope nodes (§9.4).
8. **Knot instance** — a knot tied during the game or pre-tied in configuration (§13.4).
9. **Belay state** — active belay relationships (§11.3).
10. **Hazard state** — pending rockfall events etc. (§14.4).
11. **Stats** — counters (§16).
12. **Event log** — list of events produced by each step, rendered as the in-game journal (Журнал).

### 5.2 Positions and geometry

1. The hill is a 1D path in metres measured along the slope from the start: `s ∈ [0, totalLength]`.
2. Each `s` maps to 2D world coordinates `(x, y)` via the section angles; rendering uses this mapping.
3. Height of the hill = Σ `section.lengthM × sin(section.angleDeg)`.
4. Every member, base point, tree and dropped item has a position `s`.
5. **Adjacency**: two things are adjacent if `|s1 − s2| ≤ data.rules.adjacencyM` (default 2 m). Many actions require adjacency.
6. For obstacle chains (post-MVP) a global position is `(obstacleIndex, s)`. Implement positions as this tuple from day one, with `obstacleIndex = 0` in MVP.

---

## 6. Game flow and screens

### 6.1 Screen flow

1. **Головне меню** (Main menu): Play (Грати), Continue (if a saved in-progress game exists), Конструктор перешкод (Obstacle constructor — create and edit hills; separate from playing), Scenarios (load/import), Словник (Glossary), Вузли (Knot reference), Налаштування (Settings: language UA/EN, bilingual term hints, sound, pixel scale). A UA/EN language toggle is also always visible in the top bar of every screen.
2. **Вибір перешкоди** (Obstacle selection): cards for Hill (active), Vertical rock, Ravine, River (locked, labelled «Незабаром»). A disabled "Add to chain" control is visible but inactive in MVP to signal the future feature.
3. **Вибір схилу** (Hill choice): a list of **predefined** hills — built-in presets and hills made in the obstacle constructor. Obstacles are always defined before the game; the play flow does not edit them (§7.3).
4. **Сезон і режим** (Season & mode): весна / літо / осінь / зима (each shows its chance of rain and mud); learning/exam; optional seed field (advanced).
5. **Команда** (Team) — §8.
6. **Спорядження** (Equipment) — §9.3.
7. **Перевірка готовності** (Readiness check): summary; in learning mode shows warnings (e.g. "no accessory cord for grabbing knots", "rope is shorter than the longest section"). Warnings never block the start.
8. **Гра** (Game) — §10, §18.4.
9. **Результати** (Results) — §16. Buttons: Replay same scenario, Edit scenario, Main menu, Export results (JSON).

### 6.2 Persistence

1. Scenarios are saved/loaded from `localStorage` and exported/imported as JSON files validated against `scenario.schema.json`.
2. An in-progress game is autosaved after every step (state + action history). Reload restores it.
3. Results history (last 50 games) is kept in `localStorage`.

---

## 7. Obstacle: Hill (Схил) — MVP

### 7.1 Hill structure

1. A hill is an ordered list of **sections** along the route path from start to finish.
2. Section fields:
   1. `direction` — `up` or `down` relative to the route direction (derived from `routeType`, see §7.1.7; stored explicitly for clarity).
   2. `lengthM` — 3…60, along the slope.
   3. `angleDeg` — 0…55 in MVP (steeper terrain belongs to the vertical rock obstacle).
   4. `surface` — `grass` (трав'янистий), `ground` (ґрунтовий), `rock` (скельний), `scree` (осипний).
3. **Trees**: list of `{ id, s, size: "small" | "large" }`. Trees are natural anchors and visual elements. Large tree = thick support (товста опора); small tree = questionable anchor (higher failure probability, see `hazards.json`).
4. **Base points**: list of `{ id, s, anchorType: "tree" | "rock_outcrop" | "bolt", treeId? }`. A base can only be organised at a base point. **Every large tree is a base point by default**; small trees, rock outcrops and bolts are base points only where the hill author places them. A base point is only a place for a base: **there are no ready-made bases on the route** — every base is built by team members during the game (§11.6). The finish zone must contain a base point; base points elsewhere (start, summit, intermediate) are optional, so a game can start with no bases at all.
5. **Start zone**: `s ∈ [0, startZoneM]`, flat, all members start here with all their equipment.
6. **Finish zone**: end of the last section plus a flat area. Members in the finish zone are safe.
7. **Route type** `routeType` (configurable in MVP, chosen in the hill configuration screen):
   1. `ascent` — start at the bottom, finish at the top. All sections `up`.
   2. `descent` — start at the top, finish at the bottom. All sections `down`.
   3. `ascent_descent` — up one side of the hill, over the summit, down the other side. The hill is defined as two section lists (`ascentSections`, `descentSections`) that are joined at a **summit zone** (flat, a base point is optional). The path `s` runs continuously over the summit.
8. "Go uphill" / "Go downhill" (§11.4, §11.5) always mean physical direction (towards higher / lower elevation). On the descent side, progress to the finish is made by going downhill.
9. **Descent rope retrieval** — the only exception to the adjacency rule (§9.2.3): a rope that is doubled around an anchor, or attached with a releasable knot (Карабінна удавка, §13.2 #18), can be pulled down from below with the Detach action («Здернути мотузку»). The rope (and the carabiner of a Карабінна удавка) arrives at the pulling member's position; anything else left at the anchor (e.g. a sling) stays there and counts as equipment left on the hill.

### 7.2 Movement rules by angle (default values, data-driven in `rules.json`)

| Angle | Name | Recommended technique (learning hint) | Base move distance per step |
|---|---|---|---|
| 0–15° | Пологий | Free walking | 6 m |
| 15–25° | Помірний | Walking, hand line optional | 4 m |
| 25–35° | Крутий | Fixed rope + self-belay recommended | 3 m |
| 35–45° | Дуже крутий | Fixed rope + self-belay required by technique; leader on belay | 2 m |
| 45–55° | Надкрутий | Leader on lower belay with intermediate bases; others on fixed rope | 1.5 m |

Modifiers (multiplicative on distance): moving with a grabbing knot on a fixed rope ×0.7; winter snow ×0.8; rock ×0.9; going downhill ×1.0 (same table).

### 7.3 Obstacle constructor (Конструктор перешкод)

The constructor is opened from the main menu, not from the play flow. It keeps a library of hills: the built-in presets (read-only; they can be copied) and the player's own hills (create, edit, duplicate, delete; stored in `localStorage`). The play flow only picks a hill from this library.

1. Presets (stored in `src/data/presets/hills/*.json`):
   1. «Пологий трав'янистий схил» — 3 sections, 10–20°, grass, trees.
   2. «Схил з деревами» — 4 sections 15/28/38/45°, grass→ground→rock, large trees at section boundaries (default MVP preset).
   3. «Скельно-осипний схил» — 4 sections 25/35/45/50°, scree and rock, few trees, rock outcrops and bolts.
   4. «Спуск зі схилу» — `descent` variant of preset 2 (start at the top).
   5. «Через вершину» — `ascent_descent`: preset 2 up, a 3-section 35/25/15° grass slope down.
   6. «Осінній Лист 2026 2.2» — competition stage, 39 m: start zone with a 60 cm tree; dangerous zone of varying steepness up to 50° with 5 ППС (trees up to 60 cm); target zone with a 1 m tree.
2. Editor: route type selector (§7.1.7); add/remove/reorder sections (for `ascent_descent`, separately for each side); sliders for angle and length; surface dropdown; click on preview to place trees and base points; validation messages:
   1. Error: total length < 10 m or > 300 m.
   2. Error: no base point in the finish zone.
   3. Warning: a section with angle ≥ 35° longer than 25 m without an intermediate base point.
3. Live preview renders the hill in the current season.
4. Computed info: total length, height gain, steepest section.

### 7.4 Section-specific hazards

1. Fall probability per moving step depends on angle and surface (§14.1).
2. Rockfall can be triggered by members moving on `rock` and `scree` (§14.4).

### 7.5 Seasons

1. **Spring (Весна)**, **Summer (Літо)**, **Autumn (Осінь)**: surfaces as configured, but each season has its own probability of **rain** and of **mud** (data: `src/data/seasons.json`; defaults spring 35 % / 60 %, summer 15 % / 20 %, autumn 45 % / 60 %). The weather is rolled once at the start of the game from the seed and stays for the whole game:
   1. **Rain (дощ)**: `grass` and `ground` become `mud` (багнюка), `rock` becomes `wet_rock` — higher fall probability, slower movement.
   2. **Mud (багнюка)** without rain: `ground` becomes `mud`.
   3. **Dry**: surfaces as configured.
2. The game's look follows the season (spring greens and flowers, summer sun, autumn ochre and orange trees, winter snow) and the weather (grey sky and rain, muddy ground).
3. **Winter (Зима)**: `grass` and `ground` become `snow`; `rock` becomes `icy_rock`; `scree` becomes `snow_scree`. Effects are defined in `hazards.json` (higher fall probability, reduced if the member wears crampons; ice axe reduces unprotected slide distance — post-MVP self-arrest).
4. Season is chosen before the game and cannot change during it; winter has no rain or mud.

---

## 8. Team

1. Team size: 2…7 members, default 5.
2. Member fields: `id`, `name` (default Ukrainian names in both locales, editable), `appearance`. Members have no roles; the only order is the team order (member number).
3. `appearance` (visual only, no gameplay effect). The player does not choose it: each member automatically gets a random look not used by another member. Original design (superseded in MVP by fixed sprite rows, D-36):
   1. `body` — `female` | `male` sprite base.
   2. `outfit` — one of the outfit variants from the asset manifest (e.g. softshell jacket, down jacket, fleece, windbreaker; season-specific variants).
   3. `jacketColor`, `pantsColor`, `helmetColor`, `backpackColor` — from the season palette.
   4. `hair` — variant id (visible under/around the helmet).
   5. A «Випадково» (Randomise) button generates new names and new random, distinct looks for the whole team.
4. Member runtime state: position `s`, `status` (`ok` | `fallen_caught` | `injured` | `finished`), worn items, carried items, carried weight, attachments (which ropes/bases it is connected to and how), `busyThisStep` flag, per-member stats.
5. All members have **identical abilities** (speed, fall chance, knot reliability, carrying capacity). They differ only in appearance and in the equipment they wear/carry. The data model keeps an empty `abilities` object for possible future use; the engine must not read it in MVP.
5. Win requires **every** member to reach the finish zone with status not `injured` (§15).

---

## 9. Equipment and accountability

### 9.1 Item catalog (`src/data/equipment.json`)

Every item has a weight. The values below are the standard weights; they are set in **Settings** only (not in the configuration before a game) and apply to every item of that kind.

| Type | Fields | Default weight | Notes |
|---|---|---|---|
| `rope` | lengthM (20–60), diameterMm fixed 10 mm, kind: `static`/`dynamic`, color | 0.07 kg per metre (≈ 2.8 kg for 40 m × 10 mm); scales with diameter | Main rope |
| `cord` | lengthM (1–7), diameterMm (5–8), color, preTiedKnotId? | 0.03 kg per metre | Accessory cord; may be pre-tied into a loop in configuration |
| `sling` | lengthCm (60/120/240), color | 0.03 / 0.06 / 0.12 kg | For anchors around trees/rocks |
| `carabiner` | locking: bool, shape: `hms` (pear) / `d` / `oval` | 0.05 (non-locking) / 0.08 (locking) kg | HMS locking required for УІАА |
| `belay_device` | model: `atc` / `figure8` | 0.08 / 0.10 kg | Alternative to friction knots |
| `harness` | — | 0.4 kg | Worn; **always present**: every member wears one, it is not configured or shown on the equipment screen |
| `helmet` | color | 0.35 kg | Worn; **always present** (like the harness) |
| `lanyard` | arms: 1/2 | 0.15 kg | Вус самостраховки |
| `gloves` | — | 0.1 kg | «Страхувальні рукавиці» (belay gloves). Worn; **always present** (like harness and helmet), not configured; reduces rope-burn penalty (post-MVP) |
| `crampons` | — | 0.9 kg | Winter, worn |
| `ice_axe` | — | 0.5 kg | Winter |
| `backpack` | baseWeightKg — **base weight**: backpack, food, water, clothes, sleeping and personal gear; the same for every member, default 15 kg in every season; set in Settings only, 10–25 kg | = baseWeightKg | Every member gets one automatically; it cannot be passed or dropped in MVP |

### 9.2 Accountability rules (invariants)

1. Every item has exactly one location at any time:
   1. `carried` by a member,
   2. `worn` by a member (harness, helmet, gloves, crampons),
   3. `in_use` as part of a rope/base/knot structure (with a reference to that structure),
   4. `on_ground` at a position `s` (dropped or left).
2. The set of item ids never changes after the game starts. No spawning, no deletion, no duplication.
3. An item changes location only through an action of a member who is adjacent to the item's current location (§5.2.5). No teleportation.
4. A rope cannot be longer than its `lengthM`: the sum of path distances between consecutive rope nodes plus knot allowance (`data.rules.knotRopeAllowanceM`, default 1 m per knot) must be ≤ `lengthM`.
5. A carabiner can hold at most `data.rules.maxThingsPerCarabiner` (default 3) things.
6. Items left on the hill at the end of the game are reported in stats (§16) and as a learning message; they do not cause a loss.
7. Implement `assertInvariants(state)` and run it after every step in dev/test. Unit tests must cover each invariant.

### 9.3 Equipment configuration screen

1. Left: **pool** of team items the team takes (add from catalog, set properties, set count). **Individual equipment is not in the pool**: every member automatically gets the same personal set — шолом, страхувальна система, страхувальні рукавиці, спусковий пристрій, жумар, вус самостраховки, two прусики; in winter also кішки and льодоруб. Member columns show only carried team items (no «Одягнено» list). Carabiner names do not mention HMS; the main rope is always 10 мм (no diameter option). Identical items are shown as one row with a count (e.g. one «Карабін» row with count 10), not as a list of copies. Each member's carried list is grouped the same way and has − / + buttons to change how many pieces of an item (e.g. «петлі», «карабіни») that member carries.
2. Right: one column per member. The left pool is only the prepared team stock (totals and characteristics); team items are handed out from each member's column («+ Взяти…», − / +). Carabiners have no shape choice; the main rope has length and static / dynamic.
3. Each item must be assigned to a member before the start. Unassigned items are not taken (a warning lists them).
4. Pre-tied structures in configuration: a cord can be pre-tied into a loop (knot chosen from the `LOOP_CORD` context, §13.3). This is part of configuration and counts in knot statistics as "pre-tied".
5. Button «Типовий набір» (learning mode only) auto-fills a recommended kit for the selected hill and team size (data: `src/data/presets/kits/*.json`). The player may then edit it.
6. Validation (warnings, not errors): no locking HMS carabiner; rope shorter than the longest section; no cord for self-belay; winter without crampons; member above `heavyKg`.
7. Validation (error, blocks the assignment): member would exceed `maxKg` (§9.5).

### 9.4 Rope state model

1. A rope in use is an ordered chain of **rope nodes** from end A to end B.
2. Node fields: `id`, `kind` (`end` | `middle`), position `s`, `attachedTo`:
   1. `member_harness` (with knot instance id),
   2. `base` (fixed with a knot instance, or running through a carabiner of the base),
   3. `belay` (through a belay device or friction-knot on a belayer/base),
   4. `held` (member holds it in hands),
   5. `free` (lying or hanging).
3. A **fixed rope segment** (перила) is the part of a rope between two consecutive nodes that are both fixed to bases.
4. Members attach to a fixed rope segment via self-belay (§11.1). They are not nodes of the rope.
5. Retrieval: a rope can be untied and coiled only by a member adjacent to each node being removed — except the pull-down of a doubled or releasable rope (§7.1.9). A coiled rope becomes a `carried` item again.

### 9.5 Weight and carrying capacity

1. Total weight = base weight (§9.1 `backpack`) + Σ weight of worn and carried team gear. Items that are `in_use` (part of a rope layout or base) or `on_ground` count for nobody. All thresholds below apply to this total.
2. Capacity thresholds (equal for all members, `rules.json`):
   1. `comfortKg` — default 25 kg: no effect.
   2. `heavyKg` — default 30 kg: between comfort and heavy, move distance ×0.85.
   3. `maxKg` — default 35 kg: between heavy and max, move distance ×0.7 and fall probability ×1.3 (§14.1).
   4. Above `maxKg` is **physically impossible**: the equipment screen refuses the assignment, and in-game the Pass equipment and Pick up actions are disabled when the receiver would exceed it.
3. A rope counts fully toward the weight of the member carrying it until it becomes `in_use`; from then on it counts for nobody until someone coils it again. (Splitting the weight of a partially paid-out rope is post-MVP.)
4. With defaults every member has 10 kg of headroom for team gear before slowing down — distributing ropes and hardware across the team is part of the tactics.
5. Member cards show a weight bar (green / yellow / orange) with the kg value, split into base weight and team gear. The readiness check shows the team's weight distribution and suggests rebalancing (learning mode only).

---

## 10. Step system (game loop)

### 10.1 Step phases

1. **Planning**: for each member who is not `injured` or `finished`, the player selects one action (§11) with parameters, or **Пропустити** (skip). Default for each member is skip.
2. **Validation**: the engine marks actions that are physically impossible (missing item, not adjacent, rope too short, member busy) — these cannot be confirmed. Unsafe actions are allowed.
3. **Resolution** (on «Виконати крок»): the engine resolves all actions in the fixed phase order below and emits events.
4. **Review**: the game animates the results, appends events to the Journal, updates stats. Then the next planning phase begins.

### 10.2 Resolution order inside one step

1. Commands (§12).
2. Detach/untie/retrieve and item transfers.
3. Base creation and knot tying.
4. Rope attachments (grab rope / self-belay).
5. Belay setup and stop.
6. Movement.
7. Hazard rolls: static knot loads, falls, rockfall triggering (§14).
8. Hazard resolution: catching falls, rockfall hits, injuries.
9. Stats update and invariant check.

### 10.3 Effectiveness rule (important)

Protection only counts if it existed **at the start of the step**. A belay organised in step N protects movement from step N+1. A self-belay attached in step N protects from step N+1. This teaches the correct order: first «Страховка готова!», then move.

### 10.4 Time model

1. Each action has a simulated duration in seconds (`actions.json`, defaults in §11).
2. Step duration = max of the durations of the actions in that step (members act in parallel), minimum `data.rules.minStepSeconds` (default 5 s).
3. Total simulated time = Σ step durations. Real (wall-clock) play time is tracked separately.

---

## 11. Player actions

Each action specification: parameters → preconditions (physical; failing ones disable the action) → effects → default duration. Unsafe choices are allowed and evaluated by the knot/hazard rules.

### 11.1 Взятися за мотузку / пристебнутися (Grab the rope / attach)

1. Parameters: target (rope segment or base), method:
   1. `hand` — holds rope with hands (no fall protection, fall probability ×0.5 on that step),
   2. `lanyard_carabiner` — lanyard + carabiner clipped to the rope or base,
   3. `grabbing_knot` — cord tied on the rope with a knot from context `SELF_BELAY_GRAB`, connected to the harness with a locking carabiner (triggers knot selection §13.4).
2. Preconditions: adjacent to the target; has the required items (lanyard, carabiner, cord) carried or worn; wears a harness for methods 2–3.
3. Effects: creates an attachment. A member may have up to `lanyard.arms` simultaneous attachments (+1 for hand). Passing a base on fixed rope requires attaching to the next segment before detaching from the previous one (two steps) — otherwise the member is unprotected in between.
4. Duration: hand 5 s, lanyard 15 s, grabbing knot 45 s.

### 11.2 Зав'язати вузол (Tie a knot)

1. Parameters: rope or cord, location of the knot (rope end, middle point at position `s`), purpose/context (one of §13.3 contexts, derived automatically from the target — e.g. tying a rope end to own harness ⇒ `TIE_IN_END`), knot type (list of all knots — the player must choose), control knot (`none` / `single` «бублик» / `double` «напівгрепвайн»), number of turns (only for knots that have `minTurns`).
2. Preconditions: adjacent to the rope part; for knots with `requires` (e.g. carabiner), the item is available.
3. Effects: creates a knot instance and the resulting connection (tie-in to harness, rope to anchor, rope to carabiner, cord loop…). The knot's quality is evaluated immediately (§13.5) but in exam mode the result is **hidden** until the knot is loaded.
4. Duration: 60 s (+10 s per control knot).

### 11.3 Організувати страховку (Make belay)

1. Parameters: belayer (self), climber (member tied into the same rope), mode (`lower` / `upper`), braking method (`belay_device` or friction knot from context `BELAY_LOWER` / `BELAY_UPPER`, e.g. УІАА on an HMS carabiner), anchor (`base` the belayer is self-secured to, or `body` — belaying without anchor).
2. Preconditions: belayer adjacent to the rope; has device or locking carabiner; climber is tied into that rope. Two options: «від бази» (braking on the base carabiner, needs a base next to the belayer) and «від себе» (braking on the belayer's harness). Self-securing first is recommended (learning hint) but not required.
3. Sequence: (self-secure →) set up the belay → shout «Страховка готова!» (next step). **The belay catches a fall only after «Страховка готова!»**; there is no «command missing» warning before the belay exists.
4. Effects: creates an active belay relation. It remains active until stopped (the «Зняти страховку» parameter of the same action — correct after the climber's «Сам!», no command needed) or until the belayer does any other non-command action — then the belay is **inactive for that step** (distracted belayer).
4. Rope management (paying out / taking in) is automatic while the belay is active and the belayer is not busy. If the braking method cannot pay out rope (e.g. Гарда in lower belay), the climber cannot move away from the belayer — the engine emits a learning event (§13.6).
5. Belay with `anchor: body` on a section ≥ 25°: if the climber falls, the belayer may be pulled (§14.3).
6. Duration: 45 s.

### 11.4 Йти вгору (Go uphill)

1. Target: **right-click a point on the hill** — the selected member goes to that point, as far as the terrain allows per step (§7.2), and keeps going on the next steps until they reach it (or something stops them, or the player gives them another action). There is no metre selection; the action list option moves as far as possible this step.
2. Preconditions: not attached to anything that would be overstretched:
   1. If tied into a rope whose other side is belayed or fixed, the remaining free rope length limits the distance.
   2. A grabbing knot / carabiner on a fixed rope segment cannot pass the segment's upper node (must re-attach, §11.1.3).
3. Effects: moves position; consumes slack; triggers hazard rolls (§14).
4. Duration: 30 s + 1 s per degree of angle above 15°.

### 11.5 Йти вниз (Go downhill)

1. Same as §11.4, downward.
2. Descent along a fixed rope with self-belay is allowed. (Rappelling with a device on vertical terrain is part of the vertical-rock obstacle, post-MVP.)

### 11.6 Організувати базу (Make a base)

1. Parameters: base point, anchor construction:
   1. sling around the tree/rock outcrop + locking carabiner,
   2. rope tied directly around the anchor with a knot (context `ANCHOR_THICK` / `ANCHOR_THIN`),
   3. carabiner into a bolt (if `anchorType: bolt`).
2. Preconditions: adjacent to a base point that has no base yet; required items available.
3. Effects: creates a Base with a quality score derived from anchor type and the knot/sling used. Members adjacent to a base can self-secure to it (§11.1), fix ropes to it (§11.2), and belay from it (§11.3). A member self-secured to a base cannot fall.
4. A base built at an intermediate base point also acts as an **intermediate protection point** when a rope runs through its carabiner (limits fall length, §14.2). On the hill map, clicking such a base next to a climber tied into the rope offers «Організувати проміжний пункт страховки» (clip the rope through it). The injury risk of a caught fall grows with the fall length, so intermediate points make falls safer.
5. Duration: 120 s.

### 11.7 Подати команду (Shout a command)

1. Parameters: command from `commands.json` (§12), recipient (`all` or a specific member).
2. Preconditions: none. **A command does not use the member's step**: each member can give one command and do one action in the same step. «Страховка готова!» is available only once the belay is set up. A command can also be given from the hill view: hovering over a member shows a command button.
3. Effects: logged; shown as a speech bubble; evaluated by the protocol checker (§12.2); required to avoid rockfall hits (§14.4).
4. Duration: 5 s.

### 11.8 Utility actions (required — confirmed by owner)

1. **Від'єднатися / розв'язати** (Detach / untie): remove an attachment, untie a knot, unclip from a base, dismantle a base (its items go to the member), coil a rope, or pull down a doubled/releasable rope from below («Здернути мотузку», §7.1.9). Detaching the member's last protection on terrain ≥ 25° is allowed but flagged as unsafe in learning mode. Duration 20–60 s (pull-down 30 s).
2. **Передати спорядження** (Pass equipment): give one or more carried items to an adjacent member. Disabled if the receiver would exceed `maxKg`. Worn items (harness, helmet, crampons, gloves) cannot be passed or dropped: there is no take-off action, a worn item stays worn for the whole game. A carried wearable can be put on («Одягнути») in a safe position (start/finish/summit zone or self-secured at a base). Duration 10 s per item, max 3 items per action.
3. **Підняти** (Pick up): pick up an `on_ground` item at the member's position (e.g. after a base failure). Duration 5 s per item. There is no «Покласти на землю» action.
4. **Пропустити** (Skip): no action. Duration 0 s. Counts as a skipped step for that member.

---

## 12. Commands (Команди)

### 12.1 Command list (`src/data/commands.json`)

| Key | Ukrainian (shown) | English hint | When it is used |
|---|---|---|---|
| `belay_ready` | «Страховка готова!» | Belay on | Belayer is ready |
| `go` | «Пішов!» | Climbing | Climber starts moving |
| `stop` | «Стоп!» | Stop | Everyone/recipient stops moving |
| `take_in` | «Вибери!» | Take in | Climber asks to take in slack |
| `give_slack` | «Видай!» | Slack | Climber asks for more rope |
| `secured` | «Сам!» | I'm secured | Member reports being self-secured at a base. After it the belayer may remove the belay with no further command |
| `fixed_rope_ready` | «Перила готові!» | Fixed rope ready | Fixed rope is set and can be used |
| `fixed_rope_free` | «Перила вільні!» | Rope free | Segment is free for the next member |
| `rock` | «Камінь!» | Rock! | Falling rock warning |
| `hold` | «Закріпи!» | Take! / Hold me | Climber asks the belayer to lock the rope and hold their weight (before loading the rope or when about to fall) |
| `understood` | «Зрозумів.» | Understood | Acknowledges that the member heard another member's instruction |

The list is data-driven and confirmed by the owner. There is deliberately no separate «belay off» command: the belay is removed after the climber's «Сам!».

### 12.2 Protocol checker

1. A set of protocol rules (`src/data/protocol.json`) evaluated every step. Examples:
   1. A climber starts moving on a belayed rope without the belayer having issued `belay_ready` after the belay was set ⇒ violation `P1`.
   2. A climber moves without having issued `go` ⇒ violation `P2`.
   3. A member starts using a fixed rope segment before someone issued `fixed_rope_ready` for it ⇒ `P3`.
   4. More than `maxMembersPerSegment` (default 1) members on one fixed rope segment ⇒ `P4` (also increases knot/anchor load).
   5. A rockfall event without `rock` in the required window ⇒ `P5` (also physical consequences, §14.4).
   6. The belayer stops the belay before the climber has shouted `secured` («Сам!») ⇒ `P6`. If the climber is not actually self-secured at that moment, they are unprotected from the next step (physical consequence through normal fall rules).
   7. A climber loads the rope (hangs on it, or is lowered) without `hold` («Закріпи!») first ⇒ `P7`.
2. Violations (except P5) do not cause physical consequences in MVP; they are counted in stats and explained in learning mode.
3. **Language practice option** (setting «Обирати формулювання»): when shouting, the player picks the correct Ukrainian phrasing among 3 options (1 correct, 2 plausible wrong). A wrong pick = the command was misunderstood (not issued).

---

## 13. Knots (Вузли)

### 13.1 Source

Knot list: Globus school («Список вузлів школи Глобус», Google Doc provided by the owner). The PRD paraphrases it; implementation must put all of it into `src/data/knots.json`. Situation rules (§13.3) are an **initial draft** built from that list plus general climbing practice and must be reviewed by an instructor (§26).

### 13.2 Knot catalog

Control knots: the source states FSTU guidelines require single control knots («бублик»), while the school prefers a double control knot («напівгрепвайн») for reliability. In-game: `single` and `double` both satisfy the requirement; `double` is preferred (learning-mode hint if single is used, no penalty).

| # | id | Назва (uk) | EN reference (verify) | Category | Control knots | Key requirements (from source) |
|---|---|---|---|---|---|---|
| 1 | `pryamyi` | Прямий | Square (reef) knot | Joining, same diameter | 2 | Symmetric; free ends exit on the same side; **only under constant load** |
| 2 | `tkatskyi` | Ткацький | Weaver's knot | Joining, same diameter | 2 | Central knots symmetric; controls may be asymmetric |
| 3 | `grapevine` | Грепвайн | Double fisherman's | Joining, same diameter | 0 | Symmetric; free ends exit diagonally opposite |
| 4 | `zustrichnyi` | Зустрічний | Water knot | Joining, same diameter | 0 | No crossings |
| 5 | `zustrichna_visimka` | Зустрічна вісімка | Figure-8 bend | Joining, same diameter | 0 | No crossings; free ends exit diagonally opposite |
| 6 | `akademichnyi` | Академічний | Surgeon's-type bend | Joining, different diameter | 2 | Symmetric; loaded end presses the unloaded one |
| 7 | `bramshkotovyi` | Брамшкотовий | Double sheet bend | Joining, different diameter | 2 | Two turns |
| 8 | `providnyk_visimka` | Провідник вісімка | Figure-8 on a bight | Loop (attachment point) | 0 | No crossings; loop ≤ 20 cm from knot to loop end |
| 9 | `providnyk_visimka_odnym` | Провідник вісімка одним кінцем | Figure-8 follow-through | Loop | 0 | Tied with one end; no crossings; loop ≤ 20 cm |
| 10 | `serednii_providnyk` | Серединний провідник (австрійський) | Alpine butterfly | Loop, mid-rope | 0 | Symmetric, no crossings, loop ≤ 20 cm; isolates a damaged rope section |
| 11 | `podviinyi_providnyk` | Подвійний провідник на базі вісімки | Double figure-8 loop | Loop | 0 | No crossings |
| 12 | `bulin` | Булінь | Bowline | Attach to support | 1 | Free end may exit on either side |
| 13 | `stremeno` | Стремено | Clove hitch | Attach to support/carabiner | 0 | Both rope ends are loaded → they must be connected |
| 14 | `stremeno_odnym` | Стремено одним кінцем | Clove hitch (one end) | Attach to support | 1 | Tied with one end; only one end loaded → control needed |
| 15 | `shtyk` | Штик | Half hitches | Attach to support | 1 | ≥ 3 half hitches, same direction; > 5 half hitches → control not needed |
| 16 | `shtyk_tonka` | Штик навколо тонкої опори | Half hitches, thin support | Attach to thin support | 1 | Thin support = diameter ≤ rope diameter; first hitch doubled; 3 hitches need control, ≥ 4 safe |
| 17 | `shtyk_tovsta` | Штик навколо товстої опори | Half hitches, thick support | Attach to thick support | 1 | Thick support = diameter > rope; second hitch doubled; 3 hitches need control, ≥ 4 safe |
| 18 | `karabinna_udavka` | Карабінна удавка | Releasable carabiner hitch | Attach to support | 0 | Releasable by pulling the figure-8; only around support ≥ 2 carabiner lengths in diameter (carabiner must not be loaded across) |
| 19 | `prusik` | Схоплюючий Прусіка | Prusik | Grabbing | 0 | ≥ 2 turns; symmetric; cord:rope diameter ≈ 1:2; both ends loaded → ends joined |
| 20 | `prusik_odnym` | Схоплюючий Прусіка одним кінцем | Prusik (one end) | Grabbing | 1 | ≥ 2 turns; symmetric; one end loaded → control needed |
| 21 | `avstriiskyi_skhopl` | Австрійський схоплюючий | Austrian grabbing hitch | Grabbing | 0 | ≥ 3 turns; slides when pulled one way, grips the other; both ends joined |
| 22 | `bakhmana` | Схоплюючий Бахмана | Bachmann hitch | Grabbing (with carabiner) | 0 | ≥ 3 turns; both ends joined |
| 23 | `uiaa` | УІАА | Munter (Italian) hitch | Braking (belay/descent) | 0 | Know the loading direction; moving strand works on the side opposite the gate sleeve |
| 24 | `garda` | Гарда | Garda hitch | Braking / self-locking | 0 | Two identical carabiners, same direction; feeds one way, locks when loaded |

Removed by owner decision: «Удавка» (timber hitch) and «Полусхват» are **not** part of the game. Numbering in this table is the game's own and differs from the source document; data and code reference knots by `id`, never by number.

### 13.3 Situations (contexts) and ratings — initial draft

Ratings: `correct`, `acceptable` (works with drawbacks; learning hint), `wrong` (likely to fail or not do the job), `dangerous` (fails under load). Any knot not listed for a context is `wrong` by default. Contexts are derived automatically from what the player ties to what.

| Context id | Situation (uk) | correct | acceptable | wrong / dangerous / special |
|---|---|---|---|---|
| `TIE_IN_END` | Прив'язування кінця мотузки до обв'язки | Провідник вісімка одним кінцем (9) | Булінь (12); Провідник вісімка (8) via locking carabiner | dangerous: Прямий (1), Стремено (13), Стремено одним кінцем (14) |
| `TIE_IN_MIDDLE` | Прив'язування середнього учасника | Серединний провідник (10) | Провідник вісімка (8) or Подвійний провідник (11) via locking carabiner | dangerous: Стремено (13), Стремено одним кінцем (14) |
| `ANCHOR_THICK` | Мотузка до товстої опори (велике дерево, скельний виступ) | Штик навколо товстої опори (17), Булінь (12), Карабінна удавка (18) | Штик (15) | wrong: Штик навколо тонкої опори (16) |
| `ANCHOR_THIN` | Мотузка до тонкої опори | Штик навколо тонкої опори (16) | Булінь (12) | wrong: Штик навколо товстої опори (17); dangerous: Карабінна удавка (18) |
| `ANCHOR_CARABINER` | Мотузка до карабіна бази | Провідник вісімка (8), Стремено (13) | Булінь (12) | — |
| `SELF_BELAY_GRAB` | Схоплюючий вузол на перилах | Прусік (19), Австрійський схоплюючий (21), Бахмана (22) | Прусік одним кінцем (20), with control knot | diameter-ratio rule applies (§13.5.3.4) |
| `BELAY_LOWER` | Нижня страховка (видавати мотузку) | УІАА (23) on HMS locking carabiner | — | special: Гарда (24) blocks feeding (§13.6.1) |
| `BELAY_UPPER` | Верхня страховка (вибирати мотузку) | УІАА (23), Гарда (24) | — | — |
| `JOIN_SAME` | Зв'язування мотузок однакового діаметра | Грепвайн (3), Зустрічна вісімка (5), Ткацький (2) | Прямий (1) — constant load only; Зустрічний (4) — designed for tape | — |
| `JOIN_DIFF` | Зв'язування мотузок різного діаметра | Академічний (6), Брамшкотовий (7) | — | others wrong (review) |
| `LOOP_CORD` | Репшнур у кільце (для прусика) | Грепвайн (3) | Зустрічна вісімка (5) | — |

A belay device (`belay_device` item) used instead of a knot is `correct` in `BELAY_LOWER` and `BELAY_UPPER`.

### 13.4 Knot selection UX

1. The knot dialog shows **all** knots (not filtered by context — choosing is the learning task), grouped by category, with pixel icons.
2. Fields: knot, control knot (none/single/double), turns (only for knots with `minTurns`).
3. Learning mode: after selection, before confirming, show a hint if the rating is not `correct` («Цей вузол працює лише під сталим навантаженням…»). The player may still confirm.
4. Exam mode: no hint; the knot is evaluated when loaded; the explanation appears in the results screen.
5. A «Довідник вузлів» (knot reference) screen lists all knots with description, requirements and contexts; available from the main menu and, in learning mode, from the knot dialog.

### 13.5 Knot evaluation (`src/engine/knots/evaluate.ts`)

1. Input: knot id, context, control-knot choice, turns, involved items (rope/cord diameters, carabiner types, anchor type/size), load type (`static` | `shock`).
2. Output: `{ rating, failProbStatic, failProbShock, messages[] }` using values from `hazards.json`. Default values:
   1. `correct`: static 0, shock 0.
   2. `acceptable`: static 0, shock 0.05.
   3. `wrong`: static 0.3 per loaded step, shock 0.8.
   4. `dangerous`: static 0.6 per loaded step, shock 1.0.
3. Additive modifiers (capped at 1.0):
   1. Missing required control knot: +0.25 shock, +0.05 static.
   2. Turns below `minTurns`: +0.4 shock.
   3. `constantLoadOnly` knot under shock load: +0.5.
   4. Grabbing knot with cord:rope diameter ratio outside `[0.4, 0.7]`: +0.6 shock (cord too thick will not grip; too thin may cut/slip). Ratio is computed from real item diameters.
   5. Required carabiner missing or non-locking where locking is required: +0.1 shock.
   6. `minSupportDiameter` not satisfied (e.g. Карабінна удавка around a small tree): +0.5 shock.
4. Every modifier produces a message key with an explanation in Ukrainian referencing the knot id and rule.

### 13.6 Functional (non-probabilistic) knot effects

1. Гарда in `BELAY_LOWER`: rope cannot be paid out → climber cannot move away from belayer; event `knot.garda_blocks_feed` with explanation.
2. Wrong knot in `TIE_IN_*`, `ANCHOR_*` that is loaded statically (member moving along a fixed rope segment on ≥ 35°, or hanging on the rope) rolls `failProbStatic` each loaded step — a failure **causes** a fall (spec: "Wrong knot can make team member fall").
3. Untying: a knot tied around a thin support with an undoubled first hitch (§13.2 #16) costs +60 s to untie (learning detail, low priority).

---

## 14. Hazards: falls, belay, rockfall, injury

### 14.1 Fall chance

Falls combine two sources (owner decision): **terrain chance** (anyone can slip on steep ground, so belay is always tested) and **mistakes** (wrong decisions raise the chance or cause a fall directly).

1. **Terrain chance** — rolled for each member who moved this step:
   1. `pFall = baseByAngle(angle) × surfaceMultiplier(surface, season, crampons) × Π mistakeMultipliers × methodMultiplier`, capped at `pFallMax` (default 0.5).
   2. baseByAngle: 0–15° → 0; 15–25° → 0.01; 25–35° → 0.03; 35–45° → 0.06; 45–55° → 0.12.
   3. surface: grass 1.0, ground 1.0, rock 1.2, scree 1.8, snow 1.3, icy_rock 1.5, snow_scree 2.0.
   4. method: holding the rope by hand ×0.5; otherwise ×1.0.
2. **Mistake multipliers** (all in `hazards.json`, each produces an explanation message):
   1. Winter surface on ≥ 25° without crampons: ×2.0.
   2. Carried weight between `heavyKg` and `maxKg`: ×1.3 (§9.5).
   3. Moving on a belayed rope without the `go` / `belay_ready` exchange (P1/P2): ×1.5 — the team is not coordinated.
   4. More than one member on one fixed rope segment (P4): ×1.3 for each of them.
   5. Moving in the same step as being hit by an unwarned rock: ×3.0 (§14.4).
3. **Mistake-caused falls** — happen regardless of terrain chance:
   1. A wrong or dangerous knot that fails under static load (§13.6.2).
   2. An anchor or base that fails while loaded (small tree with wrong anchor knot, etc.).
   3. A belayer pulled off a stance because they belayed from the body on ≥ 25° (§14.2.2.6).
4. On terrain 0–15° there is no terrain chance; only mistake-caused falls can happen there.

### 14.2 Fall resolution (belay chain)

Principle (owner decision): a fall caught by correct protection never ends the game by itself when the fall is short. Long caught falls or slides still carry a **small** injury chance — this teaches intermediate bases and grabbing knots instead of bare carabiners. A fall held by a correct grabbing knot never injures.

For a falling member M at position `p`, find the first applicable protection, using only protection that existed at step start (§10.3):

1. **Self-belay on fixed rope** (grabbing knot or lanyard carabiner on segment S):
   1. Chain = harness → (carabiner) → grabbing knot or carabiner → segment S → anchoring knots of S → bases of S.
   2. Roll each element's `failProbShock`. If all hold:
      1. Grabbing knot: M is caught in place. Status `fallen_caught` for this step; continues next step.
      2. Carabiner only (no grabbing knot): M slides down to the lower node of S. If slide ≥ `slideInjuryThresholdM` (default 8 m) on ≥ 35°, roll injury (`pInjurySlideProtected`, default 0.1). Otherwise M must climb that part again.
   3. If any element fails → continue to the next protection (if M has another attachment) or to unprotected fall.
2. **Tied into a belayed rope** (e.g. leader on lower belay):
   1. Belay is effective only if the belayer was belaying at step start, is not busy this step, and the braking method is valid.
   2. Protection point = highest intermediate base below `p` that the rope runs through, else the belayer's position.
   3. Fall length = 2 × (p − protectionPoint) + `slackM` (default 1 m).
   4. Chain = tie-in knot → rope → intermediate base carabiner(s) → braking knot/device → belayer's base. Roll each element.
   5. If the chain holds: M ends at `max(protectionPoint − slackM, 0)` → must climb again. Injury roll if fall length > `fallInjuryThresholdM` (default 10 m on rock/icy_rock, 16 m otherwise): `pInjuryLongFall` (default 0.15, helmet ×0.6).
   6. If the belayer anchored to `body` on ≥ 25°: belayer is pulled and also falls (roll `pBelayerPulled`, default 0.7) — resolve the belayer's own protection recursively.
3. **Unprotected fall**:
   1. M slides down until the first section with angle < 20° or the start zone.
   2. Slide distance `d`. If `d ≥ 5 m` and the steepest crossed section ≥ 30°: injury with `pInjuryUnprotected` (default 0.9; rock/icy_rock 1.0). Otherwise M must climb again from the stop point.
4. Every fall produces an event with full explanation: what held, what failed and why (knot rule ids, distracted belayer, missing self-belay, etc.).

### 14.3 Members and carried items during falls

1. Carried items move with the member.
2. Items that are part of a failed structure stay where they are (e.g. a failed knot leaves the rope at the anchor).

### 14.4 Rockfall

1. A member moving on `rock`, `scree`, `snow_scree` dislodges a rock with probability `pDislodge` (default 0.05 per step; 0 for others).
2. The rock threatens members below whose position is within the fall line (all members with `s` lower than the source on the same obstacle in MVP).
3. If **any** member issues the `rock` command in the same step **or** the next step, threatened members take cover automatically: they lose their next action (forced skip, stats count as "forced"), no damage.
4. Otherwise, at the end of the next step each threatened member is hit with `pHit` (default 0.4); a hit causes injury with probability `pInjuryRock` (default 0.8, ×0.25 with helmet).

### 14.5 Injury

1. Injured member status = `injured` → **game lost** in MVP (the spec: "team member can be injured and game is lost").
2. The results screen explains the full causal chain of the injury.

---

## 15. Win / loss conditions

1. **Win**: all members in the finish zone, status not `injured`.
2. **Loss**: any member `injured`.
3. **Abort**: player can give up at any time («Здатися») → results screen with status "aborted".
4. Optional step limit (scenario field `maxSteps`, default none) → loss when exceeded.

---

## 16. Statistics (Результати)

Shown at the end of every game (win, loss, abort) and exportable as JSON.

1. Team totals:
   1. Total steps.
   2. Simulated time (hh:mm:ss) and real play time.
   3. Falls: total / caught by self-belay / caught by belay / unprotected.
   4. Injuries (with cause).
   5. Knots tied: total / correct / acceptable / wrong / dangerous; missing control knots.
   6. Commands: issued / protocol violations by type (P1–P5).
   7. Rockfall events: total / warned / hits.
   8. Equipment left on the hill (list of items).
2. Per member:
   1. Active steps (did something), skipped steps, forced skips.
   2. Distance moved up/down (m).
   3. Falls, knots tied (by rating), commands issued.
3. Learning summary: list of mistakes with short explanations and links to the knot reference / glossary entry. In exam mode this is the first time knot ratings are revealed.
4. Weight: max carried weight per member during the game and steps spent overloaded.
5. No score, grade or points (owner decision). The goal is safe completion; stats are for self-review. The results history shows previous attempts of the same scenario side by side.

---

## 17. Learning features

1. **Навчальний режим** (learning):
   1. Hints on unsafe actions before confirming (knot rating, missing belay, unprotected movement on ≥ 25°, more than one member per segment).
   2. Readiness-check warnings and the «Типовий набір» kit button.
   3. Journal messages include "why" explanations.
2. **Режим іспиту** (exam): no hints, knot ratings hidden until loaded, readiness check shows only errors. Full explanations on the results screen.
3. **Tutorial scenario** (M7, low priority): a scripted first game on a short hill with step-by-step instructions demonstrating the canonical tactic (§17.4).
4. **Canonical hill tactic** (used for tests, the tutorial and hints):
   1. Team gathers at the start base. Leader ties in (`TIE_IN_END`, Провідник вісімка одним кінцем).
   2. Belayer self-secures to the start base and organises lower belay (УІАА on HMS carabiner), shouts «Страховка готова!». Leader shouts «Пішов!».
   3. Leader climbs, clips the rope through intermediate bases (or builds them), reaches the top base, builds a base (e.g. sling + carabiner around a large tree), self-secures to it and shouts «Сам!» (the belayer then removes the belay — no further command), fixes the rope (`ANCHOR_CARABINER` or `ANCHOR_THICK`) and shouts «Перила готові!».
   4. Bottom end is fixed to the start base. Members ascend one per segment with self-belay (prusik on cord loop), shouting «Перила вільні!» after each segment.
   5. The last member unties the bottom end and ascends on upper belay from the top, retrieving the rope, so no equipment stays on the hill.
6. Descent (`descent` and `ascent_descent`): a base is built at the top; the rope is fixed doubled around the anchor or with Карабінна удавка; members descend one per segment with a grabbing-knot self-belay; the last member descends with self-belay on both strands, then pulls the rope down («Здернути мотузку») from the lower base.

---

## 18. Visual and audio specification

### 18.1 Style

1. Pixel art, side view (look from the side), bright and inspiring: clear sky gradients, layered mountains, colourful characters and gear.
2. Internal resolution 480×270, integer-scaled to the browser window (pixel-perfect, nearest-neighbour). Settings allow 2×/3×/4×/auto.
3. Tile/grid size 16×16. Characters 16×32 px. Equipment icons 16×16.
4. Limited palette (one palette per season, defined in `assets/palettes/*.json`), e.g. 32–48 colours, so swapping season assets stays consistent.
5. Font: pixel font with full Ukrainian Cyrillic including «ґ, є, і, ї, '». Verify glyph coverage before choosing (candidates must be checked, not assumed).

### 18.2 Scene layers (parallax)

1. Sky gradient + sun/clouds (summer) or soft snowfall and pale sky (winter).
2. Far mountain range (slowest parallax), mid mountains, near forest/ridge.
3. Playable hill terrain: rendered as a filled polygon from section geometry with a pixel texture per surface (grass with flowers, ground, rock, scree, snow, icy rock), not snapped to tiles, so any angle looks right.
4. Foreground decorations (grass tufts, stones, snowdrifts).
5. Trees: conifer and deciduous, small/large, summer and winter variants.

### 18.3 Characters, ropes and gear

1. Each member is drawn from layered sprites: body base (`female`/`male`), hair, outfit (season-specific), helmet, harness, backpack. Layers are recoloured with the member's appearance colours (§8.3) via palette swap, so a team of 7 looks varied with a small set of source sprites. Winter outfits are heavier (down jackets, hats under helmets) and show crampons when worn.
2. Animations: idle, walk up, walk down, climb (steep), tie knot, belay (hands on rope), shout (speech bubble with the Ukrainian command), fall/slide, caught (hanging), injured (lying), celebrate at finish.
3. Ropes are drawn as coloured pixel polylines between rope nodes with slight sag; fixed rope segments are taut. Self-belay connections are visible thin lines from harness to rope.
4. Bases show sling + carabiner on the tree/rock with a small flag icon.
5. Selected member is highlighted; members with pending actions show a small icon above the head.

### 18.4 Game screen layout

1. Main canvas (hill, characters), camera follows the selected member, free pan and zoom (1×/2×).
2. Bottom panel: one card per member — portrait, status, position, attachments, worn/carried items, chosen action. Clicking a card opens the action picker with parameters; impossible actions are disabled with a reason tooltip.
3. Right panel: Journal (event log for the current and previous steps), step counter, simulated time.
4. Top bar: obstacle name, season, mode, UA/EN toggle, buttons: Словник, Вузли, Здатися.
5. Primary button «Виконати крок» (also Enter key). Keyboard shortcuts for selecting members (1–9) and actions.

### 18.5 Asset production and hand-off

1. Art is produced by the owner with separate image-generation agents and handed to the coding agent. The coding agent does **not** create final art.
2. Until the art arrives, the coding agent uses simple placeholders (flat-colour shapes or programmatically drawn pixels) that already follow the sizes, frame counts and naming of the asset contract, so real art can be dropped in without code changes.
3. The coding agent writes and maintains `docs/ASSET_SPEC.md` — the contract handed to the art agents. For every asset it lists: id, file name, canvas size, frame size and frame count per animation, frame rate, pivot point (feet for characters), palette / recolour-mask rules, season variants, and format rules (PNG, transparent background, no anti-aliasing, no semi-transparent edge pixels).
4. Required asset groups for MVP:
   1. Characters: 2 body bases × hair variants × outfit variants (summer and winter), all animations from §18.3.2, as layered sprite sheets with recolour masks.
   2. Equipment: helmet, harness, backpack, crampons layers on characters; 16×16 UI icons for every item type (§9.1) and every knot (§13.2).
   3. Terrain textures per surface and season; trees (conifer/deciduous × small/large × season); rock outcrop, bolt, base marker.
   4. Parallax backgrounds per season (sky, far, mid, near) and foreground decorations.
   5. UI: panel frames, buttons, cursor, speech bubble, weight bar, status icons.
5. All assets are registered in `assets/manifest.json`; the loader validates it against `asset-manifest.schema.json` and reports missing or wrongly sized files at startup in dev builds.
6. A dev-only asset preview page (`/dev/assets`) renders every manifest entry with its animations and recolours, so the owner can check generated art quickly.

### 18.6 Audio (low priority)

1. Ambient: wind, birds (summer), muted wind (winter).
2. SFX: carabiner click, rope, knot, shout blip, fall, rock.
3. Mute toggle; audio off by default is acceptable for MVP.

---

## 19. Localization

1. Two complete locales: `uk` (default) and `en`. Every string — UI, journal, knot descriptions, explanations, commands, glossary — exists in both. CI fails if a key is missing in either locale.
2. Language switch (UA/EN) in the top bar and settings; switching is instant, also mid-game, and is remembered in `localStorage`.
3. **Bilingual term hints** (setting; on by default when the UI is English): domain terms are shown with the Ukrainian original next to the English text (e.g. "Fixed rope (перила)"). When the UI is Ukrainian, hovering a term shows its English equivalent. This is the main language-learning feature for non-Ukrainian speakers.
4. Commands in speech bubbles are always shown in Ukrainian, as they would be shouted; in English mode the translation is shown under the bubble.
5. Strings are keyed (`ui.*`, `term.*`, `knot.*`, `cmd.*`, `event.*`, `rule.*`). No string concatenation for sentences — use ICU-style placeholders and Ukrainian plural rules (one/few/many).
6. Default member names are Ukrainian in both locales (e.g. Оксана, Тарас, Марія, Богдан, Ірина, Андрій, Соломія, Остап, Леся, Микола).

---

## 20. Technical architecture

### 20.1 Stack (recommended)

1. TypeScript (strict), Vite.
2. Rendering: Phaser (current stable major version) with pixel-art config.
3. UI screens and panels: DOM overlay with a lightweight component library (Preact) styled with pixel-style CSS. (Alternatively all-Phaser UI — DOM is preferred for forms, accessibility and easier agent work.)
4. Tests: Vitest (engine unit + scenario tests), Playwright (smoke e2e).
5. Validation: JSON Schema (Ajv) for data files and scenarios, validated in tests and at load time.
6. Lint/format: ESLint + Prettier. CI: GitHub Actions (lint, typecheck, test, build). Deploy: static hosting (GitHub Pages).

### 20.2 Repository structure

```
/docs/                    PRD.md, DECISIONS.md, data-authoring.md
/src/engine/              pure game logic (no Phaser/DOM)
  model/                  types for entities (§5)
  scenario/               scenario creation & validation
  actions/                one module per action (§11): validate(), apply()
  resolution/             step resolver, phase order (§10.2)
  knots/                  evaluation (§13.5), functional effects (§13.6)
  hazards/                falls, belay chain, rockfall, injury (§14)
  protocol/               command protocol checker (§12.2)
  stats/                  counters (§16)
  invariants/             assertInvariants (§9.2)
  rng/                    seeded RNG (e.g. mulberry32 / PCG)
  index.ts                public API (§20.3)
/src/data/                JSON data + schemas
  knots.json, contexts.json, hazards.json, rules.json, actions.json,
  commands.json, protocol.json, equipment.json
  presets/hills/*.json, presets/kits/*.json
  schemas/*.schema.json
/src/i18n/                uk.json, en.json, i18n.ts
/src/game/                Phaser scenes: Boot, Preload, Hill, render helpers
/src/ui/                  screens (§6.1), panels, dialogs
/assets/                  sprites, tiles, backgrounds/{summer,winter}, fonts, palettes, manifest.json
/tests/                   engine unit tests, scenario tests, e2e
```

### 20.3 Engine public API

```ts
createGame(scenario: Scenario): GameState            // validates scenario, places team & items at start
getActionOptions(state, memberId): ActionOption[]     // all actions with enabled/disabled + reason
validatePlan(state, plan: PlannedAction[]): PlanValidation
resolveStep(state, plan: PlannedAction[]): { state: GameState; events: GameEvent[] }
evaluateKnot(input: KnotEvalInput): KnotEvaluation    // used by UI hints and engine
getStats(state): Stats
getOutcome(state): "in_progress" | "won" | "lost" | "aborted"
replay(scenario, history: PlannedAction[][]): GameState
```

1. `resolveStep` is pure: returns a new state, never mutates input.
2. `GameEvent` is typed, carries an i18n key + params, and references rule/knot ids for explanations.

### 20.4 Data file example (`knots.json`, excerpt)

```json
[
  {
    "id": "prusik",
    "nameKey": "knot.prusik.name",
    "descriptionKey": "knot.prusik.description",
    "category": "grabbing",
    "controlKnotsRequired": 0,
    "minTurns": 2,
    "conditions": {
      "diameterRatio": { "min": 0.4, "max": 0.7, "ideal": 0.5 },
      "endsMustBeJoined": true,
      "symmetric": true
    },
    "requires": ["locking_carabiner"],
    "icon": "knot_prusik"
  },
  {
    "id": "bulin",
    "nameKey": "knot.bulin.name",
    "descriptionKey": "knot.bulin.description",
    "category": "attach_support",
    "controlKnotsRequired": 1,
    "conditions": { "freeEndEitherSide": true },
    "requires": [],
    "icon": "knot_bulin"
  }
]
```

`contexts.json` (excerpt):

```json
{
  "SELF_BELAY_GRAB": {
    "nameKey": "context.self_belay_grab",
    "ratings": {
      "prusik": "correct",
      "avstriiskyi_skhopl": "correct",
      "bakhmana": "correct",
      "prusik_odnym": "acceptable"
    },
    "default": "wrong"
  }
}
```

### 20.5 Hill preset example (`presets/hills/skhyl-z-derevamy.json`)

```json
{
  "id": "skhyl-z-derevamy",
  "nameKey": "preset.hill.trees",
  "type": "hill",
  "routeType": "ascent",
  "startZoneM": 6,
  "sections": [
    { "lengthM": 15, "angleDeg": 15, "surface": "grass" },
    { "lengthM": 20, "angleDeg": 28, "surface": "grass" },
    { "lengthM": 20, "angleDeg": 38, "surface": "ground" },
    { "lengthM": 15, "angleDeg": 45, "surface": "rock" }
  ],
  "trees": [
    { "id": "t1", "s": 3, "size": "large" },
    { "id": "t2", "s": 35, "size": "large" },
    { "id": "t3", "s": 55, "size": "small" },
    { "id": "t4", "s": 71, "size": "large" }
  ],
  "basePoints": [
    { "id": "bp_start", "s": 3, "anchorType": "tree", "treeId": "t1" },
    { "id": "bp_mid1", "s": 35, "anchorType": "tree", "treeId": "t2" },
    { "id": "bp_mid2", "s": 55, "anchorType": "rock_outcrop" },
    { "id": "bp_top", "s": 71, "anchorType": "tree", "treeId": "t4" }
  ]
}
```

---

## 21. Data authoring rules

1. All data files have JSON Schemas; CI fails on invalid data.
2. Every knot in `knots.json` has `nameKey`, `descriptionKey` and at least one entry in `uk.json`.
3. Every rating in `contexts.json` references an existing knot id.
4. Probability values are in `[0, 1]`; distances in metres; durations in seconds.
5. `docs/data-authoring.md` explains how an instructor can edit knots, contexts and hazards without touching code.

---

## 22. Non-functional requirements

1. Desktop browsers only: current Chrome, Firefox, Edge, Safari; minimum window 1280×720; mouse + keyboard. Tablets and phones are not supported in MVP (no touch UI needed).
2. 60 fps rendering on a mid-range laptop; step resolution < 50 ms for 7 members.
3. Initial load < 5 MB for MVP assets.
4. Deterministic engine (seeded); replay of a saved history yields an identical state.
5. Accessibility: all UI actions available via keyboard; text contrast sufficient; colour is not the only way to distinguish members (names/numbers on cards and above heads).
6. No personal data collected; no network calls after load.

---

## 23. Milestones (agile increments)

Each milestone ends with a playable or testable increment and a short demo note in `docs/CHANGELOG.md`.

1. **M0 — Skeleton**: Vite + TS + Phaser + Preact + Vitest + ESLint + CI; empty screens wired in the flow of §6.1; i18n setup with `uk.json`.
   DoD: CI green; app deploys; navigation through all screens with placeholder content.
2. **M1 — Engine core (headless)**: domain model, seeded RNG, hill geometry, equipment & invariants, actions §11.1, §11.4–§11.8 (without knots/belay effects), step resolution order, time model, stats skeleton.
   DoD: unit tests for every invariant in §9.2 and every action precondition; a scripted scenario where 5 members walk up a 0–15° hill and win.
3. **M2 — Knots, belay, hazards**: `knots.json`, `contexts.json`, `hazards.json`, knot evaluation, belay action, base action, fall resolution chain, rockfall, injury, protocol checker.
   DoD: scenario tests in §24.2 pass.
4. **M3 — Configuration screens**: hill presets + editor with preview, season/mode, team, equipment pool & assignment, readiness check, scenario save/load/import/export.
   DoD: a scenario can be fully configured in UI, exported, imported and started.
5. **M4 — Game screen (summer)**: rendering of hill, parallax background, characters, ropes, bases; member cards & action picker; knot dialog; journal; step button; animations (basic set).
   DoD: the canonical tactic (§17.4) is playable end-to-end in the browser with placeholder or first-pass art.
6. **M5 — Results & learning**: results screen (§16), learning/exam differences (§17), glossary and knot reference screens, complete English locale and bilingual term hints.
   DoD: playtest by owner; all stats visible; exam mode hides knot ratings until loaded.
7. **M6 — Winter season**: winter surfaces & modifiers, winter assets, crampons/ice axe items.
   DoD: same hill playable in winter with visibly different art and rule modifiers covered by tests.
8. **M7 — Polish**: integrate the final art set from the owner (§18.5), sound, tutorial scenario, performance and accessibility checks.

---

## 24. Acceptance criteria (MVP)

### 24.1 Functional

1. The player can select the Hill obstacle; other obstacles are visible but locked.
2. The player can configure sections (angle, length, surface), trees and base points, or pick a preset.
3. The player can set team size 2–7 (default 5) and get that many members, each with configurable name and colour.
4. All equipment is configured and assigned to specific members before start; nothing can be added during the game.
5. Each step the player selects an action or skip for every active member; the game resolves them together.
6. Knot choice is required whenever a knot is tied; wrong knots can cause falls.
7. Falls with correct belay/self-belay are caught; incorrect protection can lead to injury and loss, or to re-climbing.
8. The results screen shows total steps, active and skipped steps per member, simulated time and the other stats of §16.
9. Summer and winter are both selectable and visually distinct.
10. All UI is available in Ukrainian (default) and English, switchable at any time.
11. Route type (ascent / descent / ascent + descent) is configurable and all three are playable.
12. Equipment weight is tracked; members cannot exceed max capacity; overloaded members are slower and fall more often.

### 24.2 Scenario tests (engine, deterministic seeds)

1. **Golden path**: preset «Схил з деревами», 5 members, typical kit, canonical tactic (§17.4) → `won`, zero injuries, zero items left, zero protocol violations, with a fixed seed forcing at least one fall that is caught by a prusik.
2. **Wrong tie-in knot**: leader ties in with Стремено (`dangerous` in `TIE_IN_END`) and falls on the 38° section → chain fails → unprotected fall → `lost`.
3. **Distracted belayer**: belayer ties a knot in the same step the leader moves and the leader falls → belay inactive → unprotected fall.
4. **Belay set in the same step**: belay organised and climber moves in the same step, climber falls → not protected (§10.3).
5. **Garda in lower belay**: leader cannot move further than slack; event `knot.garda_blocks_feed` emitted.
6. **Prusik diameter ratio**: 10 mm cord on 10 mm rope → shock fail probability increased; with forced roll, fall not caught.
7. **Carabiner-only self-belay**: member slides to the lower node and must climb again.
8. **Rockfall warned vs unwarned**: with «Камінь!» in time → no hits, forced skips counted; without → hit rolls happen; helmet reduces injury.
9. **Accountability**: attempting to use a rope not carried by an adjacent member is impossible (action disabled with reason); passing an item to a non-adjacent member is impossible; rope cannot be stretched beyond its length.
10. **Determinism**: replaying the golden-path history with the same seed yields a deep-equal final state.
11. **Missing control knot**: anchor knot requiring 1 control knot tied without it → shock failure probability +0.25 reflected in evaluation and explanation message.
12. **Descent pull-down**: on «Спуск зі схилу», the last member descends on a doubled rope / Карабінна удавка and pulls it down → the rope arrives at the member; only intentionally abandoned items (e.g. a sling) are reported as left.
13. **Weight cap**: assigning items above `maxKg` is rejected; a member between `heavyKg` and `maxKg` has move distance ×0.7 and fall multiplier ×1.3.
14. **Long caught fall**: leader caught by correct lower belay after a 14 m fall on rock rolls injury with the small configured probability; the same situation with an intermediate base (4 m fall) has no injury roll.
15. **Locale completeness**: every i18n key exists in `uk` and `en`.

---

## 25. Future scope (design notes for later obstacles)

1. **Obstacle chains**: route = ordered list of obstacles; the finish zone of one obstacle is the start zone of the next; equipment and team state carry over; statistics per obstacle and total.
2. **Vertical rock (Вертикальна скеля)**: configurable height; climbing with lower belay and intermediate protection; rappel (спуск по вертикальних перилах) with УІАА or device; vertical fixed ropes.
3. **Ravine (Яр / провалля)**: Tyrolean traverse (навісна переправа) — rope tensioned between two bases (Гарда, поліспаст), crossing with carabiner and self-belay.
4. **River (Річка)**: configurable width and water speed; wading with team belay (переправа вбрід), rope across the river, risk of being swept; wet equipment effects.
5. **Injury handling**: first aid and evacuation instead of instant loss.
6. **Weather and time of day**, more seasons, fatigue, backpack weight.

---

## 26. Open questions (owner to answer)

1. ~~Полусхват~~ — resolved: removed from the game, together with Удавка (§13.2).
2. **Deferred — owner will review later.** Situation ratings in §13.3 are an initial draft (especially `JOIN_DIFF` and the `TIE_IN_*` acceptable options). Agents implement them as written; they live in `contexts.json`, so changes need no code.
3. ~~Commands~~ — resolved: «Сам!» for `secured`, «Закріпи!» for `hold`, no `belay_off` (§12.1).
4. ~~Utility actions (§11.8)~~ — resolved: detach/untie and pass equipment are required.
5. ~~Caught falls~~ — resolved: small injury chance on long caught falls/slides (§14.2).
6. ~~Route~~ — resolved: configurable ascent / descent / ascent + descent (§7.1.7).
7. ~~Language~~ — resolved: full UA/EN with a switch (§19).
8. ~~Art~~ — resolved: owner provides agent-generated art; coding agent uses placeholders and maintains the asset contract (§18.5).
9. ~~Title~~ — resolved: «Закріпи! Готово! Рух!».
10. ~~Injury~~ — resolved: game lost immediately (§14.5).
11. ~~Scoring~~ — resolved: no score, stats only (§16.5).
12. ~~Member differences~~ — resolved: equal abilities, different appearance (§8).
13. ~~Weight~~ — resolved: weight capacity in MVP (§9.5).
14. ~~Fall randomness~~ — resolved: terrain chance combined with mistakes (§14.1).
15. ~~Devices~~ — resolved: desktop browsers only (§22.1).
16. ~~Team size~~ — resolved: 2–7 members (§8.1).
17. ~~Base weight~~ — resolved: 15 kg in every season (set in Settings), limits 25/30/35 kg on total weight (§9.5).
