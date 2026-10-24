// Hill geometry (§5.2): 1D path s along the slope, mapped to 2D world metres.
// The start zone, optional summit / ravine-bottom zone and finish zone are flat.
import type { BasePoint, HillConfig, Obstacle, Position, Section, Surface } from "../model/types";

export type Zone = "start" | "summit" | "bottom" | "finish" | "slope";

export interface Segment2D {
  s0: number;
  s1: number;
  angleDeg: number;
  /** +1 if elevation grows with s, -1 if it falls, 0 for flat zones. */
  sign: 1 | -1 | 0;
  surface: Surface | null;
  section: Section | null;
  zone: Zone;
  x0: number;
  y0: number;
}

export interface HillGeometry {
  obstacle: HillConfig;
  sections: Section[];
  segments: Segment2D[];
  totalLength: number;
  /** s where the last section ends (= finish zone start). */
  finishStart: number;
  startZoneEnd: number;
  summit: { s0: number; s1: number } | null;
  /** Ravine bottom (descent_ascent, CR-52). */
  bottom: { s0: number; s1: number } | null;
  heightGain: number;
  minY: number;
  maxY: number;
  maxX: number;
}

const cache = new WeakMap<object, HillGeometry>();
const spots = new WeakMap<object, BasePoint[]>();

/**
 * Base spots in effect (CR-31): the configured ones plus every large tree that has none,
 * as `bp@<treeId>`. Memoised by hill identity like the geometry.
 */
export function basePointsOf(hill: HillConfig): BasePoint[] {
  let out = spots.get(hill);
  if (!out) {
    out = [...hill.basePoints];
    for (const t of hill.trees) {
      if (t.size !== "large" || hill.basePoints.some((b) => b.treeId === t.id || Math.abs(b.s - t.s) < 0.5)) continue;
      out.push({ id: `bp@${t.id}`, s: t.s, anchorType: "tree", treeId: t.id });
    }
    out.sort((a, b) => a.s - b.s);
    spots.set(hill, out);
  }
  return out;
}

export function normaliseSections(hill: HillConfig): Section[] {
  const out: Section[] = [];
  let s = hill.startZoneM;
  const first: "up" | "down" = hill.routeType === "descent" || hill.routeType === "descent_ascent" ? "down" : "up";
  for (const c of hill.sections) {
    out.push({ ...c, direction: first, startS: s });
    s += c.lengthM;
  }
  if (hill.routeType === "descent_ascent") {
    s += hill.bottomZoneM ?? 4;
    for (const c of hill.ascentSections ?? []) {
      out.push({ ...c, direction: "up", startS: s });
      s += c.lengthM;
    }
  }
  if (hill.routeType === "ascent_descent") {
    s += hill.summitZoneM ?? 6;
    for (const c of hill.descentSections ?? []) {
      out.push({ ...c, direction: "down", startS: s });
      s += c.lengthM;
    }
  }
  return out;
}

export function buildHillGeometry(hill: Obstacle): HillGeometry {
  const cached = cache.get(hill);
  if (cached) return cached;
  const sections = normaliseSections(hill);
  const segments: Segment2D[] = [];
  let x = 0;
  let y = 0;
  const push = (s0: number, s1: number, angleDeg: number, sign: 1 | -1 | 0, section: Section | null, zone: Zone) => {
    segments.push({ s0, s1, angleDeg, sign, surface: section?.surface ?? null, section, zone, x0: x, y0: y });
    const rad = (angleDeg * Math.PI) / 180;
    x += (s1 - s0) * Math.cos(rad);
    y += sign * (s1 - s0) * Math.sin(rad);
  };
  push(0, hill.startZoneM, 0, 0, null, "start");
  let summit: HillGeometry["summit"] = null;
  let bottom: HillGeometry["bottom"] = null;
  const firstCount = hill.sections.length;
  const twoSided = hill.routeType === "ascent_descent" || hill.routeType === "descent_ascent";
  sections.forEach((sec, i) => {
    if (twoSided && i === firstCount && i > 0) {
      const s0 = sections[i - 1].startS + sections[i - 1].lengthM;
      const zone: Zone = hill.routeType === "descent_ascent" ? "bottom" : "summit";
      push(s0, sec.startS, 0, 0, null, zone);
      if (zone === "bottom") bottom = { s0, s1: sec.startS };
      else summit = { s0, s1: sec.startS };
    }
    push(sec.startS, sec.startS + sec.lengthM, sec.angleDeg, sec.direction === "up" ? 1 : -1, sec, "slope");
  });
  const last = sections[sections.length - 1];
  const finishStart = last ? last.startS + last.lengthM : hill.startZoneM;
  push(finishStart, finishStart + hill.finishZoneM, 0, 0, null, "finish");
  const ys = segments.map((g) => g.y0).concat([y]);
  let gain = 0;
  for (const sec of sections) if (sec.direction === "up") gain += sec.lengthM * Math.sin((sec.angleDeg * Math.PI) / 180);
  const geo: HillGeometry = {
    obstacle: hill,
    sections,
    segments,
    totalLength: finishStart + hill.finishZoneM,
    finishStart,
    startZoneEnd: hill.startZoneM,
    summit,
    bottom,
    heightGain: gain,
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    maxX: x,
  };
  cache.set(hill, geo);
  return geo;
}

