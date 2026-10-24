// Bottom panel: one card per member (§18.4.2).
import { t } from "../../i18n/i18n";
import { data, engine, selectedMember, session } from "../../app/store";
import { planList } from "../../app/controller";
import { angleAt, zoneAt } from "../../engine/geometry/hill";
import { onTraverse } from "../../engine/model/selectors";
import { attachmentsOf, belaysAsBelayer, belaysAsClimber, geoOf, harnessNodes, itemsWith, memberWeightKg } from "../../engine/model/selectors";
import type { GameState, ItemState, MemberState } from "../../engine/model/types";
import { isIndividual } from "../../engine/scenario/kit";
import { ItemIcon } from "../components/ItemIcon";
import { itemDetail } from "../dialogs/ActionPicker";
import { Sprite, WeightBar } from "../components/common";
import { formatKey, memberName } from "../format";
import { actionLabel, baseLabel, ropeLabel } from "../dialogs/labels";
import "../game.css";

function sheetFor(m: MemberState): string {
  if (m.status === "injured") return "team_injured";
  if (m.status === "fallen_caught") return "team_hang";
  if (m.status === "finished") return "team_celebrate";
  return "team_shout";
}

function attachmentText(state: GameState, m: MemberState): string[] {
  const out: string[] = [];
  for (const a of attachmentsOf(state, m.id)) {
    const target = a.target.kind === "base" ? baseLabel(state, state.bases[a.target.baseId]?.basePointId ?? "") : ropeLabel(state, a.target.ropeId);
    out.push(`${t(`method.${a.method}`)} → ${target}`);
  }
  for (const h of harnessNodes(state, m.id)) out.push(t("ui.game.tied_in", { rope: ropeLabel(state, h.rope.ropeId) }));
  for (const b of belaysAsClimber(state, m.id)) out.push(t("ui.game.on_belay_by", { name: memberName(state, b.belayerId) }));
  for (const b of belaysAsBelayer(state, m.id)) out.push(t("ui.game.belaying", { name: memberName(state, b.climberId) }));
  return out;
}

export function MemberCards({ onOpen }: { onOpen: (memberId: string) => void }) {
  const s = session.value;
  if (!s) return null;
  const state = s.state;
  const learning = s.scenario.mode === "learning";
  const v = engine.validatePlan(state, planList(s));
  const geo = geoOf(state);
  return (
    <>
      {s.scenario.team.map((mc, i) => {
        const m = state.members[mc.id];
        const w = memberWeightKg(state, m.id);
        const planned = s.plan[m.id];
        const pv = v.members[m.id];
        const own = itemsWith(state, m.id, ["worn", "carried"]);
        const team = own.filter((it) => !isIndividual(data, it.type));
        const individual = own.filter((it) => isIndividual(data, it.type));
        const disabled = m.status === "injured" || m.status === "finished";
        return (
          <div
            class={`member-card ${selectedMember.value === m.id ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`${i + 1}. ${m.name}`}
            onClick={() => {
              selectedMember.value = m.id;
              if (!disabled && state.outcome === "in_progress") onOpen(m.id);
            }}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
                selectedMember.value = m.id;
                if (!disabled) onOpen(m.id);
              }
            }}
          >
            <div class="head">
              <Sprite row={m.appearance.row} sheet={sheetFor(m)} scale={2} />
              <div class="col" style={{ gap: 2 }}>
                <span class="name">
                  {i + 1}. {m.name}
                </span>
                {m.status !== "ok" && <span class={`status-${m.status}`}>{t(`status.${m.status}`)}</span>}
                <span class="meta">
                  {t("ui.game.position", { s: Math.round(m.pos.s * 10) / 10, angle: angleAt(geo, m.pos.s) })} · {onTraverse(s.state, m.id) ? t("ui.game.on_perila") : t(`zone.${zoneAt(geo, m.pos.s)}`)}
                </span>
              </div>
            </div>
            {attachmentText(state, m).map((x) => (
              <span class="meta">🔗 {x}</span>
            ))}
            <WeightBar baseKg={w.base} gearKg={w.gear} />
            {/* team gear only, as icons ×N; the individual set behind one icon (CR-40) */}
            <span class="items gear-icons">
              {individual.length > 0 && <ItemIcon type="individual" title={`${t("ui.game.individual_gear")}: ${summarize(individual.map(itemName))}`} />}
              {groupGear(team).map(({ it, n }) => (
                <span class="gear">
                  <ItemIcon type={it.type} props={it.props} title={itemName(it)} />
                  {n > 1 && <small>×{n}</small>}
                </span>
              ))}
            </span>
            <div class={`action ${planned && pv && !pv.ok ? "invalid" : ""}`}>
              {disabled ? t(`status.${m.status}`) : planned ? actionLabel(state, planned) : t("actionkind.skip")}
              {planned && pv && !pv.ok && pv.reasonKey && <div class="hint-line" style={{ color: "var(--danger)" }}>{formatKey(state, pv.reasonKey, pv.reasonParams)}</div>}
              {learning && planned && pv?.ok && pv.hints.map((h) => <div class="hint-line">⚠ {formatKey(state, h.key, h.params)}</div>)}
            </div>
          </div>
        );
      })}
    </>
  );
}

function summarize(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ") || "—";
}

function itemName(it: ItemState): string {
  const d = itemDetail(it.props);
  return d ? `${t(`item.${it.type}`)} ${d}` : t(`item.${it.type}`);
}

/** Equal items (same type and props) as one icon with a count. */
function groupGear(items: ItemState[]): { it: ItemState; n: number }[] {
  const out = new Map<string, { it: ItemState; n: number }>();
  for (const it of items) {
    const k = `${it.type}|${JSON.stringify(it.props)}`;
    const g = out.get(k);
    if (g) g.n += 1;
    else out.set(k, { it, n: 1 });
  }
  return [...out.values()];
}
