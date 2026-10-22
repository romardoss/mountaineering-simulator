# Decisions and assumptions

ADR-lite log of interpretations of `PRD.md` v0.1 and deviations from it (PRD §0.1). Newest decisions are added at the end. Each entry: what, why, where in code.

## A. Adopted assumptions from `ARCHITECTURE.md` §11

1. **D-1 Protocol and physics (P-PRD-1).** P1/P2 (moving on belay without «Страховка готова!» / «Пішов!») and P4 (crowded segment) multiply fall chance (§14.1.2 wins over §12.2.2). Other violations are counted only. `engine/resolution/resolve.ts` (`protocolBeforeMovement`), `engine/hazards/falls.ts`.
2. **D-2 Stats count every rule in `protocol.json`** (P1–P7), not only P1–P5.
3. **D-3 "Below" uses elevation.** Fall line, threatened members and "lower node" use elevation (`geometry.isBelow`, `elevationOfS`); fall and slide lengths use path distance along `s`.
4. **D-4 `PRD.md` stays at the repository root.**
5. **D-5 PRD numbering** issues (two §8.5, §17.4 item 6) are left for the next PRD revision; references in code use the intended meaning.
6. **D-6 Backpack weight is MVP** (§9.5), not future scope.
7. **D-7 A rope becomes `in_use`** as soon as one of its ends is tied to a harness or a base (or it is rigged doubled); from then on its weight counts for nobody.
8. **D-8 Retrieval by the last member** works with existing actions: untie the bottom fixed node (it becomes a free end), tie into that end, the member above unties the top fixed node and belays from above; the harness node follows the member. Coiling requires every node to be next to the member.
9. **D-9 "Loading the rope" for P7**: P7 is recorded when a fall is caught on a belay and the climber did not shout «Закріпи!» in that step or the step before.

## B. Geometry and route

1. **D-10 Start zone precedes the first section.** `s = 0 … startZoneM` is the flat start zone, sections start at `s = startZoneM`, then (for `ascent_descent`) a flat summit zone of `summitZoneM`, then the descent sections, then the flat finish zone of `finishZoneM`. Preset coordinates (`src/data/presets/hills`) are authored this way; the PRD §20.5 example coordinates are therefore shifted.
2. **D-11 One movement action with a direction.** The engine has a single `move` action with `toward: "finish" | "start"`. The UI labels it «Йти вгору» / «Йти вниз» from the elevation change in that direction (§7.1.8), so the summit (where "down" is ambiguous) still works.
3. **D-12 Multi-section moves.** The per-step distance budget is consumed section by section (§7.2 band × modifiers), so crossing a boundary mixes both bands.
4. **D-13 Members start at the start-zone base point** (or the middle of the start zone).

## C. Actions (§11)

1. **D-14 Finer-grained action kinds.** «Зав'язати вузол» is split into `tie_in` (TIE_IN_END) and `fix_rope` (ANCHOR_*), «Організувати страховку» into `belay` / `stop_belay`, utility actions into `detach` (attachment, untie, unclip, dismantle base, coil, pull down), `pass`, `pickup`, `drop`, `wear`, `take_off`. A new `clip` action runs a rope through an intermediate base's carabiner (§11.6.4 needs it but §11 has no action). The action picker groups them under the PRD names.
2. **D-15 Middle tie-in and joining ropes** (`TIE_IN_MIDDLE`, `JOIN_SAME`, `JOIN_DIFF`) are in `contexts.json` and the evaluator but have no in-game action in MVP (no scenario needs them yet).
3. **D-16 Fixing a rope from the harness.** When the leader fixes the rope end they are tied into, the tie-in knot is replaced by the anchor knot (they untie as part of fixing).
4. **D-17 Deploying a coiled rope.** Fixing a carried rope to a base throws the free end downhill (up to the rope length); a doubled rope throws both ends half the length. A member may carry a free end that is within reach to the base to fix it.
5. **D-18 Pull-down («Здернути мотузку», §7.1.9)** requires the member to stand below the anchor along the rope line (not necessarily at an end); nobody may be tied in, attached or belaying on it, and it must not run through intermediate carabiners.
6. **D-19 Гарда in lower belay** lets the climber move away from the belayer only up to the distance when the belay was set + `slackM` (§24.2.5 "cannot move further than slack").
7. **D-20 Belayer is "busy"** when doing anything other than a command, `belay` or `stop_belay` in the same step.
8. **D-21 Taking cover** from a warned rock cancels all of that member's actions in the step (they lose their next action).
9. **D-22 Attachments per member.** Up to `lanyard.arms` non-hand attachments (at least 1 without a lanyard, e.g. a prusik) plus one hand.
10. **D-23 Carabiner capacity** (§9.2.5) counts ropes clipped to / tied to a base carabiner. Self-belay lanyards clip into the anchor sling and are not counted.