export function clampS(geo: HillGeometry, s: number): number {
  return Math.max(0, Math.min(geo.totalLength, s));
}

export function segmentAt(geo: HillGeometry, s: number): Segment2D {
  const cs = clampS(geo, s);
  for (const g of geo.segments) if (cs >= g.s0 && cs < g.s1) return g;
  return geo.segments[geo.segments.length - 1];
}

export function toWorld(geo: HillGeometry, s: number): { x: number; y: number } {
  const g = segmentAt(geo, s);
  const d = clampS(geo, s) - g.s0;
  const rad = (g.angleDeg * Math.PI) / 180;
  return { x: g.x0 + d * Math.cos(rad), y: g.y0 + g.sign * d * Math.sin(rad) };
}

export function elevationAt(geo: HillGeometry, s: number): number {
  return toWorld(geo, s).y;
}

export function zoneAt(geo: HillGeometry, s: number): Zone {
  if (s <= geo.startZoneEnd) return "start";
  if (s >= geo.finishStart) return "finish";
  if (geo.summit && s >= geo.summit.s0 && s <= geo.summit.s1) return "summit";
  if (geo.bottom && s >= geo.bottom.s0 && s <= geo.bottom.s1) return "bottom";
  return "slope";
}

/** Ravine (CR-52): the перила span the gap between the start and the finish bank. */
export function isRavine(hill: HillConfig): boolean {
  return hill.type === "ravine";
}

/** Bank of a ravine at s: start or finish zone; null inside the gap. */
export function bankAt(geo: HillGeometry, s: number): "start" | "finish" | null {
  const z = zoneAt(geo, s);
  return z === "start" || z === "finish" ? z : null;
}

/** Path position under world x (x grows with s), by bisection. */
export function sAtWorldX(geo: HillGeometry, x: number): number {
  let lo = 0;
  let hi = geo.totalLength;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (toWorld(geo, mid).x < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function isSafeZone(geo: HillGeometry, s: number): boolean {
  return zoneAt(geo, s) !== "slope";
}

/** Angle of the terrain at s (0 in flat zones). */
export function angleAt(geo: HillGeometry, s: number): number {
  return segmentAt(geo, s).angleDeg;
}

/** Steepest angle over the path interval [a, b]. */
export function steepestBetween(geo: HillGeometry, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let max = 0;
  for (const g of geo.segments) if (g.s1 > lo && g.s0 <= hi) max = Math.max(max, g.angleDeg);
  return max;
}

/** Direction of s that goes physically downhill from s (−1 or +1). */
export function downhillDir(geo: HillGeometry, s: number): -1 | 1 {
  const g = segmentAt(geo, s);
  if (g.sign !== 0) return g.sign === 1 ? -1 : 1;
  // flat zone: look at the neighbouring slope
  const before = segmentAt(geo, g.s0 - 0.01);
  const after = segmentAt(geo, g.s1 + 0.01);
  if (g.zone === "start") return after.sign === -1 ? 1 : -1;
  if (g.zone === "finish") return before.sign === 1 ? -1 : 1;
  if (g.zone === "bottom") return 1; // the lowest point: any direction climbs
  return before.sign === 1 ? 1 : -1; // summit: descent side
}

export function pathDistance(a: Position, b: Position): number {
  return Math.abs(a.s - b.s);
}

export function isAdjacent(a: Position, b: Position, adjacencyM: number): boolean {
  return a.obstacleIndex === b.obstacleIndex && Math.abs(a.s - b.s) <= adjacencyM + 1e-9;
}

/** "Below" uses elevation, not s (ARCHITECTURE §4.3.3). */
export function isBelow(geo: HillGeometry, a: Position, b: Position): boolean {
  return elevationAt(geo, a.s) < elevationAt(geo, b.s) - 1e-9;
}

export function heightGain(geo: HillGeometry): number {
  return geo.heightGain;
}
