// Creating knot instances and deriving their context (§13.3, ARCHITECTURE §4.7.1).
import type { GameData } from "../data/types";
import { geoOf, ravineOf } from "../model/selectors";
import { bankAt } from "../geometry/hill";
import type {
  BaseState,
  ControlKnot,
  GameState,
  KnotContext,
  KnotInstance,
  KnotRating,
  MemberId,
} from "../model/types";
import type { StepTx } from "../resolution/tx";
import { evaluateKnot, type KnotEvalInput } from "./evaluate";
import { basePointsOf } from "../geometry/hill";

export function basePointOf(state: GameState, base: BaseState) {
  return basePointsOf(geoOf(state, base.pos.obstacleIndex).obstacle).find((p) => p.id === base.basePointId);
}

export function supportOf(state: GameState, basePointId: string): "thick" | "thin" | null {
  const hill = geoOf(state).obstacle;
  const bp = basePointsOf(hill).find((p) => p.id === basePointId);
  if (!bp) return null;
  if (bp.anchorType === "rock_outcrop") return "thick";
  if (bp.anchorType === "bolt") return null;
  const tree = hill.trees.find((t) => t.id === bp.treeId);
  return tree?.size === "small" ? "thin" : "thick";
}

export function anchorKind(state: GameState, basePointId: string): "tree_large" | "tree_small" | "rock_outcrop" | "bolt" {
  const hill = geoOf(state).obstacle;
  const bp = basePointsOf(hill).find((p) => p.id === basePointId);
  if (!bp || bp.anchorType === "bolt") return "bolt";
  if (bp.anchorType === "rock_outcrop") return "rock_outcrop";
  const tree = hill.trees.find((t) => t.id === bp.treeId);
  return tree?.size === "small" ? "tree_small" : "tree_large";
}

/** Context of tying a rope to a base (§13.3): carabiner, rock outcrop (CR-29), thick or thin tree. */
export function anchorContext(state: GameState, base: BaseState): KnotContext {
  // ravine перила are tied around the bank tree itself (CR-64)
  const bank = ravineOf(state) && anchorKind(state, base.basePointId).startsWith("tree") ? bankAt(geoOf(state), base.pos.s) : null;
  if (bank) return bank === "finish" ? "PERILA_FINISH" : "PERILA_START";
  if (base.carabinerId) return "ANCHOR_CARABINER";
  if (anchorKind(state, base.basePointId) === "rock_outcrop") return "ANCHOR_ROCK";
  return supportOf(state, base.basePointId) === "thin" ? "ANCHOR_THIN" : "ANCHOR_THICK";
}

export function createKnot(
  tx: StepTx,
  args: {
    knotId: string;
    context: KnotContext;
    control: ControlKnot;
    turns: number | null;
    memberId: MemberId | null;
    itemId: string;
    input: Omit<KnotEvalInput, "knotId" | "context" | "control" | "turns">;
    preTied?: boolean;
  },
): KnotInstance {
  const evaluation = evaluateKnot(tx.data, {
    knotId: args.knotId,
    context: args.context,
    control: args.control,
    turns: args.turns,
    ...args.input,
  });
  const k: KnotInstance = {
    id: tx.newId("k"),
    knotId: args.knotId,
    context: args.context,
    control: args.control,
    turns: args.turns,
    tiedBy: args.memberId,
    step: tx.state.step,
    preTied: !!args.preTied,
    itemId: args.itemId,
    evaluation,
    revealed: tx.state.scenario.mode === "learning",
  };
  tx.state.knots[k.id] = k;
  countKnot(tx.state, tx.data, k, args.memberId);
  const learning = tx.state.scenario.mode === "learning";
  tx.emit({
    type: "knot.tied",
    severity: learning && evaluation.rating !== "correct" ? (evaluation.rating === "acceptable" ? "hint" : "warning") : "info",
    messageKey: learning ? "event.knot_tied_rated" : "event.knot_tied",
    params: { member: args.memberId ?? "", knot: args.knotId, context: args.context, rating: evaluation.rating },
    refs: { members: args.memberId ? [args.memberId] : [], knots: [k.id], items: [args.itemId] },
  });
  if (evaluation.rating !== "correct" || evaluation.failProbShock > 0) {
    tx.mistake("summary.knot", { member: args.memberId ?? "", knot: args.knotId, context: args.context, rating: evaluation.rating }, `knot:${args.knotId}`);
    for (const msg of evaluation.messages.slice(1)) tx.mistake(msg.key, { ...(msg.params ?? {}), member: args.memberId ?? "" }, `knot:${args.knotId}`);
  }
  return k;
}

export function countKnot(state: GameState, _data: GameData, k: KnotInstance, memberId: MemberId | null) {
  const st = state.stats.knots;
  st.total += 1;
  st[k.evaluation.rating as KnotRating] += 1;
  if (k.preTied) st.preTied += 1;
  if (k.evaluation.messages.some((m) => m.ruleId === "mod.missingControl")) st.missingControl += 1;
  if (memberId && state.stats.members[memberId]) state.stats.members[memberId].knots[k.evaluation.rating] += 1;
  state.stats.knotHistory.push({ id: k.id, knotId: k.knotId, context: k.context, rating: k.evaluation.rating, tiedBy: memberId, step: k.step, preTied: k.preTied, messages: k.evaluation.messages.map((x) => x.key) });
}

export function removeKnot(tx: StepTx, knotId: string) {
  delete tx.state.knots[knotId];
}
