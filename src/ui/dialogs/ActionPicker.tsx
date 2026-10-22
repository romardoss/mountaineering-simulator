// Action picker (§18.4.2): every option from getActionOptions, impossible ones disabled with a reason.
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { baseConfirm, data, engine, session } from "../../app/store";
import { baseMissing, setPlannedAction } from "../../app/controller";
import type { ActionOption, OptionGroup } from "../../engine/actions/options";
import { belayEvalInput, fixEvalInput, grabEvalInput } from "../../engine/actions/defs";
import type { ActionParams, ItemProps, KnotChoice } from "../../engine/model/types";
import { Modal, Msg } from "../components/common";
import { formatKey } from "../format";
import { CommandDialog } from "./CommandDialog";
import { KnotDialog } from "./KnotDialog";
import { optionLabel } from "./labels";
import "../game.css";

// no "move": members move by a right-click on the hill (CR-25)
const GROUPS: OptionGroup[] = ["attach", "tie", "base", "belay", "command", "detach", "items", "skip"];

type Stage =
  | { kind: "list" }
  | { kind: "knot"; option: ActionOption }
  | { kind: "command" }
  | { kind: "items"; option: ActionOption }
  | { kind: "confirm"; params: ActionParams };

export function ActionPicker({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const s = session.value!;
  const state = s.state;
  const learning = s.scenario.mode === "learning";
  const member = state.members[memberId];
  const options = engine.getActionOptions(state, memberId);
  const [stage, setStage] = useState<Stage>({ kind: "list" });

  const commit = (params: ActionParams) => {
    setPlannedAction(memberId, params);
    onClose();
  };

  const finish = (params: ActionParams) => {
    const v = engine.validatePlan(state, [{ memberId, params }]).members[memberId];
    if (learning && v && v.ok && v.hints.length) setStage({ kind: "confirm", params });
    else commit(params);
  };

  const choose = (o: ActionOption) => {
    // a base without a sling needs a confirmation (CR-39)
    if (o.params.kind === "make_base" && o.params.construction === "direct") {
      baseConfirm.value = { memberId, params: o.params, missing: baseMissing(state, memberId) };
      return onClose();
    }
    if (o.needs?.knot) return setStage({ kind: "knot", option: o });
    if (o.needs?.command) return setStage({ kind: "command" });
    if (o.needs?.items) return setStage({ kind: "items", option: o });
    finish(o.params);
  };

  if (stage.kind === "command") return <CommandDialog memberId={memberId} onConfirm={finish} onCancel={() => setStage({ kind: "list" })} />;

  if (stage.kind === "knot") {
    const o = stage.option;
    const p = o.params;
    const ctx = { data, state };
    const withKnot = (k: KnotChoice, via: boolean): ActionParams => {
      if (p.kind === "tie_in") return { ...p, knot: k, viaCarabiner: via };
      return { ...p, knot: k } as ActionParams;
    };
    const evalInput = (k: KnotChoice, via: boolean) => {
      const full = withKnot(k, via);
      if (full.kind === "attach") return grabEvalInput(ctx, memberId, full);
      if (full.kind === "belay") return belayEvalInput(ctx, memberId, full);
      if (full.kind === "fix_rope") return fixEvalInput(ctx, state.bases[full.baseId], full.ropeId, memberId, k);
      return { lockingCarabiners: via ? 1 : 0, carabiners: via ? 1 : 0, ropeDiameterMm: full.kind === "tie_in" ? state.items[full.ropeId]?.props.diameterMm : undefined, support: null };
    };
    return (
      <KnotDialog
        context={o.needs!.knot!.context}
        evalInput={evalInput}
        allowViaCarabiner={p.kind === "tie_in"}
        onConfirm={(k, via) => finish(withKnot(k, via))}
        onCancel={() => setStage({ kind: "list" })}
      />
    );
  }

  return (
    <Modal title={t("ui.game.picker_title", { name: member.name })} onClose={onClose} wide>
      {stage.kind === "list" && (
        <div>
          {GROUPS.map((g) => {
            const list = options.filter((o) => o.group === g);
            if (!list.length) return null;
            return (
              <div class="options-group">
                <h3>{t(`group.${g}`)}</h3>
                {list.map((o) => (
                  <button class="option-btn" disabled={!o.enabled} title={o.enabled ? "" : formatKey(state, o.reasonKey ?? "", o.reasonParams)} onClick={() => choose(o)}>
                    {optionLabel(state, o)}
                    {!o.enabled && o.reasonKey && <span class="reason">{formatKey(state, o.reasonKey, o.reasonParams)}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {stage.kind === "items" && <ItemsStage option={stage.option} onBack={() => setStage({ kind: "list" })} onDone={finish} />}
      {stage.kind === "confirm" && (
        <div class="col">
          <Msg level="warning">{t("ui.game.unsafe_intro")}</Msg>
          {engine
            .validatePlan(state, [{ memberId, params: stage.params }])
            .members[memberId].hints.map((h) => (
              <Msg level="hint">{formatKey(state, h.key, h.params)}</Msg>
            ))}
          <div class="row" style={{ justifyContent: "flex-end" }}>
            <button class="btn secondary" onClick={() => setStage({ kind: "list" })}>
              {t("ui.game.choose_other")}
            </button>
            <button class="btn" onClick={() => commit(stage.params)}>
              {t("ui.game.confirm_anyway")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ItemsStage({ option, onBack, onDone }: { option: ActionOption; onBack: () => void; onDone: (p: ActionParams) => void }) {
  const s = session.value!;
  const n = option.needs!.items!;
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < n.max ? [...sel, id] : sel);
  const p = option.params;
  const params: ActionParams = p.kind === "pass" || p.kind === "pickup" ? { ...p, itemIds: sel } : p;
  return (
    <div class="col">
      <p>{t("ui.game.items_intro", { max: n.max })}</p>
      {n.choices.map((id) => {
        const it = s.state.items[id];
        return (
          <label>
            <input type="checkbox" checked={sel.includes(id)} onChange={() => toggle(id)} />
            {t(`item.${it.type}`)} {itemDetail(it.props)} · {t("ui.kg", { kg: it.weightKg })}
          </label>
        );
      })}
      <div class="row" style={{ justifyContent: "flex-end" }}>
        <button class="btn secondary" onClick={onBack}>
          {t("ui.back")}
        </button>
        <button class="btn" disabled={!sel.length} onClick={() => onDone(params)}>
          {t("ui.confirm")}
        </button>
      </div>
    </div>
  );
}

export function itemDetail(p: ItemProps): string {
  const parts: string[] = [];
  if (p.lengthM) parts.push(t("ui.m", { m: p.lengthM }));
  if (p.diameterMm) parts.push(t("ui.game.mm", { mm: p.diameterMm }));
  if (p.lengthCm) parts.push(t("ui.game.cm", { cm: p.lengthCm }));
  if (p.locking) parts.push(t("ui.game.locking"));
  if (p.shape === "hms") parts.push("HMS");
  if (p.loopKnot) parts.push(t("ui.game.loop"));
  return parts.length ? `(${parts.join(", ")})` : "";
}