## D. Hazards and knots

1. **D-24 New data-driven modifiers**: grabbing knot that needs a cord loop on an unlooped cord (+0.4 shock), Гарда on one carabiner (+0.3 shock), non-locking carabiner opening in a self-belay (0.1), anchor failure by anchor type (`hazards.anchors`: small tree 0.15 shock / 0.02 static, rock outcrop 0.02). All in `src/data/hazards.json`, to be reviewed by an instructor with §26.2.
2. **D-25 Static load** (§13.6.2) rolls the anchor knots of a fixed-rope segment for each member moving on it on ≥ `staticLoadDeg` (35°), and the tie-in knot of a member who hangs on the rope since the previous step.
3. **D-26 Belayer pulled off** (§14.2.2.6) uses the angle at the belayer's position; if their own fall is unprotected the climber is unprotected too.
4. **D-27 Upper belay** fall length = `slackM`; lower belay uses the §14.2.2.3 formula.
5. **D-28 Unprotected slide** stops early if a rope the member is tied into comes tight.
6. **D-29 Pre-tied cord loops** count in knot statistics as pre-tied (§9.3.4) but are not knot instances in game state.
7. **D-30 Exam mode**: a knot's rating is revealed when it is loaded (rolled under shock or static load) and on the results screen.

## E. Win, stats

1. **D-31 Win** = every member in the finish zone with no injury; it is checked at the end of every step. Members keep acting in the finish zone until everyone has arrived (`finished` is set at the win).
2. **D-32 "Left on the hill"** = items not carried/worn whose position is outside the finish zone (a base or rope at the top is with the team).

## F. Technology and assets

1. **D-33 Library majors**: Phaser 3.90, Preact 10, TypeScript 5.9, Vite 7, Vitest 3 — known-stable majors rather than the newest (Phaser 4, TS 7) to reduce risk.
2. **D-34 Fonts**: «Press Start 2P» for titles and buttons, «Tiny5» for body text; both bundled locally (no network, §22.6) and verified to contain ґ є і ї Ґ Є І Ї and the apostrophe. «Pixelify Sans» was rejected: its Cyrillic subset lacks І, О, П.
3. **D-35 Team sprite cells are 32×32** (not 16×32): lying/falling poses are wide (P-SPEC-8). Pivot (16, 31). Terrain fills 128×128 and edges 128×32 (P-SPEC-9). See `docs/ASSET_SPEC.md`.
4. **D-36 Fixed sprite rows** (P-SPEC-1): appearance = sprite row 0–6 (assigned randomly among unused rows since CR-4, see D-42); no layered body/hair/outfit recolouring in MVP.
5. **D-37 Backpack** is implicit: `member.baseWeightKg` is the backpack base weight (§9.1); there is no backpack item instance (it cannot be passed or dropped anyway).
6. **D-38 Rope weight** = 0.07 kg/m × (diameter / 10 mm)².

## G. Owner change requests (2026-10-21, specification CR-1…CR-6)

