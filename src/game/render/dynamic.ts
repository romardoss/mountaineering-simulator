// Dynamic world objects: bases and dropped items (redrawn per state), ropes and
// self-belay lines (redrawn every frame so they follow animated members, §18.3.3–4).
import Phaser from "phaser";
import { bankAt } from "../../engine/geometry/hill";
import { belayableSegments, crossingsOf, fixedSegments, isGapSegment, tensionQuality, traverseAttachment, type FixedSegment } from "../../engine/model/selectors";
import { data } from "../../app/store";
import type { GameState, RopeNode } from "../../engine/model/types";
import { HANDS_DY, HARNESS_DY, PX_PER_M, type WorldMap } from "./world";

export interface Pt {
  x: number;
  y: number;
}

/** Where each member is drawn right now (feet position), supplied by the member view. */
export type FeetLookup = (memberId: string) => Pt | null;
/** Members drawn lying under ravine перила right now (CR-70). */
export type LyingLookup = (memberId: string) => boolean;

export function drawStatic(g: Phaser.GameObjects.Graphics, state: GameState, world: WorldMap) {
  g.clear();
  for (const b of Object.values(state.bases)) {
    const p = world.at(b.pos.s);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    // sling around the anchor + locking carabiner + small flag
    if (b.construction === "sling") g.lineStyle(2, 0x5fa8f0).strokeEllipse(x, y - 6, 12, 7);
    g.fillStyle(0x1a1c2c).fillRect(x - 2, y - 6, 4, 7);
    g.fillStyle(0xc8c8d0).fillRect(x - 1, y - 5, 2, 5);
    if (b.carabinerId) g.fillStyle(0xffd23f).fillRect(x - 1, y - 3, 2, 1);
    g.fillStyle(0x5a3a22).fillRect(x + 6, y - 16, 1, 16);
    g.fillStyle(0xf2a65a).fillTriangle(x + 7, y - 16, x + 7, y - 11, x + 12, y - 14);
  }
  for (const it of Object.values(state.items)) {
    if (it.location.kind !== "on_ground") continue;
    const p = world.at(it.location.pos.s);
    const c = parseInt((it.props.color ?? "#f2a65a").replace("#", ""), 16);
    g.fillStyle(0x1a1c2c).fillRect(Math.round(p.x) - 3, Math.round(p.y) - 4, 6, 4);
    g.fillStyle(isNaN(c) ? 0xf2a65a : c).fillRect(Math.round(p.x) - 2, Math.round(p.y) - 3, 4, 2);
  }
}

function nodePoint(state: GameState, world: WorldMap, n: RopeNode, feet: FeetLookup): Pt {
  if (n.attach.kind === "member_harness") {
    const f = feet(n.attach.memberId);
    if (f) return { x: f.x, y: f.y - HARNESS_DY };
  }
  if (n.attach.kind === "belay") {
    const b = state.belays[n.attach.belayId];
    const f = b ? feet(b.belayerId) : null;
    if (f) return { x: f.x + 5, y: f.y - HANDS_DY };
  }
  if (n.attach.kind === "held") {
    const f = feet(n.attach.memberId);
    if (f) return { x: f.x + 5, y: f.y - HANDS_DY };
  }
  const p = world.at(n.pos.s);
  if (n.attach.kind === "base") return { x: p.x, y: p.y - 4 };
  return { x: p.x, y: p.y - 1 };
}

function ropeColor(state: GameState, ropeId: string): number {
  const c = state.items[ropeId]?.props.color ?? "#d93636";
  const v = parseInt(c.replace("#", ""), 16);
  return isNaN(v) ? 0xd93636 : v;
}

/** Quadratic sag between two points, as a pixel polyline. */
function sagLine(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, sag: number) {
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
  let px = a.x;
  let py = a.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t + sag * 4 * t * (1 - t);
    g.lineBetween(Math.round(px), Math.round(py), Math.round(x), Math.round(y));
    px = x;
    py = y;
  }
}

/** Sag of ravine перила as a share of the span (CR-55): hanging into the gap until tensioned. */
const PERILA_SAG = { none: 0.3, weak: 0.1, good: 0 } as const; // good tension: a straight line (CR-70)
/** Lanyard: the harness of a member on the перила hangs this far below the rope (px). */
const HANG_DY = 4;

/** Sag shown right now per перила rope: eases toward the tension's sag, so the rope visibly takes in slack (CR-68). */
const shownSag = new Map<string, number>();
let lastEase = 0;
/** Time constant of the slack being taken in (ms): taut after ≈ 1.5 s. */
const SAG_EASE_MS = 350;

/** Called when a new world is built: no easing from another game's rope. */
export function resetSagAnimation() {
  shownSag.clear();
}

