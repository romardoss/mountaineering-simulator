# Changelog (milestone demo notes, PRD §23)

## 2026-10-20 — M0–M5 first implementation

1. **M0 Skeleton**: Vite + TypeScript + Preact + Phaser 3 + Vitest + ESLint; screen flow §6.1; i18n (uk/en) with ICU messages.
2. **M1 Engine core** and **M2 knots, belay, hazards**: headless engine `src/engine` (seeded RNG, hill geometry, equipment accountability with invariant checks, all actions of §11, phase pipeline §10.2, knot evaluation §13.5, fall resolution §14.2, rockfall §14.4, protocol P1–P7, stats). Scenario tests for every case of §24.2 pass, including the full canonical tactic on «Схил з деревами» and deterministic replay.
3. **M3 Configuration screens**, **M4 game screen**, **M5 results & learning** — see `docs/DECISIONS.md` for interpretations.
4. **Assets**: `tools/process-assets.mjs` turns the first 19 generated images into game PNGs (`docs/ASSET_SPEC.md`); everything else uses placeholders. Knots are shown by name (no knot art).

## 2026-10-21 — owner change requests CR-1…CR-6

1. **Obstacle library**: Play → obstacle type → list of predefined hills (built-in presets + own hills). The hill editor moved to a separate main-menu entry «Конструктор перешкод» with its own storage (`zgr.v1.obstacles`).
2. **No ready-made bases**: base points are only places for a base; members build every base. Only a base spot in the finish zone is required.
3. **No roles**: leader / member / last removed from the model, validation, UI and locales; the typical kit uses team order.
4. **Looks**: no appearance picker; each member gets a random unused sprite; «Випадково» kept.
5. **Team cards**: member number badge in the top-right corner.
6. **Equipment**: identical items are grouped into one row with an editable count.
7. **Weights in Settings** (CR-7): no base weight per member and no item weight in the configuration screens; Settings holds the base backpack (default 15 kg in every season) and the standard equipment weights.
8. **No take-off** (CR-8): the «Зняти» action (helmet, harness, crampons, gloves) is removed.
9. **Member quantity controls** (CR-9): − / + per grouped item in a member's carried list on the equipment screen.
10. **Implicit harness and helmet** (CR-10): always worn by every member; removed from the equipment screen, kit and warnings.
11. **Spring and autumn, rain and mud** (CR-11): four seasons with per-season rain / mud probability; weather changes surfaces and the look of the game.
12. **Belay gloves always worn** (CR-12): «страхувальні рукавиці» removed from the equipment screen.

## 2026-10-22

1. **Individual equipment** (CR-13, CR-14): every member gets the same personal set automatically (шолом, страхувальна система, страхувальні рукавиці, спусковий пристрій, жумар, 2 прусики; winter: кішки, льодоруб); removed from «Що беремо»; no worn list on the equipment screen.
2. **Equipment names** (CR-15, CR-16): no «HMS» in carabiner names; main rope fixed at 10 мм.
3. **Lanyard is individual** (CR-17).
4. **Right-click move** (CR-18): right-click a point on the hill to send the selected member there; no metre selection.
5. **Movement and self-belay** (CR-19, CR-22, CR-23, CR-25): uphill ×1.5; untie after «Сам!» on the next step; any friction hitch is a safe self-belay on a fixed rope; moving only by right-click.
6. **UI** (CR-20, CR-21, CR-24): station icon on base spots; no control-knot selector; no «Покласти на землю».
7. **Belay and protection** (CR-26 … CR-29): belay protects only after «Страховка готова!»; map labels «Організувати базу» / «Організувати проміжний пункт страховки»; injury grows with fall length; Зустрічна вісімка around trees, worse direct knots on rock.
8. **Idle stroll and tree spots** (CR-30, CR-31): free members in safe zones stroll a little now and then; every large tree is a base spot.
9. **New preset** «Осінній Лист 2026 2.2»: 39 m competition stage, slope up to 50°, 5 ППС on small trees, large tree at the finish.
10. **Game screen batch** (CR-32 … CR-41): parallax fix, belay options by clip state, «Страховка готова!» after setup, hover command button, «Зрозумів.», free commands, click tree/rock for a base, sling base by default with warning, gear icons ×N on cards, no «у нормі».
11. **Equipment and knot dialog** (CR-42 … CR-45): stock-only pool, allocation from member panels, no carabiner shapes, labelled rope type, fixed knot-dialog footer.
12. **Setup navigation and belay anchors** (CR-46, CR-47): «Назад» / «Далі» together on the right; belay «від бази» / «від себе» without self-belay.
