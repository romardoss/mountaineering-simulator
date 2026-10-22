// Перевірка готовності (§6.1.7): summary, warnings (never block), errors (block), weights.
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { data, draft, updateDraft, withWeights } from "../../app/store";
import { saveScenario, startGame } from "../../app/controller";
import { downloadJson } from "../../app/persistence/storage";
import { memberLoadKg, validateScenario } from "../../engine/scenario/validate";
import { normaliseSections } from "../../engine/geometry/hill";
import { Msg, Term, TopBar, WeightBar } from "../components/common";
import { FlowNav } from "./cfgShared";
import { hillTitle } from "../format";

export function Readiness() {
  const d = withWeights(draft.value);
  const [saved, setSaved] = useState(false);
  const issues = validateScenario(data, d);
  const errors = issues.filter((i) => i.level === "error");
  const shown = d.mode === "exam" ? errors : issues;
  const hill = d.route.obstacles[0];
  const sections = normaliseSections(hill);
  const total = sections.reduce((s, x) => s + x.lengthM, 0);
  const taken = d.items.filter((i) => i.assignedTo).length;
  const loads = d.team.map((m) => ({ m, kg: memberLoadKg(data, d, m.id) }));
  const heaviest = [...loads].sort((a, b) => b.kg - a.kg)[0];
  const lightest = [...loads].sort((a, b) => a.kg - b.kg)[0];
  const suggest = d.mode === "learning" && heaviest && lightest && heaviest.kg > data.rules.weight.comfortKg && heaviest.kg - lightest.kg > 2;
  const name = d.name || t("ui.cfg.ready.default_name");

  const save = () => {
    saveScenario({ ...d, name });
    setSaved(true);
  };

  return (
    <div class="screen">
      <TopBar back="equipment" />
      <div class="screen-body">
        <h1>{t("ui.cfg.ready.title")}</h1>
        <div class="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div class="panel col">
            <h2>{t("ui.cfg.ready.summary")}</h2>
            <label>
              {t("ui.cfg.ready.name")}
              <input type="text" value={d.name} placeholder={t("ui.cfg.ready.default_name")} onInput={(e) => updateDraft({ name: (e.target as HTMLInputElement).value })} />
            </label>
            <p>
              <Term k="term.hill" cap />: {hillTitle(hill)} · {t(`route.${hill.routeType}`)} · {t("ui.cfg.hill.total", { m: Math.round(total) })}
            </p>
            <p>
              {t("ui.cfg.season.season")}: {t(`season.${d.season}`)} · {t("ui.cfg.season.mode")}: {t(`mode.${d.mode}`)}
            </p>
            <p>{t("ui.cfg.ready.team", { count: d.team.length })}</p>
            <p>{t("ui.cfg.ready.items", { count: taken })}</p>
            <small class="muted">{t("ui.cfg.ready.seed", { seed: d.seed })}</small>
          </div>
          <div class="panel col">
            <h2>{t("ui.cfg.ready.weights")}</h2>
            {loads.map(({ m, kg }) => (
              <div class="row">
                <span style={{ minWidth: 110 }}>{m.name}</span>
                <WeightBar baseKg={d.weights.backpackBaseKg} gearKg={kg - d.weights.backpackBaseKg} />
              </div>
            ))}
            {suggest && <Msg level="hint">{t("ui.cfg.ready.rebalance", { from: heaviest.m.name, to: lightest.m.name })}</Msg>}
          </div>
        </div>
        <div class="col">
          {shown.length === 0 && <Msg level="ok">{t("ui.cfg.ready.all_good")}</Msg>}
          {shown.map((i) => (
            <Msg level={i.level}>{t(i.key, i.params)}</Msg>
          ))}
          {d.mode === "learning" && issues.some((i) => i.level === "warning") && <small class="muted">{t("ui.cfg.ready.warnings_do_not_block")}</small>}
        </div>
        <div class="row">
          <button class="btn secondary" onClick={save}>
            {t("ui.cfg.ready.save")}
          </button>
          <button class="btn secondary" onClick={() => downloadJson(`${name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}.scenario.json`, { ...d, name })}>
            {t("ui.cfg.ready.export")}
          </button>
          {saved && <span>{t("ui.cfg.ready.saved")}</span>}
        </div>
        <FlowNav current="readiness" nextDisabled={errors.length > 0} onNext={() => startGame(structuredClone({ ...d, name }))} nextLabel={t("ui.cfg.ready.start")} />
      </div>
    </div>
  );
}
