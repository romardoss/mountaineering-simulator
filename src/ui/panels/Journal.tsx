// Journal (Журнал): the event log of all steps, newest step first.
import { t } from "../../i18n/i18n";
import { session } from "../../app/store";
import type { GameEvent } from "../../engine/model/types";
import { formatEvent } from "../format";
import "../game.css";

function visible(e: GameEvent, exam: boolean): boolean {
  if (e.type === "step.done") return false;
  if (!exam) return true;
  if (e.type === "fall.chance" || e.severity === "hint") return false;
  return true;
}

export function Journal() {
  const s = session.value;
  if (!s) return null;
  const exam = s.scenario.mode === "exam";
  const byStep = new Map<number, GameEvent[]>();
  for (const e of s.state.log) {
    if (!visible(e, exam)) continue;
    const list = byStep.get(e.step) ?? [];
    list.push(e);
    byStep.set(e.step, list);
  }
  const steps = [...byStep.keys()].sort((a, b) => b - a);
  return (
    <aside class="journal" aria-label={t("ui.game.journal")} aria-live="polite">
      <h2>{t("ui.game.journal")}</h2>
      {steps.length === 0 && <p class="muted">{t("ui.game.journal_empty")}</p>}
      {steps.map((step) => (
        <div>
          <div class="step-head">{t("ui.game.step_n", { n: step })}</div>
          {byStep.get(step)!.map((e) => (
            <div class={`entry ${e.severity}`}>{formatEvent(s.state, e)}</div>
          ))}
        </div>
      ))}
    </aside>
  );
}
