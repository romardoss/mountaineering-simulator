// Довідник вузлів (§13.4.5). No knot art yet — names are shown as text.
import { t, tl } from "../../i18n/i18n";
import { data, go, route } from "../../app/store";
import type { ContextRatingEntry } from "../../engine/data/types";
import type { KnotContext, KnotRating } from "../../engine/model/types";
import { TopBar } from "../components/common";
import { knotName } from "../format";
import "../game.css";

function ratingsFor(knotId: string): { context: KnotContext; rating: KnotRating; viaCarabiner: boolean }[] {
  const out: { context: KnotContext; rating: KnotRating; viaCarabiner: boolean }[] = [];
  for (const [ctx, def] of Object.entries(data.contexts) as [KnotContext, (typeof data.contexts)[KnotContext]][]) {
    const e = def.ratings[knotId];
    if (!e) continue;
    if (typeof e === "string") out.push({ context: ctx, rating: e, viaCarabiner: false });
    else out.push({ context: ctx, rating: (e as ContextRatingEntry).rating, viaCarabiner: !!(e as ContextRatingEntry).requires });
  }
  return out;
}

export function KnotReference() {
  const back = route.value.back ?? "menu";
  return (
    <div class="screen">
      <TopBar back={back} />
      <div class="screen-body">
        <h1>{t("ui.ref.knots_title")}</h1>
        <p class="muted">{t("ui.ref.knots_intro")}</p>
        {data.knots.map((k) => (
          <section class="panel ref-card" id={`knot-${k.id}`}>
            <h2>
              {knotName(k.id)} <span class="muted">({k.enRef})</span>
            </h2>
            {tl("uk", k.nameKey) !== knotName(k.id) && <p class="term-uk">{tl("uk", k.nameKey)}</p>}
            <p>{t(`knot.${k.id}.description`)}</p>
            <div class="row">
              <span class="badge">{t(`category.${k.category}`)}</span>
              <span>{t("ui.ref.control", { n: k.controlKnotsRequired })}</span>
              {k.minTurns !== undefined && <span>{t("ui.ref.min_turns", { n: k.minTurns })}</span>}
              {k.requires.map((r) => (
                <span>{t(`ui.ref.requires.${r}`)}</span>
              ))}
              {k.constantLoadOnly && <span>{t("ui.ref.constant_load")}</span>}
              {k.releasable && <span>{t("ui.ref.releasable")}</span>}
            </div>
            <div class="row" style={{ marginTop: 6 }}>
              {ratingsFor(k.id).map((r) => (
                <span>
                  <span class={`badge ${r.rating}`}>{t(`rating.${r.rating}`)}</span> {t(`context.${r.context.toLowerCase()}`)}
                  {r.viaCarabiner ? ` (${t("ui.ref.via_carabiner")})` : ""}
                </span>
              ))}
              {ratingsFor(k.id).length === 0 && <span class="muted">{t("ui.ref.no_contexts")}</span>}
            </div>
          </section>
        ))}
        <div>
          <button class="btn secondary" onClick={() => go(back)}>
            ← {t("ui.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
