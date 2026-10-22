// Сезон і режим (§6.1.4).
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { kits } from "../../data/load";
import { data, draft, newSeed, updateDraft } from "../../app/store";
import { buildKit } from "../../engine/scenario/kit";
import type { Mode, Season } from "../../engine/model/types";
import { TopBar } from "../components/common";
import { FlowNav, SEASONS } from "./cfgShared";

export function SeasonMode() {
  const d = draft.value;
  const [refreshKit, setRefreshKit] = useState(true);

  const setSeason = (season: Season) => {
    if (season === d.season) return;
    updateDraft((x) => {
      x.season = season;
      if (refreshKit) x.items = buildKit(data, kits[0], x.team, season);
      return x;
    });
  };

  return (
    <div class="screen">
      <TopBar back="hill" />
      <div class="screen-body">
        <h1>{t("ui.cfg.season.title")}</h1>
        <div class="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <fieldset class="panel col">
            <legend>{t("ui.cfg.season.season")}</legend>
            {SEASONS.map((s) => {
              const w = data.seasons.seasons[s];
              return (
                <label>
                  <input type="radio" name="season" checked={d.season === s} onChange={() => setSeason(s)} />
                  <span>
                    <strong>{t(`season.${s}`)}</strong> — {t(`ui.cfg.season.${s}.desc`)}{" "}
                    {s !== "winter" && <small class="muted">({t("ui.cfg.season.weather_odds", { rain: Math.round(w.pRain * 100), mud: Math.round(w.pMud * 100) })})</small>}
                  </span>
                </label>
              );
            })}
            <label>
              <input type="checkbox" checked={refreshKit} onChange={(e) => setRefreshKit((e.target as HTMLInputElement).checked)} />
              {t("ui.cfg.season.refresh_kit")}
            </label>
          </fieldset>
          <fieldset class="panel col">
            <legend>{t("ui.cfg.season.mode")}</legend>
            {(["learning", "exam"] as const).map((m: Mode) => (
              <label>
                <input type="radio" name="mode" checked={d.mode === m} onChange={() => updateDraft({ mode: m })} />
                <strong>{t(`mode.${m}`)}</strong> — {t(`ui.cfg.season.${m}.desc`)}
              </label>
            ))}
          </fieldset>
        </div>
        <details class="panel">
          <summary>{t("ui.cfg.season.advanced")}</summary>
          <div class="row" style={{ marginTop: 8 }}>
            <label>
              {t("ui.cfg.season.seed")}
              <input type="number" style={{ width: 140 }} value={d.seed} onChange={(e) => updateDraft({ seed: Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0)) })} />
            </label>
            <button class="btn small secondary" onClick={() => updateDraft({ seed: newSeed() })}>
              {t("ui.cfg.season.new_seed")}
            </button>
            <label>
              {t("ui.cfg.season.max_steps")}
              <input type="number" min={0} value={d.maxSteps ?? 0} onChange={(e) => {
                const v = Math.floor(Number((e.target as HTMLInputElement).value) || 0);
                updateDraft({ maxSteps: v > 0 ? v : null });
              }} />
            </label>
            <small class="muted">{t("ui.cfg.season.max_steps_hint")}</small>
          </div>
        </details>
        <FlowNav current="season" />
      </div>
    </div>
  );
}
