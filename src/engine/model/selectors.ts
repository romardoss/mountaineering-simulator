// Derived, read-only queries over GameState (ARCHITECTURE §4.2.4).
import type { GameData } from "../data/types";
import {
  buildHillGeometry,
  segmentAt,
  steepestBetween,
  type HillGeometry,
} from "../geometry/hill";
import type {
  Attachment,
  BaseState,
  BelayRelation,
  GameState,
  ItemState,
  ItemType,
  MemberId,
  MemberState,
  Position,
  RopeLayout,
  RopeNode,
  Season,
  Surface,
  Weather,
} from "./types";

export function geoOf(state: GameState, obstacleIndex = 0): HillGeometry {
  return buildHillGeometry(state.scenario.route.obstacles[obstacleIndex]);
}

/** Surface after season and weather (S§6.5): winter → snow / ice; rain / mud → mud, wet rock. */
export function mapSurface(data: GameData, season: Season, weather: Weather, s: Surface): Surface {
  if (s !== "grass" && s !== "ground" && s !== "rock" && s !== "scree") return s;
  if (season === "winter") return data.seasons.surfaceMap.winter[s];
  if (weather !== "rain" && weather !== "mud") return s; // also saves from before CR-11
  return data.seasons.surfaceMap[weather][s] ?? s;
}

/** Rock-type surfaces share the rock injury thresholds and move factor. */
export function isRockSurface(s: Surface | null): boolean {
  return s === "rock" || s === "icy_rock" || s === "wet_rock";
}

export function effectiveSurface(state: GameState, data: GameData, s: Surface | null): Surface | null {
  return s ? mapSurface(data, state.scenario.season, state.weather, s) : null;
}

export function surfaceAt(state: GameState, data: GameData, pos: Position): Surface | null {
  return effectiveSurface(state, data, segmentAt(geoOf(state, pos.obstacleIndex), pos.s).surface);
}

export function steepest(state: GameState, a: Position, b: Position): number {
  return steepestBetween(geoOf(state, a.obstacleIndex), a.s, b.s);
}

// ---------------------------------------------------------------- items

export function itemsWith(state: GameState, memberId: MemberId, kinds: ("carried" | "worn")[] = ["carried", "worn"]): ItemState[] {
  return Object.values(state.items).filter(
    (it) => (it.location.kind === "carried" || it.location.kind === "worn") &&
      kinds.includes(it.location.kind) && it.location.memberId === memberId,
  );
}

export function carried(state: GameState, memberId: MemberId, type?: ItemType): ItemState[] {
  return itemsWith(state, memberId, ["carried"]).filter((it) => !type || it.type === type);
}

export function wears(state: GameState, memberId: MemberId, type: ItemType): boolean {
  return itemsWith(state, memberId, ["worn"]).some((it) => it.type === type);
}

export function isLockingCarabiner(it: ItemState): boolean {
  return it.type === "carabiner" && !!it.props.locking;
}

/** Picks the first carried locking carabiner (HMS preferred) not in `exclude`. */
export function pickCarabiner(state: GameState, memberId: MemberId, exclude: string[] = [], hmsOnly = false): ItemState | undefined {
  const list = carried(state, memberId, "carabiner").filter((c) => !exclude.includes(c.id));
  const locking = list.filter(isLockingCarabiner);
  const hms = locking.filter((c) => c.props.shape === "hms");
  if (hmsOnly) return hms[0];
  return hms[0] ?? locking[0];
}

export function anyCarabiner(state: GameState, memberId: MemberId, exclude: string[] = []): ItemState | undefined {
  return pickCarabiner(state, memberId, exclude) ?? carried(state, memberId, "carabiner").find((c) => !exclude.includes(c.id));
}

export function memberWeightKg(state: GameState, memberId: MemberId): { base: number; gear: number; total: number } {
  const m = state.members[memberId];
  const gear = itemsWith(state, memberId).reduce((sum, it) => sum + it.weightKg, 0);
  return { base: m.baseWeightKg, gear, total: m.baseWeightKg + gear };
}

export type WeightBand = "comfort" | "heavy" | "over" | "max";

export function weightBand(data: GameData, totalKg: number): WeightBand {
  const w = data.rules.weight;
  if (totalKg <= w.comfortKg + 1e-9) return "comfort";
  if (totalKg <= w.heavyKg + 1e-9) return "heavy";
  if (totalKg <= w.maxKg + 1e-9) return "over";
  return "max";
}

