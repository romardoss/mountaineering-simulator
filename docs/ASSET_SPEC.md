# Asset spec — contract between the art agents and the code

This is the contract the code relies on (PRD §18.5.3). It follows `docs/ASSET_PROMPTS.md` with the deviations marked **Δ**. `assets/manifest.json` lists what exists; missing assets are drawn as programmatic placeholders, so new art can be dropped in without code changes.

## 1. Pipeline

1. Put raw generations (any size, JPEG or PNG, `#00FF00` chroma background) in `assets/raw/<group>/<id>.jpg|png`.
2. Run `npm run assets` (`tools/process-assets.mjs`): chroma key with despill → frame detection for team sheets → block-majority downscale → strict 0/255 alpha → PNG-32 at `assets/<group>/<id>.png` → `assets/manifest.json`.
3. The game loads everything listed in the manifest (`src/game/assets.ts`).

## 2. Format rules

1. PNG-32, transparent background, no anti-aliasing, no semi-transparent pixels, nearest-neighbour only.
2. Outline `#1A1C2C`. Palettes per `docs/ASSET_PROMPTS.md` §2–§5.
3. No text in images (all text is rendered with the pixel fonts).

## 3. Assets

| Group | id | Size (px) | Frames | Notes |
|---|---|---|---|---|
| art | `art_key_art` | 480×270 | — | menu background ✅ |
| art | `art_ravine_bg` | 640×360 | — | ravine background (CR-52), from `raw/art/Піксельна панорама гірської долини.png` ✅ |
| art | `art_logo_emblem`, `art_obstacle_{hill,rock,ravine,river}` | 128×64, 96×64 | — | ⏳ not yet generated (CSS/SVG placeholders) |
| characters | `team_<anim>` | 32·N × 224 | N per row | **Δ 32×32 cells** (7 rows = members 1–7), pivot (16,31), facing right |
| characters | `team_idle` 4, `team_walk_up` 6, `team_walk_down` 6, `team_climb` 6 | | | ⏳ missing: idle/walk use `team_tie_knot` frame 0 + bob |
| characters | `team_tie_knot` 6, `team_belay` 4, `team_shout` 4, `team_celebrate` 6, `team_fall` 4, `team_slide` 3, `team_hang` 3, `team_injured` 2 | | | ✅ |
| terrain | `terrain_<surface>_fill` | **Δ 128×128** | — | opaque, tiles both ways ✅ grass/ground/rock/scree |
| terrain | `terrain_<surface>_edge` | **Δ 128×32** | — | transparent top, tiles left–right ✅ |
| terrain | winter surfaces | | | ⏳ code tints summer textures |
| trees | `tree_conifer_small` 24×40, `tree_conifer_large` 40×72 | | | ✅ trunk base bottom-centre |
| trees | `tree_deciduous_small` 24×40, `tree_deciduous_large` 48×72 | | | ⏳ placeholder |
| props | `prop_rock_outcrop` 32×24, `prop_bolt` 8×8, `prop_base_marker` 16×16, `prop_falling_rock` 4×8×8, `prop_dust_puff` 4×16×16, `prop_clouds` 192×24, `prop_sun` 24×24 | | | ⏳ placeholders |
| decor | `decor` | 128×16 | 8 | ⏳ |
| backgrounds | `bg_sky` 480×270, `bg_far` / `bg_mid` / `bg_near` 960×270 | | | ⏳ programmatic parallax |
| icons | `icon_*` (equipment) 16×16 | | | ⏳ text labels |
| icons | `knot_<id>` (`icons/knots/`, = `knots.json` `icon`) | variable, ≤ 200×82 | — | ✅ 18 of 24, transparent, 200-px logical grid; `*_odnym` = base knot + red cross on one end; shown in the knot dialog and the knot reference. ⏳ missing `tkatskyi`, `zustrichnyi`, `shtyk`, `shtyk_tonka`, `shtyk_tovsta`, `karabinna_udavka` (name only) |
| ui | `ui_*` | see prompts | | ⏳ CSS styling |

## 4. Manifest format

```json
{
  "_note": "…",
  "team_belay": { "file": "characters/team_belay.png", "width": 128, "height": 224, "frameWidth": 32, "frameHeight": 32, "frames": 4, "rows": 7 },
  "terrain_rock_fill": { "file": "terrain/terrain_rock_fill.png", "width": 128, "height": 128 }
}
```

`frameWidth` / `frameHeight` / `frames` / `rows` appear on sheets only.
