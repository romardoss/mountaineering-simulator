# Asset generation prompts — «Закріпи! Готово! Рух!» (summer, v2)

Batch of image-generation prompts for the MVP assets: **summer only, no knot images**. Every team member wears the same outfit in different colours, and each character animation is generated as **one sheet with all seven members** (one member per row) so they come out in the same style. Each prompt is self-contained (style, size, palette and colours are embedded).

Total prompts: **67**.

## 1. How to use this file

1. Generate in the order of the sections in §5 — the key art first, then the team sheets, then the rest.
2. Every prompt states the **logical pixel size** and a **generation scale**. Generate at the scaled size, then post-process (§4) down to the exact logical size.
3. When a prompt says ATTACH AS REFERENCE, pass that already-approved image to the model together with the prompt.
4. If the model supports a separate negative prompt, use this one for every asset:

```
Avoid: anti-aliasing, soft edges, blur, photorealism, 3D render, gradients, noise, JPEG artifacts, text, letters, numbers, logos, watermark, drop shadows outside the sprite, inconsistent pixel size, different clothing styles between team members, colours outside the given palette.
```

5. Save each result under the `file` path given (relative to the game repository). The coding agent's `docs/ASSET_SPEC.md` and `assets/manifest.json` must use the same ids, paths, sizes and frame counts as this file.

## 2. Team

1. All members wear the same outfit: softshell jacket, trekking pants, brown hiking boots, climbing helmet, harness with two carabiners, trekking backpack with a blue sleeping mat. Only colours, skin, hair and a slight body-type difference change between members.
2. Helmet, harness and backpack are drawn as part of every sprite (no separate overlay layers).
3. Each team sheet is `7 rows × N frames` of 16×32 cells. Row *i* is always member *i* below. The game reads member *i*'s sprites from row *i* of every sheet; because each part in a row has its own exact colour ramp, the code can also recolour a row to another scheme.

| Row | Body | Skin | Hair | Jacket | Pants | Helmet | Backpack |
|---|---|---|---|---|---|---|---|
| 1 | woman | light `#C98E6A/#E8B48F/#FAD7BC` | brown, ponytail `#3A2414/#5C3A22/#8A5A36` | red `#8C1C1C/#D93636/#FF7A6B` | navy `#1E2A4A/#33467A/#5A6FA8` | white `#A6ADB8/#E6EAF0/#FFFFFF` | orange `#9C4A12/#E07A2A/#FFB066` |
| 2 | man | light `#C98E6A/#E8B48F/#FAD7BC` | dark brown, short hair `#24160C/#3A2414/#5C3A22` | blue `#123D8C/#2563D9/#6FA3FF` | grey `#3A3A48/#5A5A6E/#8A8AA0` | orange `#9C4A12/#E07A2A/#FFB066` | red `#8C1C1C/#D93636/#FF7A6B` |
| 3 | woman | medium `#A8714A/#C98F64/#E3B38A` | blonde, short bob `#9C7A3A/#D9B25C/#F5DC94` | yellow `#9C7A00/#E6B800/#FFE36B` | dark green `#1F3D2A/#2E5A3D/#4F8A60` | red `#8C1C1C/#D93636/#FF7A6B` | blue `#123D8C/#2563D9/#6FA3FF` |
| 4 | man | tan `#7A4B2E/#9C6640/#BF8559` | black, short hair and a short beard `#141418/#24242C/#3C3C48` | green `#1E6B2E/#33A14A/#7ED98F` | brown `#3A2A1E/#5A4230/#8A6A50` | yellow `#9C7A00/#E6B800/#FFE36B` | grey `#3A3A48/#5A5A6E/#8A8AA0` |
| 5 | woman | light `#C98E6A/#E8B48F/#FAD7BC` | red, curly hair `#7A2A12/#B5461E/#E07A3A` | orange `#9C4A12/#E07A2A/#FFB066` | charcoal `#26283A/#3C3F57/#5E6280` | blue `#123D8C/#2563D9/#6FA3FF` | green `#1E6B2E/#33A14A/#7ED98F` |
| 6 | man | medium `#A8714A/#C98F64/#E3B38A` | light brown, short tousled hair `#5C3A22/#8A5A36/#B5835A` | purple `#4A1E8C/#7A3AD9/#B88AFF` | khaki `#5A5030/#857A4A/#B5A878` | green `#1E6B2E/#33A14A/#7ED98F` | yellow `#9C7A00/#E6B800/#FFE36B` |
| 7 | woman | tan `#7A4B2E/#9C6640/#BF8559` | black, a long braid `#141418/#24242C/#3C3C48` | turquoise `#0E6B6B/#1FA8A8/#6BE0D9` | navy `#1E2A4A/#33467A/#5A6FA8` | purple `#4A1E8C/#7A3AD9/#B88AFF` | orange `#9C4A12/#E07A2A/#FFB066` |

4. Fixed colours for everyone: outline `#1A1C2C`, boots `#3A2416`/`#5A3A22`, harness `#3A3A48` + `#F2A65A`, carabiners `#6E6E7A`/`#9A9AA6`/`#C8C8D0`, sleeping mat `#5FA8F0`, rope in hands `#A01010`/`#FF2020`/`#FF7070` (recoloured in code to the actual rope).
5. Characters face right (the game mirrors for left); pivot at the feet (x=8, y=31) of each cell. Member-card portraits are cropped from the idle frame in code.

