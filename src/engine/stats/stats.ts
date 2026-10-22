// End-of-game statistics (§16).
import type { GameData } from "../data/types";
import { geoOf, itemPos } from "../model/selectors";
import type { GameState, ItemId, StatsCounters } from "../model/types";

export interface Stats extends StatsCounters {
  outcome: GameState["outcome"];
  simTimeS: number;
  /** Items not with the team in the finish zone (§9.2.6). */
  itemsLeft: { id: ItemId; type: string; s: number }[];
}

/** An item is "left on the hill" if it is not carried/worn and lies outside the finish zone. */
export function itemsLeftOnHill(state: GameState): Stats["itemsLeft"] {
  const geo = geoOf(state);
  const out: Stats["itemsLeft"] = [];
  for (const it of Object.values(state.items)) {
    if (it.location.kind === "carried" || it.location.kind === "worn") continue;
    if (it.location.kind === "in_use" && it.location.structure.kind === "rope") {
      const rope = state.ropes[it.id];
      if (rope && rope.nodes.every((n) => n.pos.s >= geo.finishStart - 1e-6)) continue;
      out.push({ id: it.id, type: it.type, s: Math.round((rope?.nodes[0]?.pos.s ?? 0) * 10) / 10 });
      continue;
    }
    const pos = itemPos(state, it);
    if (pos && pos.s >= geo.finishStart - 1e-6) continue;
    out.push({ id: it.id, type: it.type, s: Math.round((pos?.s ?? 0) * 10) / 10 });
  }
  return out;
}

export function computeStats(_data: GameData, state: GameState): Stats {
  return {
    ...structuredClone(state.stats),
    outcome: state.outcome,
    simTimeS: state.simTimeS,
    itemsLeft: itemsLeftOnHill(state),
  };
}