1. **D-39 Obstacle library** (CR-1): obstacles are defined before the game. Built-in presets are read-only; the constructor works on copies (`hill_*` ids) stored in `zgr.v1.obstacles`. The play flow copies the chosen hill into the scenario, so editing or deleting a library hill never changes saved scenarios. Hill import/export as separate files is not part of this change (scenario export still contains the hill).
2. **D-40 Base spots vs bases** (CR-2): «база» in the UI means only a built base; a `BasePoint` is labelled «місце для бази» / "base spot". The single mandatory base spot is in the finish zone ("something at the end to make the base"). Start position stays D-13 (start-zone base spot if any, else the middle of the start zone).
3. **D-41 No roles** (CR-3): roles were redundant configuration. Team order replaces them where an order is needed (typical kit: team gear to the first member, belay device to the last). The glossary keeps `term.leader` / `term.last` as climbing vocabulary — they describe whoever goes first / last in a tactic, not a configured role. Legacy `role` in imported JSON is accepted and dropped.
4. **D-42 Random distinct look** (CR-4): sprite rows are assigned with `Math.random` in the UI layer (visual only, not part of the deterministic engine state that matters for replay). With at most 7 members and 7 rows, looks are always distinct.
5. **D-43 Equipment groups are presentation only** (CR-6): items stay individual `ItemConfig`s in the scenario and the engine; the equipment screen groups by type + props + weight. Lowering a group's count removes unassigned copies first.
6. **D-44 Weights live in Settings** (CR-7): the configuration holds no weights. Every member carries the same base backpack (`weights.backpackBaseKg`, default 15 kg, the summer/winter split is gone); standard item weights are per kind. For determinism `startGame` writes a snapshot `scenario.weights` from Settings, and `createGame` computes item / member weights from it, so a saved game replays with the weights it started with. Changing Settings never alters a game in progress; replaying a finished scenario uses the current Settings.
7. **D-45 No take-off** (CR-8): the `take_off` action is removed completely. Wearing (`wear`) stays, so a carried wearable can still be put on.
8. **D-46 Implicit harness and helmet** (CR-10): «treat them as always present» is implemented like the backpack (D-37): `createGame` gives every member a worn harness and helmet (ids `harness@m`, `helmet@m`, weights from Settings), so they are real items for the engine (tie-in, helmet injury factor, accountability) but never configured. Because they can be neither taken off (CR-8) nor be missing, the no-helmet branches of the injury rules are unreachable from the UI; the engine keeps them.
9. **D-47 Member quantity + on an empty pool** (CR-9): when no free piece of the group exists, + creates a new copy rather than being disabled, so the member list can be edited without going back to the pool.
10. **D-48 Rain and mud** (CR-11): "probability of rain and mud" is two numbers per season. Weather is rolled once per game (not per step) in `createGame` from the seeded RNG, so a scenario + seed always gives the same weather and replays stay deterministic; tests force it with `weather:*` rolls. Rain implies mud. Effects reuse the existing surface mechanism: new surfaces `mud` and `wet_rock` with their own fall and move factors. Rain on scree changes nothing (no extra data asked for). Spring and autumn use the summer kit.
11. **D-49 Belay gloves are implicit** (CR-12): «страхувальні рукавиці» are always provided by default, so they join harness and helmet in `IMPLICIT_WORN`.
12. **D-50 Individual equipment** (CR-14): the listed personal items are data (`individual.json`) and created by `createGame` for every member, like the harness and helmet before (D-46). «Спусковий пристрій» is the existing belay device (ATC), used for belay and descent. «Прусики» are the accessory cord loops pre-tied with Грепвайн, two per member. Crampons and ice axe are given only in winter: they make no sense on a summer hill and the request did not say otherwise — confirm with the owner.
13. **D-51 Жумар** (CR-14): a new carried item type `ascender` (0.2 kg, editable in Settings) without an action yet; an ascending action can be specified later.
14. **D-52 HMS and rope diameter** (CR-15, CR-16): only the equipment UI changes; the engine keeps `shape` and `diameterMm` (knot rules use them). Knot descriptions in the knot reference still mention HMS.
15. **D-53 Lanyard is individual** (CR-17): one 2-arm «вус самостраховки» per member in `individual.json`; the typical kit keeps only the team carabiners, ropes and slings.
16. **D-54 Right-click goal** (CR-18): "go to that point" is a goal kept by the app across steps (not engine state): each step plans an ordinary `move` with `distanceM = |target − pos|`, the engine clamps it to the reach, so history and replay are unchanged. The goal stops when the member is not `ok`, makes no progress, or gets another action — the player stays in control of safety (protocol, belay) every step. Goals are not autosaved. The picker move option keeps working for keyboard users (full reach).
17. **D-55 Uphill ×1.5** (CR-19): the owner asked for longer uphill moves without a number; ×1.5 on uphill segments (`rules.moveModifiers.uphill`) is a first guess — change it in data.
18. **D-56 Station icon** (CR-20): the icon is shown on a left-click on a base spot (as asked), not permanently; it plans the first enabled construction (sling before direct). Bolts are included although the request named trees and rocks.
19. **D-57 Control knots always correct** (CR-21): "default all knot checks to correct" = the control knots (контрольки) are always tied correctly: `double` when the knot needs control, `none` otherwise. The engine still evaluates the given control (tests, imported histories).
20. **D-58 Untie after «Сам!»** (CR-22): the climber must be self-secured (non-hand attachment) and have shouted `secured` in an earlier step; untying their tie-in then ends the belay (braking items return to the belayer). This is the climber's own decision, so no P6.
21. **D-59 Friction hitch on a fixed rope** (CR-23): "safe movement" = no terrain fall roll below 55° for grabbing-knot movers; "the rope must remain fixed" = their movement does not roll the static failure of the segment's anchor knots. Lanyard-carabiner movers keep both rolls.
22. **D-60 No drop, no move in the picker** (CR-24, CR-25): the drop action is removed from the engine; move options stay in the engine (they explain why a move is impossible) but the picker hides them.
23. **D-61 Belay readiness** (CR-26, owner answer): a belay catches a fall only after its belayer shouted «Страховка готова!»; the belayer must be self-secured at a base to set it up. Because the commands phase precedes the belay phase, the shout can only come on the step after the belay is set, so P1 no longer fires for a belay created in the same step. A body-anchored belayer pulled off their stance is now caught by their own self-belay at the base.
24. **D-62 Intermediate protection point on the map** (CR-27, owner answer): a built base next to a climber tied into a rope offers «Організувати проміжний пункт страховки» = the existing `clip` action (running node); an empty spot offers «Організувати базу».
25. **D-63 Fall-length injury** (CR-28, owner answer): replaces the 10 / 16 m threshold. Values (`freeM 4`, 0.02 / 0.012 per metre, max 0.6) are a first calibration.
26. **D-64 «8К» and rock** (CR-29, owner answer): «8К» = Провідник вісімка on a carabiner (already correct); Зустрічна вісімка tied around a tree is correct; around a rock outcrop all direct knots are one rating step worse (`ANCHOR_ROCK`), so a base carabiner is the better choice on rock.
27. **D-65 Idle stroll** (CR-30, owner answer): cosmetic only, ≤ 1 m, a pause of 8–15 s per member, one member at a time, never into a teammate (≥ 0.7 m), only in safe zones and only for free members (not tied in, attached or belaying, no planned action). Uses `Math.random` in the renderer — it never touches game state.
28. **D-66 Large trees are base spots** (CR-31, owner answer): trees are only «small» or «large», so the threshold is the size class: every large tree is a base spot automatically (`bp@<treeId>`), also for the finish-zone rule; small trees only where configured. Hill data is unchanged; the effective list is derived.
29. **D-67 Free commands** (CR-37, owner answer): one action + one command per member per step. Commands keep resolving first (commands phase), so a command cannot depend on an action of the same step — this is why «Страховка готова!» is offered only once the belay exists (CR-34).
30. **D-68 Belay options** (CR-33, owner answer): shown only to a member clipped to a base, base anchor only, enabled only. Body belay remains in the engine (tests, old histories).
31. **D-69 Direct base warning** (CR-39, owner answer): sling + locking carabiner is the default; without them the player confirms a direct base.
32. **D-70 Member card gear** (CR-40, owner answer): the card lists only team gear (icons ×N); the individual set is identical for everybody and sits behind one icon with a tooltip.
33. **D-71 Parallax** (CR-32): the effect is kept; the fixes are same-frame following, textures per view height and a padded layer height.