## 3. Shared conventions

1. **Chroma background:** `#00FF00` everywhere that must become transparent. Do not use that green inside any sprite.
2. **No text in images.** All text (title, labels, commands) is rendered with the pixel font in code.
3. **Consistency:** after the first asset of a group is approved, attach it as a reference for the rest of that group.

## 4. Post-processing checklist (for every generated image)

1. Downscale to the exact logical size with **nearest-neighbour** only (never bilinear/bicubic).
2. Snap colours to the palette and the team ramps (quantise); remove stray colours.
3. Replace `#00FF00` with full transparency; make sure no semi-transparent edge pixels remain.
4. Check the size, row and frame count and pivots against the prompt.
5. For team sheets: check every column is pose-identical across the 7 rows and that outfits match exactly; fix small differences by hand rather than regenerating the whole sheet.
6. Export as PNG-32 into the `file` path.

## 5. Prompts

### 5.1 Key art and menu illustrations (6)

#### `art_key_art`

1. File: `assets/art/art_key_art.png`
2. Size: 480×270 px
3. Generate at: 4× (1920×1080)
4. Note: Approve this first — it is the style anchor for everything else.

```text
Pixel art illustration: main-menu key art: a colourful rope team of seven hikers, all in the same outfit (softshell jacket, trekking pants, climbing helmet, harness, backpack) but in different colours — red, blue, yellow, green, orange, purple and turquoise jackets — climbing a steep grassy summer slope on a fixed red rope between spruce trees, the leader near a summit flag, a wide green valley and snow-capped peaks behind under a bright blue sky; side view, inspiring and joyful; leave the upper-left quarter calmer for the menu. Opaque, no chroma.. Pixel grid: exactly 480×270 logical pixels. Generate at 4× scale (1920×1080 px), every logical pixel is a perfectly square 4×4 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `art_logo_emblem`

1. File: `assets/art/art_logo_emblem.png`
2. Size: 128×64 px
3. Generate at: 8× (1024×512)
4. Note: Never let the model draw the title — Cyrillic text from image models is unreliable; the title «Закріпи! Готово! Рух!» is set in the pixel font in code.

```text
Pixel art illustration: a game logo EMBLEM WITHOUT ANY TEXT: a mountain peak with a coiled red rope #FF2020 forming a circle around it, a carabiner hanging from the rope and a small orange flag on the summit; leave the lower third empty (#00FF00) for the title text, which is rendered in code. Pixel grid: exactly 128×64 logical pixels. Generate at 8× scale (1024×512 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `art_obstacle_hill`

1. File: `assets/art/art_obstacle_hill.png`
2. Size: 96×64 px
3. Generate at: 8× (768×512)