export function weightMoveFactor(data: GameData, totalKg: number): number {
  const band = weightBand(data, totalKg);
  if (band === "heavy") return data.rules.weight.heavyMoveFactor;
  if (band === "over" || band === "max") return data.rules.weight.overMoveFactor;
  return 1;
}

/** Position of an item, following its location chain. */
export function itemPos(state: GameState, it: ItemState): Position | null {
  const loc = it.location;
  if (loc.kind === "carried" || loc.kind === "worn") return state.members[loc.memberId]?.pos ?? null;
  if (loc.kind === "on_ground") return loc.pos;
  const st = loc.structure;
  switch (st.kind) {
    case "base":
      return state.bases[st.baseId]?.pos ?? null;
    case "rope": {
      const r = state.ropes[st.ropeId];
      return r?.nodes[0]?.pos ?? null;
    }
    case "attachment": {
      const a = state.attachments[st.attachmentId];
      return a ? state.members[a.memberId].pos : null;
    }
    case "belay": {
      const b = state.belays[st.belayId];
      return b ? state.members[b.belayerId].pos : null;
    }
    case "knot": {
      const k = state.knots[st.knotId];
      return k ? itemPos(state, state.items[k.itemId]) : null;
    }
  }
}

// ---------------------------------------------------------------- ropes

export function ropeNodeIndex(rope: RopeLayout, nodeId: string): number {
  return rope.nodes.findIndex((n) => n.id === nodeId);
}

export function isBaseNode(n: RopeNode): boolean {
  return n.attach.kind === "base";
}

export function knotsOnItem(state: GameState, itemId: string): number {
  return Object.values(state.knots).filter((k) => k.itemId === itemId).length;
}

/** Path length the rope layout uses, including the knot allowance (§9.2.4). */
export function ropeUsedM(state: GameState, data: GameData, rope: RopeLayout, override?: { nodeId: string; s: number }): number {
  let sum = 0;
  for (let i = 0; i + 1 < rope.nodes.length; i++) {
    const a = override && rope.nodes[i].id === override.nodeId ? override.s : rope.nodes[i].pos.s;
    const b = override && rope.nodes[i + 1].id === override.nodeId ? override.s : rope.nodes[i + 1].pos.s;
    sum += Math.abs(a - b);
  }
  return sum + data.rules.knotRopeAllowanceM * knotsOnItem(state, rope.ropeId);
}

export interface FixedSegment {
  ropeId: string;
  lowerNodeId: string;
  upperNodeId: string;
  lower: RopeNode;
  upper: RopeNode;
  key: string;
}

/** Fixed-rope segments are derived, never stored (§9.4.3). */
export function fixedSegments(state: GameState, rope: RopeLayout): FixedSegment[] {
  const geo = geoOf(state);
  const out: FixedSegment[] = [];
  for (let i = 0; i + 1 < rope.nodes.length; i++) {
    const a = rope.nodes[i];
    const b = rope.nodes[i + 1];
    if (!isBaseNode(a) || !isBaseNode(b)) continue;
    if (Math.abs(a.pos.s - b.pos.s) < 1e-6) continue;
    const aLower = geoElev(geo, a.pos.s) <= geoElev(geo, b.pos.s);
    const lower = aLower ? a : b;
    const upper = aLower ? b : a;
    out.push({ ropeId: rope.ropeId, lowerNodeId: lower.id, upperNodeId: upper.id, lower, upper, key: segmentKey(rope.ropeId, lower.id, upper.id) });
  }
  // A doubled rope: both strands hang from the anchor; treat each strand end as
  // anchored when it is the end lying below the doubled node (descent self-belay).
  return out;
}

/** Strands hanging from a doubled / releasable anchor (descent, §7.1.9). */
export function hangingStrands(state: GameState, rope: RopeLayout): FixedSegment[] {
  const out: FixedSegment[] = [];
  const geo = geoOf(state);
  for (let i = 0; i < rope.nodes.length; i++) {
    const n = rope.nodes[i];
    if (n.attach.kind !== "base") continue;
    const anchored = n.attach.mode === "doubled" || n.attach.mode === "fixed";
    if (!anchored) continue;
    for (const j of [i - 1, i + 1]) {
      const end = rope.nodes[j];
      if (!end || end.attach.kind !== "free") continue;
      if (geoElev(geo, end.pos.s) >= geoElev(geo, n.pos.s)) continue;
      out.push({ ropeId: rope.ropeId, lowerNodeId: end.id, upperNodeId: n.id, lower: end, upper: n, key: segmentKey(rope.ropeId, end.id, n.id) });
    }
  }
  return out;
}

