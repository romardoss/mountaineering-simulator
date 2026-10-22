// Dynamic world objects: bases and dropped items (redrawn per state), ropes and
// self-belay lines (redrawn every frame so they follow animated members, §18.3.3–4).
import Phaser from "phaser";
import { belayableSegments, fixedSegments } from "../../engine/model/selectors";
import type { GameState, RopeNode } from "../../engine/model/types";
import { HANDS_DY, HARNESS_DY, type WorldMap } from "./world";

export interface Pt {
  x: number;
  y: number;
}

/** Where each member is drawn right now (feet position), supplied by the member view. */
export type FeetLookup = (memberId: string) => Pt | null;

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

export function drawRopes(g: Phaser.GameObjects.Graphics, state: GameState, world: WorldMap, feet: FeetLookup) {
  g.clear();
  for (const rope of Object.values(state.ropes)) {
    const color = ropeColor(state, rope.ropeId);
    const fixed = new Set(fixedSegments(state, rope).map((s) => `${s.lowerNodeId}|${s.upperNodeId}`));
    const pts = rope.nodes.map((n) => nodePoint(state, world, n, feet));
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = rope.nodes[i];
      const b = rope.nodes[i + 1];
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
      if (seg) {
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
