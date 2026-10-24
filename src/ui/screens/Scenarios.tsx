// Сценарії: saved scenarios, JSON import / export (§6.2).
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { data, draft, go, route } from "../../app/store";
import { deleteScenario, saveScenario, savedScenarios } from "../../app/controller";
import { downloadJson, pickJsonFile } from "../../app/persistence/storage";
import { validateScenarioJson } from "../../app/persistence/importScenario";
import { normaliseGear } from "../../app/gear";
import { validateScenario } from "../../engine/scenario/validate";
import type { Scenario } from "../../engine/model/types";
import { Msg, TopBar } from "../components/common";
import { hillTitle } from "../format";
import "../config.css";

function fileName(sc: Scenario) {
  return `${(sc.name || sc.id).replace(/[^\p{L}\p{N}_-]+/gu, "_")}.scenario.json`;
}

export function ScenariosScreen() {
  const [list, setList] = useState<Scenario[]>(() => savedScenarios());
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const back = route.value.back ?? "menu";

  const load = (sc: Scenario) => {
    draft.value = normaliseGear(structuredClone(sc));
    go("readiness");
  };

  const importFile = async () => {
    setInfo(null);
    try {
      const json = await pickJsonFile();
      const res = validateScenarioJson(json);
      if (!res.ok || !res.scenario) return setErrors(res.errors);
      const rules = validateScenario(data, res.scenario).filter((i) => i.level === "error");
      if (rules.length) return setErrors(rules.map((i) => t(i.key, i.params)));
      setErrors([]);
      saveScenario(res.scenario);
      setList(savedScenarios());
      setInfo(t("ui.cfg.sc.imported", { name: res.scenario.name || res.scenario.id }));
    } catch (e) {
      setErrors([t("ui.cfg.sc.bad_file")]);
    }
  };

  return (
    <div class="screen">
      <TopBar back={back} />
      <div class="screen-body">
        <h1>{t("ui.cfg.sc.title")}</h1>
        <div class="row">
          <button class="btn" onClick={importFile}>
            {t("ui.cfg.sc.import")}
          </button>
        </div>
        {info && <Msg level="ok">{info}</Msg>}
        {errors.length > 0 && (
          <Msg level="error">
            <strong>{t("ui.cfg.sc.invalid")}</strong>
            <ul>
              {errors.slice(0, 20).map((e) => (
                <li>{e}</li>
              ))}
            </ul>
          </Msg>
        )}
        <div class="panel">
          {list.length === 0 ? (
            <p class="muted">{t("ui.cfg.sc.empty")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("ui.cfg.sc.name")}</th>
                  <th>{t("ui.cfg.sc.hill")}</th>
                  <th>{t("ui.cfg.season.season")}</th>
                  <th>{t("ui.cfg.season.mode")}</th>
                  <th>{t("ui.cfg.sc.team")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((sc) => {
                  const h = sc.route.obstacles[0];
                  return (
                    <tr>
                      <td>{sc.name || sc.id}</td>
                      <td>{hillTitle(h)}</td>
                      <td>{t(`season.${sc.season}`)}</td>
                      <td>{t(`mode.${sc.mode}`)}</td>
                      <td>{sc.team.length}</td>
                      <td>
                        <span class="row" style={{ gap: 4 }}>
                          <button class="btn small" onClick={() => load(sc)}>
                            {t("ui.cfg.sc.load")}
                          </button>
                          <button class="btn small secondary" onClick={() => downloadJson(fileName(sc), sc)}>
                            {t("ui.cfg.sc.export")}
                          </button>
                          <button class="btn small danger" onClick={() => {
                            deleteScenario(sc.id);
                            setList(savedScenarios());
                          }}>
                            {t("ui.cfg.sc.delete")}
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