/** Every rope part a member can self-belay on: fixed segments + hanging strands. */
export function belayableSegments(state: GameState): FixedSegment[] {
  const out: FixedSegment[] = [];
  for (const r of Object.values(state.ropes)) out.push(...fixedSegments(state, r), ...hangingStrands(state, r));
  return out;
}

export function findSegment(state: GameState, ropeId: string, lowerNodeId: string, upperNodeId: string): FixedSegment | undefined {
  return belayableSegments(state).find((s) => s.ropeId === ropeId && s.lowerNodeId === lowerNodeId && s.upperNodeId === upperNodeId);
}

export function segmentKey(ropeId: string, a: string, b: string): string {
  return `${ropeId}:${a}:${b}`;
}

export function elevationOfS(geo: HillGeometry, s: number): number {
  return geoElev(geo, s);
}

function geoElev(geo: HillGeometry, s: number): number {
  const g = segmentAt(geo, s);
  const d = s - g.s0;
  return g.y0 + g.sign * d * Math.sin((g.angleDeg * Math.PI) / 180);
}

export function segmentSpan(seg: FixedSegment): [number, number] {
  return [Math.min(seg.lower.pos.s, seg.upper.pos.s), Math.max(seg.lower.pos.s, seg.upper.pos.s)];
}

// ---------------------------------------------------------------- relations

export function attachmentsOf(state: GameState, memberId: MemberId): Attachment[] {
  return Object.values(state.attachments).filter((a) => a.memberId === memberId);
}

export function harnessNodes(state: GameState, memberId: MemberId): { rope: RopeLayout; node: RopeNode; index: number }[] {
  const out: { rope: RopeLayout; node: RopeNode; index: number }[] = [];
  for (const rope of Object.values(state.ropes)) {
    rope.nodes.forEach((node, index) => {
      if (node.attach.kind === "member_harness" && node.attach.memberId === memberId) out.push({ rope, node, index });
    });
  }
  return out;
}

export function belaysAsClimber(state: GameState, memberId: MemberId): BelayRelation[] {
  return Object.values(state.belays).filter((b) => b.climberId === memberId);
}

export function belaysAsBelayer(state: GameState, memberId: MemberId): BelayRelation[] {
  return Object.values(state.belays).filter((b) => b.belayerId === memberId);
}

export function baseAt(state: GameState, basePointId: string): BaseState | undefined {
  return Object.values(state.bases).find((b) => b.basePointId === basePointId);
}

export function membersOnSegment(state: GameState, key: string): MemberId[] {
  const out = new Set<MemberId>();
  for (const a of Object.values(state.attachments)) {
    if (a.target.kind !== "segment") continue;
    if (segmentKey(a.target.ropeId, a.target.lowerNodeId, a.target.upperNodeId) === key) out.add(a.memberId);
  }
  return [...out];
}

/** Carabiner load (§9.2.5): ropes clipped through / tied to a base carabiner. */
export function carabinerLoad(state: GameState, carabinerId: string): number {
  let n = 0;
  const base = Object.values(state.bases).find((b) => b.carabinerId === carabinerId);
  if (base) {
    for (const r of Object.values(state.ropes)) {
      for (const node of r.nodes) {
        if (node.attach.kind === "base" && node.attach.baseId === base.id) {
          if (node.attach.mode === "running" || node.attach.mode === "doubled") n++;
          else if (node.attach.mode === "fixed" && state.knots[node.attach.knotId]?.context === "ANCHOR_CARABINER") n++;
        }
      }
    }
  }
  return n;
}

export function isActive(m: MemberState): boolean {
  return m.status !== "injured" && m.status !== "finished";
}

export function inFinish(state: GameState, m: MemberState): boolean {
  return m.pos.s >= geoOf(state, m.pos.obstacleIndex).finishStart - 1e-9;
}
