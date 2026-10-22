// Movement limits (§7.2, §11.4): terrain budget and physical constraints.
import type { GameData } from "../data/types";
import { segmentAt, type HillGeometry } from "../geometry/hill";
import {
  attachmentsOf,
  belaysAsClimber,
  effectiveSurface,
  isRockSurface,
  findSegment,
  geoOf,
  harnessNodes,
  memberWeightKg,
  ropeUsedM,
  segmentSpan,
  weightMoveFactor,
} from "../model/selectors";
import type { GameState, MemberId, Surface } from "../model/types";
import { knotDef } from "../knots/evaluate";

export function bandFor(data: GameData, angleDeg: number) {
  return data.rules.angleBands.find((b) => angleDeg <= b.maxDeg + 1e-9) ?? data.rules.angleBands[data.rules.angleBands.length - 1];
}

export function surfaceMoveFactor(data: GameData, s: Surface | null): number {
  if (!s) return 1;
  if (s === "snow" || s === "snow_scree") return data.rules.moveModifiers.snow;
  if (s === "mud") return data.rules.moveModifiers.mud;
  if (isRockSurface(s)) return data.rules.moveModifiers.rock;
  return 1;
}

export function usesGrabbingKnot(state: GameState, memberId: MemberId): boolean {
  return attachmentsOf(state, memberId).some((a) => a.method === "grabbing_knot" && a.target.kind === "segment");
}

/** How far the member can move in one step over the terrain (multi-section budget). */
export function terrainReach(data: GameData, state: GameState, memberId: MemberId, dir: 1 | -1): number {
  const m = state.members[memberId];
  const geo = geoOf(state, m.pos.obstacleIndex);
  let mult = weightMoveFactor(data, memberWeightKg(state, memberId).total);
  if (usesGrabbingKnot(state, memberId)) mult *= data.rules.moveModifiers.grabbingKnot;
  let s = m.pos.s;
  let remaining = 1;
  let guard = 0;
  while (remaining > 1e-9 && guard++ < 100) {
    if ((dir === 1 && s >= geo.totalLength - 1e-9) || (dir === -1 && s <= 1e-9)) break;
    const g = segmentAt(geo, dir === 1 ? s : s - 1e-6);
    const uphill = g.sign * dir > 0 ? data.rules.moveModifiers.uphill : 1; // CR-19
    const full = bandFor(data, g.angleDeg).moveM * mult * uphill * surfaceMoveFactor(data, effectiveSurface(state, data, g.surface));
    const toBoundary = dir === 1 ? g.s1 - s : s - g.s0;
    if (toBoundary >= remaining * full - 1e-9) {
      s += dir * remaining * full;
      remaining = 0;
    } else {
      s += dir * toBoundary;
      remaining -= toBoundary / full;
    }
  }
  return round2(Math.abs(s - m.pos.s));
}

export interface ReachLimit {
  reach: number;
  reasonKey: string | null;
  gardaBlocked?: boolean;
}

/** Physical constraints: base self-belay, segment ends, rope length, Garda (§11.4.2, §13.6.1). */
export function constraintReach(data: GameData, state: GameState, memberId: MemberId, dir: 1 | -1): ReachLimit {
  const m = state.members[memberId];
  const geo: HillGeometry = geoOf(state, m.pos.obstacleIndex);
  const s0 = m.pos.s;
  let reach = dir === 1 ? geo.totalLength - s0 : s0;
  let reasonKey: string | null = reach <= 1e-6 ? "reason.route_end" : null;
  let gardaBlocked = false;
  const limit = (r: number, key: string) => {
    if (r < reach - 1e-9) {
      reach = Math.max(0, r);
      reasonKey = key;
    }
  };
  for (const a of attachmentsOf(state, memberId)) {
    if (a.target.kind === "base") {
      const b = state.bases[a.target.baseId];
      const edge = b.pos.s + dir * data.rules.adjacencyM;
      limit(Math.max(0, dir * (edge - s0)), "reason.secured_to_base");
    } else {
      const seg = findSegment(state, a.target.ropeId, a.target.lowerNodeId, a.target.upperNodeId);
      if (!seg) continue;
      const [lo, hi] = segmentSpan(seg);
      limit(Math.max(0, dir === 1 ? hi - s0 : s0 - lo), "reason.segment_end");
    }
  }
  for (const { rope, node } of harnessNodes(state, memberId)) {
    const len = state.items[rope.ropeId].props.lengthM ?? 0;
    // binary search the furthest s with rope used <= length (convex in s)
    const ok = (s: number) => ropeUsedM(state, data, rope, { nodeId: node.id, s }) <= len + 1e-9;
    if (!ok(s0 + dir * 0.0001) && ropeUsedM(state, data, rope, { nodeId: node.id, s: s0 + dir * 0.0001 }) > ropeUsedM(state, data, rope)) {
      limit(0, "reason.rope_too_short");
      continue;
    }
    let lo = 0;
    let hi = reach;
    if (!ok(s0 + dir * hi)) {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (ok(s0 + dir * mid)) lo = mid;
        else hi = mid;
      }
      limit(lo, "reason.rope_too_short");
    }
  }
  // Garda in lower belay cannot pay out rope: only the slack there was (§13.6.1).
  for (const b of belaysAsClimber(state, memberId)) {
    if (b.braking.kind !== "knot") continue;
    const k = state.knots[b.braking.knotId];
    const def = k && knotDef(data, k.knotId);
    if (!def || b.mode !== "lower" || def.feedsInLowerBelay !== false) continue;
    const belayer = state.members[b.belayerId];
    const away = Math.sign(s0 - belayer.pos.s) === dir || Math.abs(s0 - belayer.pos.s) < 1e-9;
    if (!away) continue;
    const allowed = b.distanceAtSetM + data.hazards.injury.slackM - Math.abs(s0 - belayer.pos.s);
    if (allowed < reach - 1e-9) gardaBlocked = true;
    limit(Math.max(0, allowed), "reason.garda_blocks_feed");
  }
  return { reach: round2(reach), reasonKey, gardaBlocked };
}

export function round2(x: number): number {
  return Math.floor(x * 100 + 1e-6) / 100;
}

export function dirOf(toward: "finish" | "start"): 1 | -1 {
  return toward === "finish" ? 1 : -1;
}