/** Ravine перила as drawn: both anchor points and the sag in px at mid-span. */
export function perilaCurve(state: GameState, world: WorldMap, seg: FixedSegment): { a: Pt; b: Pt; sag: number } {
  const p0 = world.at(seg.lower.pos.s);
  const p1 = world.at(seg.upper.pos.s);
  const [a, b] = p0.x <= p1.x ? [p0, p1] : [p1, p0];
  const q = tensionQuality(data, crossingsOf(state)[seg.ropeId]);
  const target = Math.hypot(b.x - a.x, b.y - a.y) * PERILA_SAG[q];
  return { a: { x: a.x, y: a.y - 4 }, b: { x: b.x, y: b.y - 4 }, sag: shownSag.get(seg.ropeId) ?? target };
}

/** One frame of easing for every перила rope toward its target sag. */
function easeSag(state: GameState, world: WorldMap, gaps: FixedSegment[]) {
  const now = performance.now();
  const dt = lastEase ? Math.min(100, now - lastEase) : 0;
  lastEase = now;
  for (const seg of gaps) {
    const p0 = world.at(seg.lower.pos.s);
    const p1 = world.at(seg.upper.pos.s);
    const target = Math.hypot(p1.x - p0.x, p1.y - p0.y) * PERILA_SAG[tensionQuality(data, crossingsOf(state)[seg.ropeId])];
    const cur = shownSag.get(seg.ropeId);
    shownSag.set(seg.ropeId, cur === undefined ? target : cur + (target - cur) * (1 - Math.exp(-dt / SAG_EASE_MS)));
  }
}

/** y of the drawn перила at screen x. */
function curveY(c: { a: Pt; b: Pt; sag: number }, x: number): number {
  const t = Math.max(0, Math.min(1, (x - c.a.x) / (c.b.x - c.a.x || 1)));
  return c.a.y + (c.b.y - c.a.y) * t + c.sag * 4 * t * (1 - t);
}

/**
 * How far weak перила go down under a person's weight at x (px, CR-70): none when well
 * tensioned (straight), 2–6 m mid-span when weak (less tension → deeper), 0 at the anchors.
 */
function loadDip(state: GameState, c: { a: Pt; b: Pt }, ropeId: string, x: number): number {
  const cr = crossingsOf(state)[ropeId];
  const q = tensionQuality(data, cr);
  if (q === "good") return 0;
  const metres = q === "weak" ? 2 + 4 * (1 - (cr?.tension ?? 0) / data.ravine.goodTension) : 6;
  const t = Math.max(0, Math.min(1, (x - c.a.x) / (c.b.x - c.a.x || 1)));
  return metres * PX_PER_M * 4 * t * (1 - t);
}

/**
 * Feet of a member hanging on the перила over the gap, or null when they stand on the ground
 * (CR-55). They lie horizontally, face up, under the rope (CR-70): the sprite is turned −90°
 * around the feet, so the harness is HARNESS_DY px left of the feet, HANG_DY below the rope.
 */
export function hangPoint(state: GameState, world: WorldMap, memberId: string, s: number): (Pt & { lying: true }) | null {
  const a = traverseAttachment(state, memberId);
  if (!a || bankAt(world.geo, s) !== null) return null;
  const seg = belayableSegments(state).find((x) => x.ropeId === a.target.ropeId && isGapSegment(state, x));
  if (!seg) return null;
  const x = world.at(s).x;
  const c = perilaCurve(state, world, seg);
  // a loaded rope runs straight to the load point; unloaded parts keep the eased sag
  const y = c.a.y + (c.b.y - c.a.y) * Math.max(0, Math.min(1, (x - c.a.x) / (c.b.x - c.a.x || 1))) + loadDip(state, c, seg.ropeId, x);
  return { x: x + HARNESS_DY, y: y + HANG_DY, lying: true };
}

/** Where the lanyard of a lying member meets the rope. */
function ropePointOf(f: Pt): Pt {
  return { x: f.x - HARNESS_DY, y: f.y - HANG_DY };
}

