# Data authoring guide (for instructors)

All game rules live in JSON files under `src/data/` (PRD §0.2.3, §21). You can change them without touching code. After editing, run `npm test` — it checks every file (cross-references, probabilities in [0, 1], texts in both languages).

## Files

| File | What it controls |
|---|---|
| `rules.json` | Adjacency (2 m), knot allowance per knot on a rope, carabiner capacity, movement per step by angle band, move modifiers, weight thresholds (25 / 30 / 35 kg), backpack base weights, team size, hill limits |
| `hazards.json` | Fall chance by angle and surface, mistake multipliers, knot failure probabilities by rating, knot modifiers, anchor failure by anchor type, injury thresholds and chances, rockfall, winter surface mapping |
| `knots.json` | The knot catalog (§13.2): category, control knots required, minimum turns, constant-load-only, grabbing diameter ratio, support requirement, required carabiners, releasable |
| `contexts.json` | Ratings of every knot in every situation (§13.3). A knot missing from a context gets the context's `default` (normally `wrong`). An entry can be conditional: `{ "rating": "acceptable", "requires": "locking_carabiner", "otherwise": "wrong" }` |
| `actions.json` | Simulated durations in seconds (§10.4) |
| `commands.json` | Commands and the wrong phrasings for the language-practice option |
| `protocol.json` | Protocol rules P1–P7: on/off, severity. New *kinds* of rules need code |
| `equipment.json` | Item catalog and default properties (weights are in `weights.json`, editable in Settings) |
| `weights.json` | Default base backpack weight and standard item weights (the values in use are set in Settings) |
| `individual.json` | Personal equipment every member gets automatically (`always`, plus `winter`); these types are never in «Що беремо» |
| `seasons.json` | Rain and mud probability per season and how weather changes surfaces |
| `presets/hills/*.json` | Hill presets. Sections start after the start zone (`s = startZoneM`); trees and base points use `s` in metres along the path |
| `presets/kits/typical.json` | «Типовий набір»: team gear per member and per team (individual equipment is not part of it) |

## Texts

Every key has a Ukrainian and an English text in `src/i18n/locales/uk/*.json` and `src/i18n/locales/en/*.json` (knot names: `knot.<id>.name`, descriptions: `knot.<id>.description`). Messages use ICU format, e.g. `{count, plural, one {# річ} few {# речі} many {# речей} other {# речі}}`.

## Examples

1. Make Булінь `correct` for tying into the harness: in `contexts.json`, `TIE_IN_END.ratings.bulin = "correct"`.
2. Make small trees safer: `hazards.json` → `anchors.tree_small.shock = 0.05`.
3. Slower movement on 25–35°: `rules.json` → the `angleBands` entry with `maxDeg: 35` → `moveM: 2.5`.
