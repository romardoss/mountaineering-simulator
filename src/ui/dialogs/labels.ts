// Readable labels for action options and planned actions.
import { basePointsOf } from "../../engine/geometry/hill";
import { t, tl } from "../../i18n/i18n";
import type { ActionOption } from "../../engine/actions/options";
import type { ActionParams, GameState } from "../../engine/model/types";
import { knotName, memberName } from "../format";

export function ropeLabel(state: GameState, ropeId: string): string {
  const ropes = Object.values(state.items).filter((i) => i.type === "rope").map((i) => i.id).sort();
  const n = ropes.indexOf(ropeId) + 1;
  return t("ui.game.rope_n", { n: n > 0 ? n : ropeId });
}

export function baseLabel(state: GameState, basePointId: string): string {
  const bp = basePointsOf(state.scenario.route.obstacles[0]).find((b) => b.id === basePointId);
  return bp ? t("ui.game.base_at", { s: Math.round(bp.s) }) : basePointId;
}

export function labelParams(state: GameState, params: Record<string, string | number>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...params };
  for (const k of ["climber", "to"]) if (typeof out[k] === "string") out[k] = memberName(state, out[k]);
  if (typeof out.rope === "string") out.rope = ropeLabel(state, out.rope);
  if (typeof out.base === "string") out.base = baseLabel(state, out.base);
  if (typeof out.item === "string") out.item = t(`item.${out.item}`);
  if (typeof out.anchor === "string") out.anchor = t(`anchor.${out.anchor === "tree" ? "tree_large" : out.anchor}`);
  if (typeof out.braking === "string") out.braking = t(`ui.game.braking.${out.braking}`);
  if (typeof out.toward === "string") out.toward = t(`ui.game.toward.${out.toward}`);
  if (typeof out.target === "string" && state.ropes[out.target]) out.target = ropeLabel(state, out.target);
  else if (typeof out.target === "string") out.target = baseLabel(state, out.target);
  return out;
}

export function optionLabel(state: GameState, o: ActionOption): string {
  let s = t(o.labelKey, labelParams(state, o.labelParams));
  if (o.group === "belay" && o.params.kind === "belay") {
    s += ` — ${t(`ui.game.braking.${o.params.braking}`)}, ${t(`ui.game.anchor.${o.params.anchor}`)}`;
  }
  return s;
}

/** Short label for a planned action shown on member cards. */
export function actionLabel(state: GameState, p: ActionParams): string {
  const base = t(`actionkind.${p.kind}`);
  switch (p.kind) {
    case "move":
      if (p.targetS !== undefined) return t("ui.game.move_to", { s: Math.round(p.targetS * 10) / 10 });
      return `${base} · ${t("ui.m", { m: Math.round(p.distanceM * 10) / 10 })} ${t(`ui.game.toward.${p.toward}`)}`;
    case "command":
      return `${base} «${tl("uk", `cmd.${p.command}`)}»${p.misunderstood ? " ✗" : ""}`;
    case "attach":
      return `${base} · ${t(`method.${p.method}`)}${p.knot ? ` · ${knotName(p.knot.knotId)}` : ""}`;
    case "tie_in":
      return `${base} · ${knotName(p.knot.knotId)}`;
    case "fix_rope":
      return `${base} · ${p.method === "doubled" ? t("ui.game.doubled") : knotName(p.knot?.knotId ?? "")}`;
    case "belay":
      return `${base} · ${memberName(state, p.climberId)}${p.knot ? ` · ${knotName(p.knot.knotId)}` : ""}`;
    case "pass":
      return `${base} → ${memberName(state, p.toMemberId)} (${p.itemIds.length})`;
    case "pickup":
      return `${base} (${p.itemIds.length})`;
    default:
      return base;
  }
}
