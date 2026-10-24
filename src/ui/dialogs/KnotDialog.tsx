// Knot selection (§13.4): all knots, grouped by category; tiles show the knot art (if any) with the name under it.
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { data, engine, session } from "../../app/store";
import { controlFor, type KnotEvalInput } from "../../engine/knots/evaluate";
import type { KnotChoice, KnotContext } from "../../engine/model/types";
import type { KnotCategory } from "../../engine/data/types";
import { assetUrl } from "../../game/assets";
import { Modal, Msg } from "../components/common";
import { formatKey, knotName } from "../format";
import "../game.css";

const CATEGORIES: KnotCategory[] = ["join_same", "join_diff", "loop", "attach_support", "grabbing", "braking"];

export interface KnotDialogProps {
  context: KnotContext;
  /** Builds the evaluation input (items, diameters…) for a candidate choice. */
  evalInput: (choice: KnotChoice, viaCarabiner: boolean) => Omit<KnotEvalInput, "knotId" | "context" | "control" | "turns">;
  allowViaCarabiner?: boolean;
  initial?: KnotChoice;
  onConfirm: (choice: KnotChoice, viaCarabiner: boolean) => void;
  onCancel: () => void;
}

export function KnotDialog(props: KnotDialogProps) {
  const s = session.value;
  const learning = s?.scenario.mode === "learning";
  const [knotId, setKnotId] = useState<string | null>(props.initial?.knotId ?? null);
  const [turns, setTurns] = useState<number | null>(props.initial?.turns ?? null);
  const [via, setVia] = useState(false);
  const def = knotId ? data.knots.find((k) => k.id === knotId) : undefined;

  const pick = (id: string) => {
    setKnotId(id);
    const d = data.knots.find((k) => k.id === id);
    setTurns(d?.minTurns ?? null);
  };

  // control knots are always tied correctly (CR-21)
  const control = controlFor(def);
  const choice: KnotChoice | null = knotId ? { knotId, control, turns: def?.minTurns !== undefined ? turns : null } : null;
  const evaluation = choice && learning ? engine.evaluateKnot({ knotId: choice.knotId, context: props.context, control: choice.control, turns: choice.turns, ...props.evalInput(choice, via) }) : null;

  return (
    <Modal title={t("ui.game.knot_title", { context: t(`context.${props.context.toLowerCase()}`) })} onClose={props.onCancel} wide>
      <p class="muted">{t("ui.game.knot_intro")}</p>
      <div class="knot-groups">
        {CATEGORIES.map((cat) => (
          <div>
            <h3>{t(`category.${cat}`)}</h3>
            <div class="knot-tiles">
              {data.knots
                .filter((k) => k.category === cat)
                .map((k) => {
                  const img = assetUrl(k.icon);
                  return (
                    <button class={img ? "knot-tile" : "knot-tile no-art"} aria-pressed={knotId === k.id} onClick={() => pick(k.id)}>
                      {img && <img src={img} alt="" aria-hidden="true" />}
                      <span>{knotName(k.id)}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      {def && (
        <div class="panel" style={{ marginTop: 10 }}>
          <h3>{knotName(def.id)}</h3>
          <p>{t(`knot.${def.id}.description`)}</p>
          <div class="row">
            {def.minTurns !== undefined && (
              <label>
                {t("ui.game.turns")}
                <input type="number" min={1} max={8} value={turns ?? def.minTurns} onInput={(e) => setTurns(Number((e.target as HTMLInputElement).value))} />
              </label>
            )}
            {props.allowViaCarabiner && (
              <label>
                <input type="checkbox" checked={via} onChange={(e) => setVia((e.target as HTMLInputElement).checked)} />
                {t("ui.game.via_carabiner")}
              </label>
            )}
          </div>
          {evaluation && (
            <div class="col" style={{ marginTop: 8 }}>
              <div>
                {t("ui.game.rating")}: <span class={`badge ${evaluation.rating}`}>{t(`rating.${evaluation.rating}`)}</span>{" "}
                <span class="muted">{t("ui.game.fail_shock", { p: Math.round(evaluation.failProbShock * 100) })}</span>
              </div>
              {evaluation.messages.slice(1).map((m) => (
                <Msg level={evaluation.rating === "correct" ? "hint" : "warning"}>{formatKey(s?.state ?? null, m.key, m.params)}</Msg>
              ))}
              {evaluation.rating !== "correct" && <Msg level="hint">{t("ui.game.knot_still_allowed")}</Msg>}
            </div>
          )}
        </div>
      )}
      {/* fixed footer: always visible while the knot list scrolls (CR-45) */}
      <div class="modal-footer">
        {evaluation && (
          <span>
            {knotName(choice!.knotId)}: <span class={`badge ${evaluation.rating}`}>{t(`rating.${evaluation.rating}`)}</span>
          </span>
        )}
        <span class="spacer" />
        <button class="btn secondary" onClick={props.onCancel}>
          {t("ui.cancel")}
        </button>
        <button class="btn" disabled={!choice} onClick={() => choice && props.onConfirm(choice, via)}>
          {t("ui.game.tie")}
        </button>
      </div>
    </Modal>
  );
}