```text
Pixel art illustration: obstacle selection card illustration: a green summer hillside with sections of different steepness, two spruce trees and a red fixed rope going up between small anchor flags; opaque, sky background. Pixel grid: exactly 96×64 logical pixels. Generate at 8× scale (768×512 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `art_obstacle_rock`

1. File: `assets/art/art_obstacle_rock.png`
2. Size: 96×64 px
3. Generate at: 8× (768×512)

```text
Pixel art illustration: obstacle selection card illustration: a tall vertical grey rock wall with a climber on a red rope and a belayer at the bottom, summer; opaque, sky background. Pixel grid: exactly 96×64 logical pixels. Generate at 8× scale (768×512 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `art_obstacle_ravine`

1. File: `assets/art/art_obstacle_ravine.png`
2. Size: 96×64 px
3. Generate at: 8× (768×512)

```text
Pixel art illustration: obstacle selection card illustration: a deep ravine between two cliffs with a tensioned rope stretched across it, summer; opaque, sky background. Pixel grid: exactly 96×64 logical pixels. Generate at 8× scale (768×512 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `art_obstacle_river`

1. File: `assets/art/art_obstacle_river.png`
2. Size: 96×64 px
3. Generate at: 8× (768×512)

```text
Pixel art illustration: obstacle selection card illustration: a fast mountain river with white water, a rope stretched across it between two trees on the banks, summer; opaque, sky background. Pixel grid: exactly 96×64 logical pixels. Generate at 8× scale (768×512 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.2 Team sprite sheets (12)

#### `team_idle`

1. File: `assets/characters/team_idle.png`
2. Size: 64×224 px
3. Generate at: 8× (512×1792)
4. Note: 7 rows (members 1–7) × 4 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 4 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «idle»: standing relaxed, weight on both feet, subtle breathing (chest and head move 1 px up and down). ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 64×224 logical pixels. Generate at 8× scale (512×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 4 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_walk_up`

1. File: `assets/characters/team_walk_up.png`
2. Size: 96×224 px
3. Generate at: 8× (768×1792)
4. Note: 7 rows (members 1–7) × 6 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 6 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «walk_up»: walking UP a steep slope towards the right: body leaning forward ~20°, knees lifted high, short determined steps, arms swinging slightly. Drawn on a flat baseline (the game tilts placement). ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 96×224 logical pixels. Generate at 8× scale (768×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 6 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_walk_down`

1. File: `assets/characters/team_walk_down.png`
2. Size: 96×224 px
3. Generate at: 8× (768×1792)
4. Note: 7 rows (members 1–7) × 6 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 6 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «walk_down»: walking DOWN a slope towards the right: body leaning slightly back, knees bent, short careful steps, arms a little out for balance. Drawn on a flat baseline. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 96×224 logical pixels. Generate at 8× scale (768×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 6 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_climb`

1. File: `assets/characters/team_climb.png`
2. Size: 96×224 px
3. Generate at: 8× (768×1792)
4. Note: 7 rows (members 1–7) × 6 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 6 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «climb»: scrambling on very steep terrain towards the right: body close to the slope, both hands reaching forward-up and grabbing, legs pushing, alternating limbs. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 96×224 logical pixels. Generate at 8× scale (768×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 6 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_tie_knot`

1. File: `assets/characters/team_tie_knot.png`
2. Size: 96×224 px
3. Generate at: 8× (768×1792)
4. Note: 7 rows (members 1–7) × 6 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 6 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «tie_knot»: standing, looking down at the hands at waist height, both hands working a short piece of rope (rope red #A01010/#FF2020/#FF7070 (recoloured in code)) — looping, pulling, tightening. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 96×224 logical pixels. Generate at 8× scale (768×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 6 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_belay`

1. File: `assets/characters/team_belay.png`
2. Size: 64×224 px
3. Generate at: 8× (512×1792)
4. Note: 7 rows (members 1–7) × 4 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 4 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «belay»: braced belay stance: feet apart, slightly crouched, both hands at the waist holding a rope (rope red #A01010/#FF2020/#FF7070 (recoloured in code)) that leaves the frame to the right; hands alternately pull and feed the rope. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 64×224 logical pixels. Generate at 8× scale (512×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 4 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_shout`

1. File: `assets/characters/team_shout.png`
2. Size: 64×224 px
3. Generate at: 8× (512×1792)
4. Note: 7 rows (members 1–7) × 4 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 4 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «shout»: standing, head raised, one hand cupped next to the mouth, mouth open, shouting a command (no speech bubble, no text). ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 64×224 logical pixels. Generate at 8× scale (512×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 4 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_fall`

1. File: `assets/characters/team_fall.png`
2. Size: 64×224 px
3. Generate at: 8× (512×1792)
4. Note: 7 rows (members 1–7) × 4 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 4 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «fall»: losing footing: slipping backwards, arms flailing up, body tilting back, feet leaving the ground. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 64×224 logical pixels. Generate at 8× scale (512×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 4 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_slide`

1. File: `assets/characters/team_slide.png`
2. Size: 48×224 px
3. Generate at: 8× (384×1792)
4. Note: 7 rows (members 1–7) × 3 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 3 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «slide»: lying on the back sliding down a slope, head uphill (left), arms out to the sides, small dust pixels at the feet. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 48×224 logical pixels. Generate at 8× scale (384×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 3 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_hang`

1. File: `assets/characters/team_hang.png`
2. Size: 48×224 px
3. Generate at: 8× (384×1792)
4. Note: 7 rows (members 1–7) × 3 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 3 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «hang»: caught by the rope and hanging from the harness: body tilted, feet pressed against the slope on the right, a short piece of rope (rope red #A01010/#FF2020/#FF7070 (recoloured in code)) goes from the harness straight up to the top edge of the frame; slight swing between frames. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 48×224 logical pixels. Generate at 8× scale (384×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 3 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_injured`

1. File: `assets/characters/team_injured.png`
2. Size: 32×224 px
3. Generate at: 8× (256×1792)
4. Note: 7 rows (members 1–7) × 2 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 2 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «injured»: lying on the ground on the side, one hand holding a knee, small pain-lines near the head. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 32×224 logical pixels. Generate at 8× scale (256×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 2 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `team_celebrate`

1. File: `assets/characters/team_celebrate.png`
2. Size: 96×224 px
3. Generate at: 8× (768×1792)
4. Note: 7 rows (members 1–7) × 6 frames.

```text
Pixel art sprite sheet of a seven-person mountaineering team performing the SAME animation, side view, every character faces right. The sheet has 7 rows — one row per team member — and 6 columns — one column per animation frame. Every cell is exactly 16×32 px; the frame in column k shows the same moment of the motion for every member, so the rows are pose-for-pose identical except for colours, hair and the slight body-type difference. Feet on the bottom pixel row of each cell, horizontally centred (pivot x=8, y=31), 1 px empty margin at the top of each cell. Animation «celebrate»: jumping with joy, both arms raised high, big smile, landing and jumping again. ALL SEVEN MEMBERS WEAR EXACTLY THE SAME OUTFIT — identical cut, shapes and details, only the colours differ: long-sleeve softshell jacket with a front zipper and a small chest pocket, slim trekking pants with knee patches, brown hiking boots (#3A2416/#5A3A22), a rounded climbing helmet with two small vents and a chin strap, a climbing harness (waist belt + leg loops, fixed colours #3A3A48 and #F2A65A) with two small carabiners at the hip (#6E6E7A/#9A9AA6/#C8C8D0), and a medium trekking backpack with a rolled blue sleeping mat (#5FA8F0) on top. Same body proportions and the same simple friendly face (1-pixel eyes, small smile) for everyone; women are only slightly slimmer, men slightly broader. Hair is visible under the helmet at the sides and back. Row 1: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), brown ponytail (#3A2414/#5C3A22/#8A5A36), jacket red (#8C1C1C/#D93636/#FF7A6B), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet white (#A6ADB8/#E6EAF0/#FFFFFF), backpack orange (#9C4A12/#E07A2A/#FFB066). Row 2: man, light skin (#C98E6A/#E8B48F/#FAD7BC), dark brown short hair (#24160C/#3A2414/#5C3A22), jacket blue (#123D8C/#2563D9/#6FA3FF), pants grey (#3A3A48/#5A5A6E/#8A8AA0), helmet orange (#9C4A12/#E07A2A/#FFB066), backpack red (#8C1C1C/#D93636/#FF7A6B). Row 3: woman, medium skin (#A8714A/#C98F64/#E3B38A), blonde short bob (#9C7A3A/#D9B25C/#F5DC94), jacket yellow (#9C7A00/#E6B800/#FFE36B), pants dark green (#1F3D2A/#2E5A3D/#4F8A60), helmet red (#8C1C1C/#D93636/#FF7A6B), backpack blue (#123D8C/#2563D9/#6FA3FF). Row 4: man, tan skin (#7A4B2E/#9C6640/#BF8559), black short hair and a short beard (#141418/#24242C/#3C3C48), jacket green (#1E6B2E/#33A14A/#7ED98F), pants brown (#3A2A1E/#5A4230/#8A6A50), helmet yellow (#9C7A00/#E6B800/#FFE36B), backpack grey (#3A3A48/#5A5A6E/#8A8AA0). Row 5: woman, light skin (#C98E6A/#E8B48F/#FAD7BC), red curly hair (#7A2A12/#B5461E/#E07A3A), jacket orange (#9C4A12/#E07A2A/#FFB066), pants charcoal (#26283A/#3C3F57/#5E6280), helmet blue (#123D8C/#2563D9/#6FA3FF), backpack green (#1E6B2E/#33A14A/#7ED98F). Row 6: man, medium skin (#A8714A/#C98F64/#E3B38A), light brown short tousled hair (#5C3A22/#8A5A36/#B5835A), jacket purple (#4A1E8C/#7A3AD9/#B88AFF), pants khaki (#5A5030/#857A4A/#B5A878), helmet green (#1E6B2E/#33A14A/#7ED98F), backpack yellow (#9C7A00/#E6B800/#FFE36B). Row 7: woman, tan skin (#7A4B2E/#9C6640/#BF8559), black a long braid (#141418/#24242C/#3C3C48), jacket turquoise (#0E6B6B/#1FA8A8/#6BE0D9), pants navy (#1E2A4A/#33467A/#5A6FA8), helmet purple (#4A1E8C/#7A3AD9/#B88AFF), backpack orange (#9C4A12/#E07A2A/#FFB066). ATTACH AS REFERENCE: art_key_art.png and, once approved, team_idle.png, so all sheets share the same style and proportions. Pixel grid: exactly 96×224 logical pixels. Generate at 8× scale (768×1792 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sheet layout: 7 rows × 6 columns of 16×32 cells, no gaps, no borders. If the model cannot produce this aspect ratio, use a wider canvas, keep the sheet in the top-left corner and fill the rest with #00FF00. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.3 Terrain textures (8)

#### `terrain_grass_fill`

1. File: `assets/terrain/terrain_grass_fill.png`
2. Size: 32×32 px
3. Generate at: 32× (1024×1024)

```text
Seamless tileable pixel art ground texture seen from the side as the cross-section of a summer hillside: lush green grass on soil: short blades, a few tiny flowers (#F25C8A, #FFD23F, #FFFFFF) — greens #2E6B45/#4FA34A/#77C25A/#A8DD6B. Must tile perfectly in both directions with no visible seams; even density, no single dominant feature. No background (texture fills the whole square). Pixel grid: exactly 32×32 logical pixels. Generate at 32× scale (1024×1024 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `terrain_grass_edge`

1. File: `assets/terrain/terrain_grass_edge.png`
2. Size: 32×8 px
3. Generate at: 32× (1024×256)

```text
Seamless horizontally tileable pixel art top-edge strip that sits on the surface line of a summer hillside: lush green grass on soil: short blades, a few tiny flowers (#F25C8A, #FFD23F, #FFFFFF) — greens #2E6B45/#4FA34A/#77C25A/#A8DD6B; the bottom 2 rows blend into the matching fill texture, the top shows the surface silhouette (tufts or stones) against #00FF00. Must tile left-right with no seam. Pixel grid: exactly 32×8 logical pixels. Generate at 32× scale (1024×256 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `terrain_ground_fill`

1. File: `assets/terrain/terrain_ground_fill.png`
2. Size: 32×32 px
3. Generate at: 32× (1024×1024)

```text
Seamless tileable pixel art ground texture seen from the side as the cross-section of a summer hillside: bare brown mountain soil with small pebbles and roots — browns #6B4A2F/#8C6440/#B08455, pebbles #9A9AA6. Must tile perfectly in both directions with no visible seams; even density, no single dominant feature. No background (texture fills the whole square). Pixel grid: exactly 32×32 logical pixels. Generate at 32× scale (1024×1024 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `terrain_ground_edge`

1. File: `assets/terrain/terrain_ground_edge.png`
2. Size: 32×8 px
3. Generate at: 32× (1024×256)

```text
Seamless horizontally tileable pixel art top-edge strip that sits on the surface line of a summer hillside: bare brown mountain soil with small pebbles and roots — browns #6B4A2F/#8C6440/#B08455, pebbles #9A9AA6; the bottom 2 rows blend into the matching fill texture, the top shows the surface silhouette (tufts or stones) against #00FF00. Must tile left-right with no seam. Pixel grid: exactly 32×8 logical pixels. Generate at 32× scale (1024×256 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `terrain_rock_fill`

1. File: `assets/terrain/terrain_rock_fill.png`
2. Size: 32×32 px
3. Generate at: 32× (1024×1024)

```text
Seamless tileable pixel art ground texture seen from the side as the cross-section of a summer hillside: solid grey rock face with cracks and ledges — greys #4A4A55/#6E6E7A/#9A9AA6/#C8C8D0, occasional lichen #A8DD6B. Must tile perfectly in both directions with no visible seams; even density, no single dominant feature. No background (texture fills the whole square). Pixel grid: exactly 32×32 logical pixels. Generate at 32× scale (1024×1024 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `terrain_rock_edge`

1. File: `assets/terrain/terrain_rock_edge.png`
2. Size: 32×8 px
3. Generate at: 32× (1024×256)

```text
Seamless horizontally tileable pixel art top-edge strip that sits on the surface line of a summer hillside: solid grey rock face with cracks and ledges — greys #4A4A55/#6E6E7A/#9A9AA6/#C8C8D0, occasional lichen #A8DD6B; the bottom 2 rows blend into the matching fill texture, the top shows the surface silhouette (tufts or stones) against #00FF00. Must tile left-right with no seam. Pixel grid: exactly 32×8 logical pixels. Generate at 32× scale (1024×256 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `terrain_scree_fill`

1. File: `assets/terrain/terrain_scree_fill.png`
2. Size: 32×32 px
3. Generate at: 32× (1024×1024)

```text
Seamless tileable pixel art ground texture seen from the side as the cross-section of a summer hillside: loose scree: many small angular stones of different sizes — greys #4A4A55/#6E6E7A/#9A9AA6 with brown soil gaps #8C6440. Must tile perfectly in both directions with no visible seams; even density, no single dominant feature. No background (texture fills the whole square). Pixel grid: exactly 32×32 logical pixels. Generate at 32× scale (1024×1024 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `terrain_scree_edge`

1. File: `assets/terrain/terrain_scree_edge.png`
2. Size: 32×8 px
3. Generate at: 32× (1024×256)

```text
Seamless horizontally tileable pixel art top-edge strip that sits on the surface line of a summer hillside: loose scree: many small angular stones of different sizes — greys #4A4A55/#6E6E7A/#9A9AA6 with brown soil gaps #8C6440; the bottom 2 rows blend into the matching fill texture, the top shows the surface silhouette (tufts or stones) against #00FF00. Must tile left-right with no seam. Pixel grid: exactly 32×8 logical pixels. Generate at 32× scale (1024×256 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.4 Trees (4)

#### `tree_conifer_small`

1. File: `assets/trees/tree_conifer_small.png`
2. Size: 24×40 px
3. Generate at: 16× (384×640)
4. Note: Generate the four trees with the first approved tree attached as reference.

```text
Pixel art tree sprite, side view, summer: a small young spruce, narrow triangle of layered branches, short trunk; fresh greens #1F4D3A/#2E6B45/#3F8A4F/#77C25A, trunk #5A3A22/#7E5530. Trunk base touches the bottom row, centred. Pixel grid: exactly 24×40 logical pixels. Generate at 16× scale (384×640 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `tree_conifer_large`

1. File: `assets/trees/tree_conifer_large.png`
2. Size: 40×72 px
3. Generate at: 16× (640×1152)
4. Note: Generate the four trees with the first approved tree attached as reference.

```text
Pixel art tree sprite, side view, summer: a tall mature spruce with layered drooping branches and a thick visible trunk at the base (used as a rope anchor); fresh greens #1F4D3A/#2E6B45/#3F8A4F/#77C25A, trunk #5A3A22/#7E5530. Trunk base touches the bottom row, centred. Pixel grid: exactly 40×72 logical pixels. Generate at 16× scale (640×1152 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `tree_deciduous_small`

1. File: `assets/trees/tree_deciduous_small.png`
2. Size: 24×40 px
3. Generate at: 16× (384×640)
4. Note: Generate the four trees with the first approved tree attached as reference.

```text
Pixel art tree sprite, side view, summer: a small beech sapling with a round crown and thin trunk; fresh greens #1F4D3A/#2E6B45/#3F8A4F/#77C25A, trunk #5A3A22/#7E5530. Trunk base touches the bottom row, centred. Pixel grid: exactly 24×40 logical pixels. Generate at 16× scale (384×640 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `tree_deciduous_large`

1. File: `assets/trees/tree_deciduous_large.png`
2. Size: 48×72 px
3. Generate at: 16× (768×1152)
4. Note: Generate the four trees with the first approved tree attached as reference.

```text
Pixel art tree sprite, side view, summer: a large old beech with a broad round crown and a thick visible trunk at the base (used as a rope anchor); fresh greens #1F4D3A/#2E6B45/#3F8A4F/#77C25A, trunk #5A3A22/#7E5530. Trunk base touches the bottom row, centred. Pixel grid: exactly 48×72 logical pixels. Generate at 16× scale (768×1152 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.5 Props and effects (7)

#### `prop_rock_outcrop`

1. File: `assets/props/prop_rock_outcrop.png`
2. Size: 32×24 px
3. Generate at: 16× (512×384)

```text
Pixel art sprite: a solid grey rock outcrop sticking out of a grassy slope, rounded top, a horn shape a sling can go around; greys #4A4A55/#6E6E7A/#9A9AA6/#C8C8D0, grass tufts at the base. Pixel grid: exactly 32×24 logical pixels. Generate at 16× scale (512×384 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `prop_bolt`

1. File: `assets/props/prop_bolt.png`
2. Size: 8×8 px
3. Generate at: 64× (512×512)

```text
Pixel art sprite: a steel rock bolt with a hanger plate (ring) seen from the side, metal #6E6E7A/#9A9AA6/#C8C8D0, a few rock pixels behind it. Pixel grid: exactly 8×8 logical pixels. Generate at 64× scale (512×512 px), every logical pixel is a perfectly square 64×64 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `prop_base_marker`

1. File: `assets/props/prop_base_marker.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)

```text
Pixel art sprite: a base/anchor marker: a blue sling #5FA8F0 loop with a locking carabiner (metal, gold sleeve #FFD23F) and a tiny triangular orange flag #F2A65A on a short pin. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `prop_falling_rock`

1. File: `assets/props/prop_falling_rock.png`
2. Size: 32×8 px, 4 frames of 8×8
3. Generate at: 32× (1024×256)

```text
Pixel art sprite: a small grey falling stone tumbling, 4 frames of rotation; stone #4A4A55/#6E6E7A/#9A9AA6. Pixel grid: exactly 32×8 logical pixels. Generate at 32× scale (1024×256 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Sprite strip of 4 frames, each 8×8 px, left to right, no gaps, no borders between frames. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `prop_dust_puff`

1. File: `assets/props/prop_dust_puff.png`
2. Size: 64×16 px, 4 frames of 16×16
3. Generate at: 16× (1024×256)

```text
Pixel art sprite: a small brown dust puff appearing and fading, 4 frames; #8C6440/#B08455/#D9C2A0. Pixel grid: exactly 64×16 logical pixels. Generate at 16× scale (1024×256 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Sprite strip of 4 frames, each 16×16 px, left to right, no gaps, no borders between frames. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `prop_clouds`

1. File: `assets/props/prop_clouds.png`
2. Size: 192×24 px
3. Generate at: 8× (1536×192)

```text
Pixel art sprite: three different fluffy white pixel clouds side by side, each 64×24 px; #FFFFFF/#E3F4FF/#9FD3FA shading. Pixel grid: exactly 192×24 logical pixels. Generate at 8× scale (1536×192 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `prop_sun`

1. File: `assets/props/prop_sun.png`
2. Size: 24×24 px
3. Generate at: 32× (768×768)

```text
Pixel art sprite: a warm round pixel sun with short rays, #FFD23F/#FFF04F/#FFFFFF core. Pixel grid: exactly 24×24 logical pixels. Generate at 32× scale (768×768 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.6 Foreground decorations (1)

#### `decor`

1. File: `assets/decor/decor.png`
2. Size: 128×16 px, 8 frames of 16×16
3. Generate at: 8× (1024×128)

```text
Pixel art sheet of small foreground decorations for a summer mountain hillside, 8 cells: grass tuft A, grass tuft B, pink flowers, yellow flowers, white flowers, small stone, two stones, small bush; each item in its own 16×16 cell left to right, bottom-aligned, matching the summer palette. Pixel grid: exactly 128×16 logical pixels. Generate at 8× scale (1024×128 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sprite strip of 8 frames, each 16×16 px, left to right, no gaps, no borders between frames. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.7 Parallax backgrounds (4)

#### `bg_sky`

1. File: `assets/backgrounds/bg_sky.png`
2. Size: 480×270 px
3. Generate at: 4× (1920×1080)

```text
Pixel art parallax background layer «sky», summer, beautiful and inspiring Carpathian-style mountain scenery seen from the side: a clear bright summer sky gradient from deep blue at the top #3B7DD8 to pale near the horizon #E3F4FF via #5FA8F0 and #9FD3FA, rendered with ordered dithering bands, no clouds, no sun (separate sprites). Opaque, no chroma.. ATTACH AS REFERENCE: art_key_art.png. Pixel grid: exactly 480×270 logical pixels. Generate at 4× scale (1920×1080 px), every logical pixel is a perfectly square 4×4 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `bg_far`

1. File: `assets/backgrounds/bg_far.png`
2. Size: 960×270 px
3. Generate at: 2× (1920×540)

```text
Pixel art parallax background layer «far», summer, beautiful and inspiring Carpathian-style mountain scenery seen from the side: a distant range of high snow-capped mountain peaks, hazy blue-violet #6C7FB8/#8E9FCC/#B5C3E3 with white snow tops, the silhouette in the lower 60% of the image; everything above the peaks is #00FF00. Must tile seamlessly left-right (the left and right edges match exactly) for parallax scrolling. ATTACH AS REFERENCE: art_key_art.png. Pixel grid: exactly 960×270 logical pixels. Generate at 2× scale (1920×540 px), every logical pixel is a perfectly square 2×2 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `bg_mid`

1. File: `assets/backgrounds/bg_mid.png`
2. Size: 960×270 px
3. Generate at: 2× (1920×540)

```text
Pixel art parallax background layer «mid», summer, beautiful and inspiring Carpathian-style mountain scenery seen from the side: mid-distance green and blue-grey mountain ridges with alpine meadows and small rocky cliffs, #4E6E8E/#6F8FA8 with green #3F8A4F slopes, silhouette in the lower 50%; above is #00FF00. Must tile seamlessly left-right (the left and right edges match exactly) for parallax scrolling. ATTACH AS REFERENCE: art_key_art.png. Pixel grid: exactly 960×270 logical pixels. Generate at 2× scale (1920×540 px), every logical pixel is a perfectly square 2×2 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `bg_near`

1. File: `assets/backgrounds/bg_near.png`
2. Size: 960×270 px
3. Generate at: 2× (1920×540)

```text
Pixel art parallax background layer «near», summer, beautiful and inspiring Carpathian-style mountain scenery seen from the side: a near ridge of dark spruce forest and grassy hills, #1F4D3A/#2E6B45/#3F8A4F with a few lighter tree tips, silhouette in the lower 35%; above is #00FF00. Must tile seamlessly left-right (the left and right edges match exactly) for parallax scrolling. ATTACH AS REFERENCE: art_key_art.png. Pixel grid: exactly 960×270 logical pixels. Generate at 2× scale (1920×540 px), every logical pixel is a perfectly square 2×2 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.8 Equipment icons (15)

#### `icon_rope`

1. File: `assets/icons/equipment/icon_rope.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a neatly coiled climbing rope tied with a few wraps, rope red #A01010/#FF2020/#FF7070 (recoloured in code). Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_cord`

1. File: `assets/icons/equipment/icon_cord.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a small coil of thin accessory cord (репшнур), clearly thinner than a rope, yellow #FFD23F with darker #C49A1A. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_cord_loop`

1. File: `assets/icons/equipment/icon_cord_loop.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a thin accessory cord tied into a closed loop, yellow #FFD23F/#C49A1A. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_sling`

1. File: `assets/icons/equipment/icon_sling.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a sewn flat nylon sling loop (tape) folded into an oval, blue #5FA8F0 with darker #2E6BB0 stitching bar. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_carabiner_locking`

1. File: `assets/icons/equipment/icon_carabiner_locking.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a D-shaped locking carabiner with a visible screw-gate sleeve, aluminium #6E6E7A/#9A9AA6/#C8C8D0 with a small gold #FFD23F sleeve. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_carabiner_nonlocking`

1. File: `assets/icons/equipment/icon_carabiner_nonlocking.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a D-shaped non-locking carabiner with a plain straight gate, aluminium #6E6E7A/#9A9AA6/#C8C8D0 with a blue anodised #5FA8F0 spine. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_carabiner_hms`

1. File: `assets/icons/equipment/icon_carabiner_hms.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a large pear-shaped (HMS) locking carabiner with a screw-gate sleeve, aluminium #6E6E7A/#9A9AA6/#C8C8D0 with an orange #F2A65A sleeve. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_belay_device_atc`

1. File: `assets/icons/equipment/icon_belay_device_atc.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a tube-style belay device (ATC) with two slots and a small wire loop, dark grey #4A4A55 with metal highlights #C8C8D0. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_belay_device_figure8`

1. File: `assets/icons/equipment/icon_belay_device_figure8.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a figure-eight descender ring, polished metal #6E6E7A/#9A9AA6/#C8C8D0. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_harness`

1. File: `assets/icons/equipment/icon_harness.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a climbing harness laid flat: waist belt, two leg loops and belay loop, dark grey #3A3A48 with orange #F2A65A. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_helmet`

1. File: `assets/icons/equipment/icon_helmet.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a rounded climbing helmet with two vent holes and a chin strap, white #A6ADB8/#E6EAF0/#FFFFFF. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_lanyard_1`

1. File: `assets/icons/equipment/icon_lanyard_1.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a single-arm self-belay lanyard: short rope piece with a sewn end and one locking carabiner, red #E8574A rope. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_lanyard_2`

1. File: `assets/icons/equipment/icon_lanyard_2.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a two-arm (Y-shaped) self-belay lanyard with two locking carabiners, red #E8574A rope. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_gloves`

1. File: `assets/icons/equipment/icon_gloves.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a pair of leather belay gloves, tan #B08455 with darker #8C6440. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `icon_backpack`

1. File: `assets/icons/equipment/icon_backpack.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)
4. Note: Generate all 15 icons in one session with the first approved icon attached as reference.

```text
Single pixel art inventory icon, item centred, readable at tiny size, 1 px dark outline, 3/4 view or side view, slight top-left light. Object: a medium trekking backpack in orange #9C4A12/#E07A2A/#FFB066 with a rolled blue sleeping mat #5FA8F0 on top. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

### 5.9 UI (10)

#### `ui_panel_frame`

1. File: `assets/ui/ui_panel_frame.png`
2. Size: 48×48 px
3. Generate at: 16× (768×768)

```text
Pixel art game UI element: a 9-slice UI panel frame: warm wooden-and-rope themed border 16 px thick (wood #5A3A22/#7E5530, rope #F2E3B5), corners decorated with small carabiner-like metal studs, plain light parchment centre #F5EBD3 that can be stretched. Pixel grid: exactly 48×48 logical pixels. Generate at 16× scale (768×768 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_member_card`

1. File: `assets/ui/ui_member_card.png`
2. Size: 48×48 px
3. Generate at: 16× (768×768)

```text
Pixel art game UI element: a 9-slice character card frame: thin rounded border 4 px (#1A1C2C outline, #E3F4FF inner highlight) with a neutral grey top strip #5A5A6E/#8A8AA0/#C8C8D0 (tinted per member in code), light centre #F5F7FA. Pixel grid: exactly 48×48 logical pixels. Generate at 16× scale (768×768 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_buttons`

1. File: `assets/ui/ui_buttons.png`
2. Size: 192×16 px, 4 frames of 48×16
3. Generate at: 8× (1536×128)

```text
Pixel art game UI element: four states of the same 9-slice button side by side, each 48×16: normal (green #3F8A4F), hover (lighter #4FA34A), pressed (darker #2E6B45, shifted 1 px down), disabled (grey #9A9AA6); 2 px dark outline, 1 px top highlight; NO text on the buttons. Pixel grid: exactly 192×16 logical pixels. Generate at 8× scale (1536×128 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sprite strip of 4 frames, each 48×16 px, left to right, no gaps, no borders between frames. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_cursor_pointer`

1. File: `assets/ui/ui_cursor_pointer.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)

```text
Pixel art game UI element: a pixel art mouse pointer arrow, white #FFFFFF with dark outline #1A1C2C, hotspot at the top-left pixel. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_cursor_hand`

1. File: `assets/ui/ui_cursor_hand.png`
2. Size: 16×16 px
3. Generate at: 32× (512×512)

```text
Pixel art game UI element: a pixel art pointing-hand cursor, white glove with dark outline, index finger tip at the top-left area. Pixel grid: exactly 16×16 logical pixels. Generate at 32× scale (512×512 px), every logical pixel is a perfectly square 32×32 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_speech_bubble`

1. File: `assets/ui/ui_speech_bubble.png`
2. Size: 32×24 px
3. Generate at: 16× (512×384)

```text
Pixel art game UI element: a 9-slice speech bubble: rounded white #FFFFFF box with 1 px dark outline #1A1C2C (24×24 area on the left) plus a separate small tail pointing down-left in the right 8×8 area; NO text. Pixel grid: exactly 32×24 logical pixels. Generate at 16× scale (512×384 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_weight_bar`

1. File: `assets/ui/ui_weight_bar.png`
2. Size: 64×8 px
3. Generate at: 16× (1024×128)

```text
Pixel art game UI element: a horizontal weight bar: dark frame with three fill segments green #4FA34A, yellow #FFD23F, orange #F2A65A and an empty dark track #3A3A48. Pixel grid: exactly 64×8 logical pixels. Generate at 16× scale (1024×128 px), every logical pixel is a perfectly square 16×16 block aligned to the grid. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_status_icons`

1. File: `assets/ui/ui_status_icons.png`
2. Size: 128×16 px, 8 frames of 16×16
3. Generate at: 8× (1024×128)

```text
Pixel art game UI element: 8 status icons side by side, each 16×16: ok (green check), caught (rope with a small hanging figure), injured (red cross), finished (small summit flag), busy (hourglass), warning (yellow triangle with exclamation mark), self-secured (carabiner with a lock), belaying (rope through a belay device). Pixel grid: exactly 128×16 logical pixels. Generate at 8× scale (1024×128 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sprite strip of 8 frames, each 16×16 px, left to right, no gaps, no borders between frames. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_ui_icons`

1. File: `assets/ui/ui_ui_icons.png`
2. Size: 160×16 px, 10 frames of 16×16
3. Generate at: 8× (1280×128)

```text
Pixel art game UI element: 10 UI icons side by side, each 16×16: obstacle (small mountain), team (three small people), learning mode (open book), exam mode (graduation cap), step (footprint), time (stopwatch), journal (scroll), glossary (book with a speech bubble), equipment (coiled rope), give up (white flag). Pixel grid: exactly 160×16 logical pixels. Generate at 8× scale (1280×128 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sprite strip of 10 frames, each 16×16 px, left to right, no gaps, no borders between frames. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```

#### `ui_controls`

1. File: `assets/ui/ui_controls.png`
2. Size: 96×16 px, 6 frames of 16×16
3. Generate at: 8× (768×128)

```text
Pixel art game UI element: 6 form controls side by side, each 16×16: checkbox empty, checkbox checked, toggle off, toggle on, slider knob, dropdown arrow; wooden/rope theme matching the panel frame. Pixel grid: exactly 96×16 logical pixels. Generate at 8× scale (768×128 px), every logical pixel is a perfectly square 8×8 block aligned to the grid. Sprite strip of 6 frames, each 16×16 px, left to right, no gaps, no borders between frames. Style: crisp pixel art, bright and inspiring summer mood, limited palette, 1-pixel dark outline #1A1C2C where it improves readability, hard pixel edges, no anti-aliasing, no blur, no smooth gradients (use ordered dithering instead), no text, no letters, no numbers, no watermark, no signature. Background: flat solid #00FF00 (chroma key, will be removed) unless stated otherwise.
```
