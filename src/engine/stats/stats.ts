// End-of-game statistics (§16).
import type { GameData } from "../data/types";
import { geoOf, itemPos, ravineOf } from "../model/selectors";
import type { GameState, ItemId, StatsCounters } from "../model/types";

export interface Stats extends StatsCounters {
  outcome: GameState["outcome"];
  simTimeS: number;
  /** Items not with the team in the finish zone (§9.2.6). */
  itemsLeft: { id: ItemId; type: string; s: number }[];
  /** Ravine score (CR-58): points lost for equipment left behind and for crossings on sagging перила; null on hills. */
  penalties: Penalties | null;
}

export interface Penalties {
  items: { id: ItemId; type: string; points: number }[];
  sagCrossings: number;
  sagPoints: number;
  total: number;
  score: number;
  maxScore: number;
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

export function penaltiesOf(data: GameData, state: GameState, itemsLeft: Stats["itemsLeft"]): Penalties | null {
  if (!ravineOf(state)) return null;
  const sc = data.ravine.score;
  const items = itemsLeft.map((i) => ({ id: i.id, type: i.type, points: sc.lostItemPoints[i.type] ?? sc.lostItemPoints.default ?? 0 }));
  const sagCrossings = state.stats.mistakes.filter((m) => m.key === "summary.traverse_sag").length;
  const sagPoints = sagCrossings * sc.sagPoints;
  const total = items.reduce((a, i) => a + i.points, 0) + sagPoints;
  return { items, sagCrossings, sagPoints, total, score: Math.max(0, sc.base - total), maxScore: sc.base };
}

export function computeStats(data: GameData, state: GameState): Stats {
  const itemsLeft = itemsLeftOnHill(state);
  return {
    ...structuredClone(state.stats),
    outcome: state.outcome,
    simTimeS: state.simTimeS,
    itemsLeft,
    penalties: penaltiesOf(data, state, itemsLeft),
  };
}