export function drawRopes(g: Phaser.GameObjects.Graphics, state: GameState, world: WorldMap, feet: FeetLookup, lying: LyingLookup = () => false) {
  g.clear();
  easeSag(state, world, Object.values(state.ropes).flatMap((r) => fixedSegments(state, r).filter((s) => isGapSegment(state, s))));
  for (const rope of Object.values(state.ropes)) {
    const color = ropeColor(state, rope.ropeId);
    const segs = fixedSegments(state, rope);
    const gap = segs.find((s) => isGapSegment(state, s));
    if (gap) {
      // перила over the ravine: sag by tension, not taut by default
      const c = perilaCurve(state, world, gap);
      // people hanging on it: straight pieces from anchor to load points (CR-70)
      const loads = Object.values(state.attachments)
        .filter((a) => a.target.kind === "segment" && a.target.ropeId === rope.ropeId && lying(a.memberId))
        .map((a) => feet(a.memberId))
        .filter((f): f is Pt => !!f)
        .map(ropePointOf)
        .sort((p, q) => p.x - q.x);
      const pts = [c.a, ...loads, c.b];
      for (const [w, col, dy] of [[2, 0x1a1c2c, 1], [1, color, 0]] as const) {
        g.lineStyle(w, col, w === 2 ? 0.35 : 1);
        if (!loads.length) sagLine(g, { x: c.a.x, y: c.a.y + dy }, { x: c.b.x, y: c.b.y + dy }, c.sag);
        else for (let i = 0; i + 1 < pts.length; i++) g.lineBetween(Math.round(pts[i].x), Math.round(pts[i].y + dy), Math.round(pts[i + 1].x), Math.round(pts[i + 1].y + dy));
      }
    }
    const gapKey = gap ? new Set([`${gap.lowerNodeId}|${gap.upperNodeId}`, `${gap.upperNodeId}|${gap.lowerNodeId}`]) : new Set<string>();
    const fixed = new Set(segs.map((s) => `${s.lowerNodeId}|${s.upperNodeId}`));
    const pts = rope.nodes.map((n) => nodePoint(state, world, n, feet));
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = rope.nodes[i];
      const b = rope.nodes[i + 1];
      if (gapKey.has(`${a.id}|${b.id}`)) continue;
      const taut = fixed.has(`${a.id}|${b.id}`) || fixed.has(`${b.id}|${a.id}`);
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      g.lineStyle(2, 0x1a1c2c, 0.35);
      sagLine(g, { x: pts[i].x, y: pts[i].y + 1 }, { x: pts[i + 1].x, y: pts[i + 1].y + 1 }, taut ? 0 : Math.min(10, len * 0.06));
      g.lineStyle(1, color, 1);
      sagLine(g, pts[i], pts[i + 1], taut ? 0 : Math.min(10, len * 0.06));
    }
    // loose coil at a free end lying on the ground
    for (const [i, n] of rope.nodes.entries()) {
      if (n.attach.kind !== "free" || (i !== 0 && i !== rope.nodes.length - 1)) continue;
      const p = pts[i];
      g.lineStyle(1, color, 1).strokeEllipse(Math.round(p.x), Math.round(p.y - 1), 6, 3);
    }
  }
  // self-belay connections: thin line from the harness to the rope / base
  const segs = belayableSegments(state);
  for (const a of Object.values(state.attachments)) {
    const f = feet(a.memberId);
    if (!f) continue;
    if (lying(a.memberId)) {
      // short lanyard from the harness of a member lying under the перила up to the rope
      const p = ropePointOf(f);
      g.lineStyle(1, a.method === "grabbing_knot" ? 0xffd23f : 0xe8574a, 1).lineBetween(Math.round(p.x), Math.round(f.y), Math.round(p.x), Math.round(p.y));
      continue;
    }
    const from = { x: f.x, y: f.y - (a.method === "hand" ? HANDS_DY + 2 : HARNESS_DY) };
    let to: Pt | null = null;
    if (a.target.kind === "base") {
      const b = state.bases[a.target.baseId];
      if (b) {
        const p = world.at(b.pos.s);
        to = { x: p.x, y: p.y - 6 };
      }
    } else {
      const t = a.target;
      const seg = segs.find((s) => s.ropeId === t.ropeId && s.lowerNodeId === t.lowerNodeId && s.upperNodeId === t.upperNodeId);
      if (seg && isGapSegment(state, seg)) {
        const c = perilaCurve(state, world, seg);
        to = { x: from.x, y: curveY(c, from.x) };
      } else if (seg) {
        const lo = nodePoint(state, world, seg.lower, feet);
        const hi = nodePoint(state, world, seg.upper, feet);
        // closest point on the segment to the harness
        const dx = hi.x - lo.x;
        const dy = hi.y - lo.y;
        const l2 = dx * dx + dy * dy || 1;
        const t2 = Phaser.Math.Clamp(((from.x - lo.x) * dx + (from.y - lo.y) * dy) / l2, 0, 1);
        to = { x: lo.x + dx * t2, y: lo.y + dy * t2 };
      }
    }
    if (!to) continue;
    const col = a.method === "grabbing_knot" ? 0xffd23f : a.method === "hand" ? 0xe8b48f : 0xe8574a;
    g.lineStyle(1, col, 1).lineBetween(Math.round(from.x), Math.round(from.y), Math.round(to.x), Math.round(to.y));
    if (a.method === "grabbing_knot") g.fillStyle(0xffd23f).fillRect(Math.round(to.x) - 1, Math.round(to.y) - 1, 3, 3);
  }
}
