// Player actions (§11). Each action: validate (physical preconditions only),
// assess (unsafe-but-possible hints), apply (effects + events), duration.
import { evaluateKnot, knotDef } from "../knots/evaluate";
import { anchorContext, anchorKind, createKnot, removeKnot, supportOf } from "../knots/instance";
import { angleAt, basePointsOf, downhillDir, isAdjacent, isSafeZone } from "../geometry/hill";
import {
  anyCarabiner,
  attachmentsOf,
  baseAt,
  belayableSegments,
  belaysAsBelayer,
  belaysAsClimber,
  carabinerLoad,
  carried,
  elevationOfS,
  findSegment,
  geoOf,
  harnessNodes,
  isLockingCarabiner,
  memberWeightKg,
  pickCarabiner,
  segmentKey,
  wears,
} from "../model/selectors";
import type {
  ActionKind,
  ActionParams,
  Attachment,
  BaseState,
  BelayRelation,
  GameState,
  ItemState,
  KnotChoice,
  KnotContext,
  MemberId,
  Position,
  ResolutionPhase,
  RopeLayout,
  RopeNode,
} from "../model/types";
import type { ReadCtx, StepTx } from "../resolution/tx";
import { constraintReach, dirOf, terrainReach } from "./movement";

export type Validation = { ok: true } | { ok: false; reasonKey: string; params?: Record<string, string | number> };
export interface Hint {
  key: string;
  params?: Record<string, string | number>;
}

const OK: Validation = { ok: true };
const fail = (reasonKey: string, params?: Record<string, string | number>): Validation => ({ ok: false, reasonKey, params });

export interface ActionDef<P extends ActionParams = ActionParams> {
  kind: P["kind"];
  phase: ResolutionPhase;
  validate(ctx: ReadCtx, m: MemberId, p: P): Validation;
  assess(ctx: ReadCtx, m: MemberId, p: P): Hint[];
  apply(tx: StepTx, m: MemberId, p: P): void;
  duration(ctx: ReadCtx, m: MemberId, p: P): number;
}

type ParamsOf<K extends ActionKind> = Extract<ActionParams, { kind: K }>;

// ---------------------------------------------------------------- helpers

const adj = (ctx: ReadCtx, a: Position, b: Position) => isAdjacent(a, b, ctx.data.rules.adjacencyM);
const posOf = (ctx: ReadCtx, m: MemberId) => ctx.state.members[m].pos;

function knotTime(ctx: ReadCtx, k?: KnotChoice): number {
  const extra = k && k.control !== "none" ? (k.control === "double" ? 2 : 1) * ctx.data.actions.perControlKnot : 0;
  return ctx.data.actions.tieKnot + extra;
}

function knotValid(ctx: ReadCtx, k: KnotChoice | undefined): Validation {
  if (!k || !knotDef(ctx.data, k.knotId)) return fail("reason.choose_knot");
  return OK;
}

/** Member is protected right now (attachment with protection, or active belay as climber). */
export function isProtected(state: GameState, m: MemberId): boolean {
  if (attachmentsOf(state, m).some((a) => a.method !== "hand")) return true;
  return belaysAsClimber(state, m).length > 0;
}

function canWeigh(ctx: ReadCtx, m: MemberId, extraKg: number): boolean {
  return memberWeightKg(ctx.state, m).total + extraKg <= ctx.data.rules.weight.maxKg + 1e-9;
}

export function nodeOfMember(rope: RopeLayout, m: MemberId): RopeNode | undefined {
  return rope.nodes.find((n) => n.attach.kind === "member_harness" && n.attach.memberId === m);
}

function freeEndNear(ctx: ReadCtx, rope: RopeLayout, pos: Position): RopeNode | undefined {
  const ends = [rope.nodes[0], rope.nodes[rope.nodes.length - 1]];
  return ends.find((n) => n && n.attach.kind === "free" && adj(ctx, n.pos, pos));
}

function itemsOnStructure(state: GameState, kind: "attachment" | "belay" | "base", id: string): ItemState[] {
  return Object.values(state.items).filter((it) => {
    const l = it.location;
    if (l.kind !== "in_use") return false;
    const st = l.structure;
    return (
      (kind === "attachment" && st.kind === "attachment" && st.attachmentId === id) ||
      (kind === "belay" && st.kind === "belay" && st.belayId === id) ||
      (kind === "base" && st.kind === "base" && st.baseId === id)
    );
  });
}

export function releaseToMember(tx: StepTx, items: ItemState[], m: MemberId) {
  for (const it of items) tx.setLocation(it.id, { kind: "carried", memberId: m });
}

export function removeAttachment(tx: StepTx, a: Attachment, giveTo: MemberId = a.memberId) {
  releaseToMember(tx, itemsOnStructure(tx.state, "attachment", a.id), giveTo);
  if (a.knotId) removeKnot(tx, a.knotId);
  delete tx.state.attachments[a.id];
}

export function removeBelay(tx: StepTx, b: BelayRelation) {
  releaseToMember(tx, itemsOnStructure(tx.state, "belay", b.id), b.belayerId);
  if (b.braking.kind === "knot") removeKnot(tx, b.braking.knotId);
  const rope = tx.state.ropes[b.ropeId];
  const node = rope?.nodes.find((n) => n.attach.kind === "belay" && n.attach.belayId === b.id);
  if (node) node.attach = { kind: "free" };
  delete tx.state.belays[b.id];
}

/** A failed or dismantled base: items stay (on ground) or go to a member. */
export function removeBase(tx: StepTx, base: BaseState, giveTo: MemberId | null) {
  const items = itemsOnStructure(tx.state, "base", base.id);
  if (giveTo) releaseToMember(tx, items, giveTo);
  else for (const it of items) tx.setLocation(it.id, { kind: "on_ground", pos: { ...base.pos } });
  for (const rope of Object.values(tx.state.ropes)) {
    rope.nodes = rope.nodes.filter((n) => !(n.attach.kind === "base" && n.attach.baseId === base.id && n.attach.mode === "running"));
    for (const n of rope.nodes) {
      if (n.attach.kind === "base" && n.attach.baseId === base.id) {
        if (n.attach.mode === "fixed") removeKnot(tx, n.attach.knotId);
        n.attach = { kind: "free" };
      }
    }
  }
  for (const a of Object.values(tx.state.attachments)) if (a.target.kind === "base" && a.target.baseId === base.id) removeAttachment(tx, a);
  for (const b of Object.values(tx.state.belays)) if (b.anchor.kind === "base" && b.anchor.baseId === base.id) b.anchor = { kind: "body" };
  delete tx.state.bases[base.id];
}

/** Rope deployed from a carried coil. */
function deployRope(tx: StepTx, ropeId: string, nodes: RopeNode[]) {
  tx.state.ropes[ropeId] = { ropeId, nodes };
  tx.setLocation(ropeId, { kind: "in_use", structure: { kind: "rope", ropeId } });
}

function newNode(tx: StepTx, pos: Position, attach: RopeNode["attach"]): RopeNode {
  return { id: tx.newId("n"), pos: { ...pos }, attach };
}

function ropeLen(state: GameState, ropeId: string) {
  return state.items[ropeId].props.lengthM ?? 0;
}

/** Position a thrown rope end lands on: downhill from `from` by up to `len`. */
function thrownEnd(ctx: ReadCtx, from: Position, len: number): Position {
  const geo = geoOf(ctx.state, from.obstacleIndex);
  const dir = downhillDir(geo, from.s);
  const s = Math.max(0, Math.min(geo.totalLength, from.s + dir * len));
  return { obstacleIndex: from.obstacleIndex, s: Math.round(s * 100) / 100 };
}

function carriedRope(ctx: ReadCtx, m: MemberId, ropeId: string): ItemState | undefined {
  const it = ctx.state.items[ropeId];
  return it && it.type === "rope" && it.location.kind === "carried" && it.location.memberId === m ? it : undefined;
}

function safePosition(ctx: ReadCtx, m: MemberId): boolean {
  const pos = posOf(ctx, m);
  if (isSafeZone(geoOf(ctx.state, pos.obstacleIndex), pos.s)) return true;
  return attachmentsOf(ctx.state, m).some((a) => a.target.kind === "base");
}

// ---------------------------------------------------------------- skip / command

const skip: ActionDef<ParamsOf<"skip">> = {
  kind: "skip",
  phase: "commands",
  validate: () => OK,
  assess: () => [],
  apply: () => {},
  duration: (ctx) => ctx.data.actions.skip,
};

const command: ActionDef<ParamsOf<"command">> = {
  kind: "command",
  phase: "commands",
  validate: (ctx, _m, p) => {
    if (!ctx.data.commands.some((c) => c.key === p.command)) return fail("reason.unknown_command");
    if (p.recipient !== "all" && !ctx.state.members[p.recipient]) return fail("reason.unknown_member");
    return OK;
  },
  assess: () => [],
  apply: (tx, m, p) => {
    const st = tx.state;
    if (p.misunderstood) {
      tx.emit({ type: "command.misunderstood", severity: "warning", messageKey: "event.command_misunderstood", params: { member: m, command: p.command }, refs: { members: [m] } });
      tx.mistake("summary.command_misunderstood", { member: m, command: p.command });
      return;
    }
    st.protocol.recent.push({ step: st.step, memberId: m, command: p.command, recipient: p.recipient });
    st.stats.commands.issued += 1;
    st.stats.members[m].commands += 1;
    tx.emit({ type: "command.shouted", severity: "info", messageKey: "event.command", params: { member: m, command: p.command, recipient: p.recipient }, refs: { members: [m] } });
    const pr = st.protocol;
    if (p.command === "belay_ready") for (const b of belaysAsBelayer(st, m)) pr.belayReady[b.id] = st.step;
    if (p.command === "go") for (const b of belaysAsClimber(st, m)) pr.climberGo[b.id] = st.step;
    if (p.command === "secured") for (const b of belaysAsClimber(st, m)) pr.climberSecured[b.id] = st.step;
    if (p.command === "fixed_rope_ready") for (const seg of belayableSegments(st)) pr.readySegments[seg.key] = st.step;
  },
  duration: (ctx) => ctx.data.actions.command,
};

// ---------------------------------------------------------------- move (§11.4, §11.5)

export function moveReach(ctx: ReadCtx, m: MemberId, toward: "finish" | "start") {
  const dir = dirOf(toward);
  const terrain = terrainReach(ctx.data, ctx.state, m, dir);
  const c = constraintReach(ctx.data, ctx.state, m, dir);
  return { reach: Math.min(terrain, c.reach), terrain, constraint: c };
}

const move: ActionDef<ParamsOf<"move">> = {
  kind: "move",
  phase: "movement",
  validate: (ctx, m, p) => {
    if (!(p.distanceM > 0)) return fail("reason.distance_zero");
    const r = moveReach(ctx, m, p.toward);
    if (r.reach < 0.05) return fail(r.constraint.reasonKey ?? "reason.cannot_move");
    return OK;
  },
  assess: (ctx, m, p) => {
    const hints: Hint[] = [];
    const geo = geoOf(ctx.state);
    const from = posOf(ctx, m).s;
    const to = from + dirOf(p.toward) * p.distanceM;
    const steep = Math.max(angleAt(geo, from), angleAt(geo, Math.min(Math.max(to, 0), geo.totalLength - 0.01)));
    if (steep >= ctx.data.rules.unprotectedHintDeg && !isProtected(ctx.state, m)) hints.push({ key: "hint.move_unprotected", params: { angle: steep } });
    for (const b of belaysAsClimber(ctx.state, m)) {
      if (b.step >= ctx.state.step) hints.push({ key: "hint.belay_not_effective_yet" });
      if (ctx.state.protocol.belayReady[b.id] === undefined) hints.push({ key: "hint.wait_belay_ready" });
    }
    for (const a of attachmentsOf(ctx.state, m)) {
      if (a.target.kind !== "segment") continue;
      const key = segmentKey(a.target.ropeId, a.target.lowerNodeId, a.target.upperNodeId);
      const n = Object.values(ctx.state.attachments).filter((x) => x.target.kind === "segment" && segmentKey(x.target.ropeId, x.target.lowerNodeId, x.target.upperNodeId) === key);
      if (new Set(n.map((x) => x.memberId)).size > ctx.data.rules.maxMembersPerSegment) hints.push({ key: "hint.crowded_segment" });
    }
    return hints;
  },
  apply: (tx, m, p) => {
    const st = tx.state;
    const mem = st.members[m];
    const r = moveReach(tx, m, p.toward);
    const dist = Math.min(p.distanceM, r.reach);
    if (r.constraint.gardaBlocked && p.distanceM > dist) {
      tx.emit({ type: "knot.garda_blocks_feed", severity: "warning", messageKey: "knot.garda_blocks_feed", params: { member: m }, refs: { members: [m], ruleIds: ["knot.garda_blocks_feed"] } });
      tx.mistake("knot.garda_blocks_feed", { member: m }, "knot:garda");
    }
    if (dist < 0.01) {
      tx.emit({ type: "action.failed", severity: "warning", messageKey: "event.move_blocked", params: { member: m, reason: r.constraint.reasonKey ?? "reason.cannot_move" }, refs: { members: [m] } });
      return;
    }
    const from = mem.pos.s;
    const to = Math.round((from + dirOf(p.toward) * dist) * 100) / 100;
    mem.pos = { ...mem.pos, s: to };
    syncMemberNodes(st, m);
    tx.moved.set(m, { from, to });
    const geo = geoOf(st);
    const dz = elevationOfS(geo, to) - elevationOfS(geo, from);
    if (dz >= 0) st.stats.members[m].distanceUpM += Math.abs(to - from);
    else st.stats.members[m].distanceDownM += Math.abs(to - from);
    tx.emit({ type: "member.moved", severity: "info", messageKey: dz >= 0 ? "event.moved_up" : "event.moved_down", params: { member: m, distance: Math.round(dist * 10) / 10, from, to }, refs: { members: [m] } });
  },
  duration: (ctx, m, p) => {
    const geo = geoOf(ctx.state);
    const from = posOf(ctx, m).s;
    const to = Math.max(0, Math.min(geo.totalLength, from + dirOf(p.toward) * p.distanceM));
    const angle = Math.max(angleAt(geo, from), angleAt(geo, Math.max(0, to - 0.01)));
    const d = ctx.data.actions.move;
    return d.base + Math.max(0, angle - d.aboveDeg) * d.perDegreeAbove;
  },
};

/** Harness and belay nodes follow their member. */
export function syncMemberNodes(state: GameState, m: MemberId) {
  const pos = state.members[m].pos;
  for (const rope of Object.values(state.ropes)) {
    for (const n of rope.nodes) {
      if (n.attach.kind === "member_harness" && n.attach.memberId === m) n.pos = { ...pos };
      if (n.attach.kind === "belay") {
        const b = state.belays[n.attach.belayId];
        if (b && b.belayerId === m) n.pos = { ...pos };
      }
    }
  }
}

// ---------------------------------------------------------------- attach (§11.1)

function attachItems(ctx: ReadCtx, m: MemberId, p: ParamsOf<"attach">): { items: ItemState[]; reason?: string } {
  if (p.method === "hand") return { items: [] };
  if (!wears(ctx.state, m, "harness")) return { items: [], reason: "reason.no_harness" };
  if (p.method === "lanyard_carabiner") {
    const lanyard = carried(ctx.state, m, "lanyard")[0];
    if (!lanyard) return { items: [], reason: "reason.no_lanyard" };
    const used = attachmentsOf(ctx.state, m).filter((a) => a.method === "lanyard_carabiner").length;
    if (used >= (lanyard.props.arms ?? 1)) return { items: [], reason: "reason.lanyard_arms_used" };
    const cb = anyCarabiner(ctx.state, m);
    if (!cb) return { items: [], reason: "reason.no_carabiner" };
    return { items: [cb] };
  }
  const cord = carried(ctx.state, m, "cord")[0];
  if (!cord) return { items: [], reason: "reason.no_cord" };
  const cb = anyCarabiner(ctx.state, m);
  if (!cb) return { items: [], reason: "reason.no_carabiner" };
  return { items: [cord, cb] };
}

function attachTargetPos(ctx: ReadCtx, p: ParamsOf<"attach">): { ok: boolean; near: (pos: Position) => boolean } {
  if (p.target.kind === "base") {
    const b = ctx.state.bases[p.target.baseId];
    return { ok: !!b, near: (pos) => !!b && adj(ctx, pos, b.pos) };
  }
  const t = p.target;
  const seg = findSegment(ctx.state, t.ropeId, t.lowerNodeId, t.upperNodeId);
  if (!seg) return { ok: false, near: () => false };
  const lo = Math.min(seg.lower.pos.s, seg.upper.pos.s) - ctx.data.rules.adjacencyM;
  const hi = Math.max(seg.lower.pos.s, seg.upper.pos.s) + ctx.data.rules.adjacencyM;
  return { ok: true, near: (pos) => pos.s >= lo - 1e-9 && pos.s <= hi + 1e-9 };
}

export function grabEvalInput(ctx: ReadCtx, m: MemberId, p: ParamsOf<"attach">) {
  const { items } = attachItems(ctx, m, p);
  const cord = items.find((i) => i.type === "cord");
  const cb = items.find((i) => i.type === "carabiner");
  const rope = p.target.kind === "segment" ? ctx.state.items[p.target.ropeId] : undefined;
  return {
    ropeDiameterMm: rope?.props.diameterMm,
    cordDiameterMm: cord?.props.diameterMm,
    cordLooped: !!cord?.props.loopKnot,
    lockingCarabiners: cb && isLockingCarabiner(cb) ? 1 : 0,
    carabiners: cb ? 1 : 0,
    support: null,
    loadType: "shock" as const,
  };
}

const attach: ActionDef<ParamsOf<"attach">> = {
  kind: "attach",
  phase: "attach",
  validate: (ctx, m, p) => {
    const t = attachTargetPos(ctx, p);
    if (!t.ok) return fail("reason.target_missing");
    if (!t.near(posOf(ctx, m))) return fail("reason.not_adjacent");
    if (p.target.kind === "base" && p.method === "grabbing_knot") return fail("reason.grab_needs_rope");
    const same = attachmentsOf(ctx.state, m).some((a) => JSON.stringify(a.target) === JSON.stringify(p.target) && a.method === p.method);
    if (same) return fail("reason.already_attached");
    const nonHand = attachmentsOf(ctx.state, m).filter((a) => a.method !== "hand").length;
    const hands = attachmentsOf(ctx.state, m).filter((a) => a.method === "hand").length;
    const arms = Math.max(1, carried(ctx.state, m, "lanyard")[0]?.props.arms ?? 1);
    if (p.method === "hand" && hands >= 1) return fail("reason.hand_busy");
    if (p.method !== "hand" && nonHand >= arms) return fail("reason.max_attachments");
    const it = attachItems(ctx, m, p);
    if (it.reason) return fail(it.reason);
    if (p.method === "grabbing_knot") return knotValid(ctx, p.knot);
    return OK;
  },
  assess: (ctx, m, p) => {
    const hints: Hint[] = [];
    if (p.method === "hand") hints.push({ key: "hint.hand_no_protection" });
    if (p.method === "lanyard_carabiner" && p.target.kind === "segment") hints.push({ key: "hint.carabiner_slides" });
    if (p.target.kind === "segment") {
      const key = segmentKey(p.target.ropeId, p.target.lowerNodeId, p.target.upperNodeId);
      if (ctx.state.protocol.readySegments[key] === undefined) hints.push({ key: "hint.wait_fixed_rope_ready" });
    }
    if (p.method === "grabbing_knot" && p.knot) {
      const e = evaluateKnot(ctx.data, { knotId: p.knot.knotId, context: "SELF_BELAY_GRAB", control: p.knot.control, turns: p.knot.turns, ...grabEvalInput(ctx, m, p) });
      if (e.rating !== "correct" || e.failProbShock > 0) hints.push(...e.messages.map((x) => ({ key: x.key, params: x.params })));
    }
    return hints;
  },
  apply: (tx, m, p) => {
    const st = tx.state;
    const { items } = attachItems(tx, m, p);
    const evalInput = grabEvalInput(tx, m, p);
    const a: Attachment = { id: tx.newId("a"), memberId: m, method: p.method, target: p.target, itemIds: items.map((i) => i.id), knotId: null, step: st.step };
    st.attachments[a.id] = a;
    for (const it of items) tx.setLocation(it.id, { kind: "in_use", structure: { kind: "attachment", attachmentId: a.id } });
    if (p.method === "grabbing_knot" && p.knot) {
      const cord = items.find((i) => i.type === "cord")!;
      const k = createKnot(tx, { knotId: p.knot.knotId, context: "SELF_BELAY_GRAB", control: p.knot.control, turns: p.knot.turns, memberId: m, itemId: cord.id, input: evalInput });
      a.knotId = k.id;
    }
    tx.emit({ type: "member.attached", severity: "info", messageKey: `event.attached.${p.method}`, params: { member: m, target: p.target.kind }, refs: { members: [m], items: a.itemIds } });
    if (p.target.kind === "segment") {
      const key = segmentKey(p.target.ropeId, p.target.lowerNodeId, p.target.upperNodeId);
      if (st.protocol.readySegments[key] === undefined) tx.violation("P3", m);
    }
  },
  duration: (ctx, _m, p) => ctx.data.actions.attach[p.method] + (p.method === "grabbing_knot" && p.knot?.control && p.knot.control !== "none" ? ctx.data.actions.perControlKnot : 0),
};

// ---------------------------------------------------------------- clip rope through an intermediate base

const clip: ActionDef<ParamsOf<"clip">> = {
  kind: "clip",
  phase: "attach",
  validate: (ctx, m, p) => {
    const rope = ctx.state.ropes[p.ropeId];
    const base = ctx.state.bases[p.baseId];
    if (!rope || !base) return fail("reason.target_missing");
    if (!nodeOfMember(rope, m)) return fail("reason.not_tied_in");
    if (!adj(ctx, posOf(ctx, m), base.pos)) return fail("reason.not_adjacent");
    if (!base.carabinerId) return fail("reason.base_no_carabiner");
    if (rope.nodes.some((n) => n.attach.kind === "base" && n.attach.baseId === base.id)) return fail("reason.already_clipped");
    if (carabinerLoad(ctx.state, base.carabinerId) >= ctx.data.rules.maxThingsPerCarabiner) return fail("reason.carabiner_full");
    return OK;
  },
  assess: () => [],
  apply: (tx, m, p) => {
    const rope = tx.state.ropes[p.ropeId];
    const base = tx.state.bases[p.baseId];
    const idx = rope.nodes.findIndex((n) => n.attach.kind === "member_harness" && n.attach.memberId === m);
    const node = newNode(tx, base.pos, { kind: "base", baseId: base.id, mode: "running" });
    if (idx === 0) rope.nodes.splice(1, 0, node);
    else rope.nodes.splice(idx, 0, node);
    tx.emit({ type: "rope.clipped", severity: "info", messageKey: "event.rope_clipped", params: { member: m }, refs: { members: [m], items: [p.ropeId] } });
  },
  duration: (ctx) => ctx.data.actions.clip,
};

// ---------------------------------------------------------------- tie in (§11.2, TIE_IN_END)

function tieInVia(ctx: ReadCtx, m: MemberId, p: ParamsOf<"tie_in">): ItemState | undefined {
  return p.viaCarabiner ? pickCarabiner(ctx.state, m) : undefined;
}

function tieInEvalInput(ctx: ReadCtx, m: MemberId, p: ParamsOf<"tie_in">) {
  const cb = tieInVia(ctx, m, p);
  return { lockingCarabiners: cb ? 1 : 0, carabiners: cb ? 1 : 0, ropeDiameterMm: ctx.state.items[p.ropeId]?.props.diameterMm, support: null, loadType: "shock" as const };
}

const tieIn: ActionDef<ParamsOf<"tie_in">> = {
  kind: "tie_in",
  phase: "build",
  validate: (ctx, m, p) => {
    if (!wears(ctx.state, m, "harness")) return fail("reason.no_harness");
    const rope = ctx.state.ropes[p.ropeId];
    if (rope) {
      if (nodeOfMember(rope, m)) return fail("reason.already_tied_in");
      if (!freeEndNear(ctx, rope, posOf(ctx, m))) return fail("reason.no_free_end_near");
    } else if (!carriedRope(ctx, m, p.ropeId)) return fail("reason.rope_not_carried");
    if (p.viaCarabiner && !tieInVia(ctx, m, p)) return fail("reason.no_locking_carabiner");
    return knotValid(ctx, p.knot);
  },
  assess: (ctx, m, p) => knotHints(ctx, p.knot, "TIE_IN_END", tieInEvalInput(ctx, m, p)),
  apply: (tx, m, p) => {
    const st = tx.state;
    const cb = tieInVia(tx, m, p);
    const k = createKnot(tx, { knotId: p.knot.knotId, context: "TIE_IN_END", control: p.knot.control, turns: p.knot.turns, memberId: m, itemId: p.ropeId, input: tieInEvalInput(tx, m, p) });
    if (cb) tx.setLocation(cb.id, { kind: "in_use", structure: { kind: "knot", knotId: k.id } });
    const harness = { kind: "member_harness" as const, memberId: m, knotId: k.id };
    const rope = st.ropes[p.ropeId];
    if (rope) {
      const end = freeEndNear(tx, rope, posOf(tx, m))!;
      end.attach = harness;
      end.pos = { ...posOf(tx, m) };
    } else {
      deployRope(tx, p.ropeId, [newNode(tx, posOf(tx, m), harness), newNode(tx, posOf(tx, m), { kind: "free" })]);
    }
    tx.emit({ type: "rope.tied_in", severity: "info", messageKey: "event.tied_in", params: { member: m, knot: p.knot.knotId }, refs: { members: [m], items: [p.ropeId], knots: [k.id] } });
  },
  duration: (ctx, _m, p) => knotTime(ctx, p.knot),
};

function knotHints(ctx: ReadCtx, k: KnotChoice | undefined, context: KnotContext, input: Parameters<typeof evaluateKnot>[1] extends infer T ? Omit<T & object, "knotId" | "context" | "control" | "turns"> : never): Hint[] {
  if (!k) return [];
  const e = evaluateKnot(ctx.data, { knotId: k.knotId, context, control: k.control, turns: k.turns, ...(input as object) } as Parameters<typeof evaluateKnot>[1]);
  if (e.rating === "correct" && e.failProbShock === 0 && e.messages.length <= 1) return [];
  return e.messages.map((x) => ({ key: x.key, params: { ...(x.params ?? {}), rating: e.rating } }));
}

// ---------------------------------------------------------------- fix rope to a base

/** Knots that need their own carabiner (Карабінна удавка) take one from the member when the base has none. */
function fixKnotCarabiner(ctx: ReadCtx, m: MemberId, base: BaseState, k?: KnotChoice): ItemState | undefined {
  const def = k ? knotDef(ctx.data, k.knotId) : undefined;
  if (!def?.requires.includes("locking_carabiner") || base.carabinerId) return undefined;
  return pickCarabiner(ctx.state, m);
}

export function fixEvalInput(ctx: ReadCtx, base: BaseState, ropeId: string, m?: MemberId, k?: KnotChoice) {
  const own = m ? fixKnotCarabiner(ctx, m, base, k) : undefined;
  return {
    lockingCarabiners: base.carabinerId || own ? 1 : 0,
    carabiners: base.carabinerId || own ? 1 : 0,
    ropeDiameterMm: ctx.state.items[ropeId]?.props.diameterMm,
    support: supportOf(ctx.state, base.basePointId),
    loadType: "shock" as const,
  };
}

/** Node of an in-use rope that a member at the base can fix: a free end or the member's own tie-in. */
function fixableNode(ctx: ReadCtx, m: MemberId, rope: RopeLayout, base: BaseState): RopeNode | undefined {
  const own = nodeOfMember(rope, m);
  if (own && adj(ctx, own.pos, base.pos)) return own;
  // a free end at the base, or one the member can reach and carry to it
  return freeEndNear(ctx, rope, base.pos) ?? freeEndNear(ctx, rope, posOf(ctx, m));
}

const fixRope: ActionDef<ParamsOf<"fix_rope">> = {
  kind: "fix_rope",
  phase: "build",
  validate: (ctx, m, p) => {
    const base = ctx.state.bases[p.baseId];
    if (!base) return fail("reason.target_missing");
    if (!adj(ctx, posOf(ctx, m), base.pos)) return fail("reason.not_adjacent");
    const rope = ctx.state.ropes[p.ropeId];
    if (rope) {
      if (p.method === "doubled") return fail("reason.double_needs_coil");
      if (!fixableNode(ctx, m, rope, base)) return fail("reason.no_free_end_near");
      if (rope.nodes.some((n) => n.attach.kind === "belay")) {
        const own = nodeOfMember(rope, m);
        if (own && belaysAsClimber(ctx.state, m).some((b) => b.ropeId === rope.ropeId)) return fail("reason.still_on_belay");
      }
    } else if (!carriedRope(ctx, m, p.ropeId)) return fail("reason.rope_not_carried");
    if (base.carabinerId && carabinerLoad(ctx.state, base.carabinerId) >= ctx.data.rules.maxThingsPerCarabiner) return fail("reason.carabiner_full");
    if (p.method === "knot") return knotValid(ctx, p.knot);
    return OK;
  },
  assess: (ctx, _m, p) => {
    const base = ctx.state.bases[p.baseId];
    if (!base || p.method !== "knot") return [];
    return knotHints(ctx, p.knot, anchorContext(ctx.state, base), fixEvalInput(ctx, base, p.ropeId, _m, p.knot));
  },
  apply: (tx, m, p) => {
    const st = tx.state;
    const base = st.bases[p.baseId];
    const rope = st.ropes[p.ropeId];
    const len = ropeLen(st, p.ropeId);
    if (p.method === "doubled") {
      const half = len / 2 - 0.01;
      const end = thrownEnd(tx, base.pos, half);
      deployRope(tx, p.ropeId, [newNode(tx, end, { kind: "free" }), newNode(tx, base.pos, { kind: "base", baseId: base.id, mode: "doubled" }), newNode(tx, end, { kind: "free" })]);
      tx.emit({ type: "rope.fixed", severity: "info", messageKey: "event.rope_doubled", params: { member: m }, refs: { members: [m], items: [p.ropeId] } });
      return;
    }
    const ownCb = fixKnotCarabiner(tx, m, base, p.knot);
    const k = createKnot(tx, { knotId: p.knot!.knotId, context: anchorContext(st, base), control: p.knot!.control, turns: p.knot!.turns, memberId: m, itemId: p.ropeId, input: fixEvalInput(tx, base, p.ropeId, m, p.knot) });
    if (ownCb) tx.setLocation(ownCb.id, { kind: "in_use", structure: { kind: "knot", knotId: k.id } });
    const fixed = { kind: "base" as const, baseId: base.id, mode: "fixed" as const, knotId: k.id };
    if (rope) {
      const node = fixableNode(tx, m, rope, base)!;
      if (node.attach.kind === "member_harness") {
        // The member unties from the end as part of fixing it (DECISIONS: fix-from-harness).
        const oldKnot = node.attach.knotId;
        const via = Object.values(st.items).find((it) => it.location.kind === "in_use" && it.location.structure.kind === "knot" && it.location.structure.knotId === oldKnot);
        if (via) tx.setLocation(via.id, { kind: "carried", memberId: m });
        removeKnot(tx, oldKnot);
      }
      node.attach = fixed;
      node.pos = { ...base.pos };
    } else {
      const allowance = tx.data.rules.knotRopeAllowanceM * 1;
      deployRope(tx, p.ropeId, [newNode(tx, base.pos, fixed), newNode(tx, thrownEnd(tx, base.pos, Math.max(0, len - allowance - 0.01)), { kind: "free" })]);
    }
    tx.emit({ type: "rope.fixed", severity: "info", messageKey: "event.rope_fixed", params: { member: m, knot: p.knot!.knotId }, refs: { members: [m], items: [p.ropeId], knots: [k.id] } });
  },
  duration: (ctx, _m, p) => (p.method === "doubled" ? ctx.data.actions.fixDoubled : knotTime(ctx, p.knot)),
};

// ---------------------------------------------------------------- make base (§11.6)

function baseItems(ctx: ReadCtx, m: MemberId, p: ParamsOf<"make_base">): { items: ItemState[]; reason?: string } {
  if (p.construction === "direct") return { items: [] };
  const cb = pickCarabiner(ctx.state, m);
  if (!cb) return { items: [], reason: "reason.no_locking_carabiner" };
  if (p.construction === "bolt") return { items: [cb] };
  const sling = carried(ctx.state, m, "sling")[0];
  if (!sling) return { items: [], reason: "reason.no_sling" };
  return { items: [sling, cb] };
}

const makeBase: ActionDef<ParamsOf<"make_base">> = {
  kind: "make_base",
  phase: "build",
  validate: (ctx, m, p) => {
    const hill = geoOf(ctx.state).obstacle;
    const bp = basePointsOf(hill).find((b) => b.id === p.basePointId);
    if (!bp) return fail("reason.target_missing");
    if (!adj(ctx, posOf(ctx, m), { obstacleIndex: 0, s: bp.s })) return fail("reason.not_adjacent");
    if (baseAt(ctx.state, bp.id)) return fail("reason.base_exists");
    if (p.construction === "bolt" && bp.anchorType !== "bolt") return fail("reason.no_bolt");
    if (p.construction !== "bolt" && bp.anchorType === "bolt") return fail("reason.bolt_needs_carabiner");
    const it = baseItems(ctx, m, p);
    return it.reason ? fail(it.reason) : OK;
  },
  assess: (ctx, _m, p) => {
    const kind = anchorKind(ctx.state, p.basePointId);
    return kind === "tree_small" ? [{ key: "hint.small_tree_anchor" }] : [];
  },
  apply: (tx, m, p) => {
    const st = tx.state;
    const bp = basePointsOf(geoOf(st).obstacle).find((b) => b.id === p.basePointId)!;
    const { items } = baseItems(tx, m, p);
    const base: BaseState = {
      id: tx.newId("b"),
      basePointId: bp.id,
      pos: { obstacleIndex: 0, s: bp.s },
      construction: p.construction,
      itemIds: items.map((i) => i.id),
      carabinerId: items.find((i) => i.type === "carabiner")?.id ?? null,
      builtBy: m,
      step: st.step,
    };
    st.bases[base.id] = base;
    for (const it of items) tx.setLocation(it.id, { kind: "in_use", structure: { kind: "base", baseId: base.id } });
    tx.emit({ type: "base.built", severity: "info", messageKey: `event.base_built.${p.construction}`, params: { member: m, basePoint: bp.id }, refs: { members: [m], items: base.itemIds } });
  },
  duration: (ctx) => ctx.data.actions.makeBase,
};

// ---------------------------------------------------------------- belay (§11.3)

function belayRopeFor(ctx: ReadCtx, m: MemberId, climberId: MemberId): { rope: RopeLayout; node: RopeNode } | undefined {
  for (const { rope } of harnessNodes(ctx.state, climberId)) {
    const node = rope.nodes.find((n) => n.attach.kind === "free" && adj(ctx, n.pos, posOf(ctx, m)));
    if (node) return { rope, node };
  }
  return undefined;
}

export function belayMode(ctx: ReadCtx, belayer: MemberId, climber: MemberId): "lower" | "upper" {
  const geo = geoOf(ctx.state);
  return elevationOfS(geo, posOf(ctx, belayer).s) <= elevationOfS(geo, posOf(ctx, climber).s) ? "lower" : "upper";
}

function brakingItems(ctx: ReadCtx, m: MemberId, p: ParamsOf<"belay">): { items: ItemState[]; reason?: string } {
  if (p.braking === "device") {
    const dev = carried(ctx.state, m, "belay_device")[0];
    const cb = pickCarabiner(ctx.state, m);
    if (!dev) return { items: [], reason: "reason.no_belay_device" };
    if (!cb) return { items: [], reason: "reason.no_locking_carabiner" };
    return { items: [dev, cb] };
  }
  const def = p.knot ? knotDef(ctx.data, p.knot.knotId) : undefined;
  const cb1 = pickCarabiner(ctx.state, m) ?? anyCarabiner(ctx.state, m);
  if (!cb1) return { items: [], reason: "reason.no_carabiner" };
  if (def?.requires.includes("two_carabiners")) {
    const cb2 = anyCarabiner(ctx.state, m, [cb1.id]);
    return { items: cb2 ? [cb1, cb2] : [cb1] };
  }
  return { items: [cb1] };
}

export function belayEvalInput(ctx: ReadCtx, m: MemberId, p: ParamsOf<"belay">) {
  const { items } = brakingItems(ctx, m, p);
  const cbs = items.filter((i) => i.type === "carabiner");
  const rope = belayRopeFor(ctx, m, p.climberId)?.rope;
  return {
    lockingCarabiners: cbs.filter((c) => isLockingCarabiner(c) && c.props.shape === "hms").length || (cbs.some(isLockingCarabiner) ? 1 : 0),
    carabiners: cbs.length,
    ropeDiameterMm: rope ? ctx.state.items[rope.ropeId].props.diameterMm : undefined,
    support: null,
    loadType: "shock" as const,
  };
}

/** Base for «від бази» (CR-47): the one the belayer is clipped to, else the nearest adjacent built base. */
function belayBase(ctx: ReadCtx, m: MemberId): BaseState | undefined {
  const att = attachmentsOf(ctx.state, m).find((a) => a.target.kind === "base");
  if (att && att.target.kind === "base") return ctx.state.bases[att.target.baseId];
  const here = posOf(ctx, m);
  return Object.values(ctx.state.bases)
    .filter((b) => adj(ctx, b.pos, here))
    .sort((a, b) => Math.abs(a.pos.s - here.s) - Math.abs(b.pos.s - here.s))[0];
}

const belay: ActionDef<ParamsOf<"belay">> = {
  kind: "belay",
  phase: "belay",
  validate: (ctx, m, p) => {
    if (p.climberId === m) return fail("reason.belay_self");
    if (!ctx.state.members[p.climberId]) return fail("reason.unknown_member");
    if (harnessNodes(ctx.state, p.climberId).length === 0) return fail("reason.climber_not_tied_in");
    if (!belayRopeFor(ctx, m, p.climberId)) return fail("reason.no_rope_end_near");
    if (belaysAsClimber(ctx.state, p.climberId).some((b) => b.belayerId === m)) return fail("reason.already_belaying");
    // «від бази»: a built base next to the belayer (own self-belay not required, CR-47)
    if (p.anchor === "base" && !belayBase(ctx, m)) return fail("reason.no_base_near");
    const it = brakingItems(ctx, m, p);
    if (it.reason) return fail(it.reason);
    if (p.braking === "knot") return knotValid(ctx, p.knot);
    return OK;
  },
  assess: (ctx, m, p) => {
    const hints: Hint[] = [];
    const ctxId: KnotContext = belayMode(ctx, m, p.climberId) === "lower" ? "BELAY_LOWER" : "BELAY_UPPER";
    if (p.braking === "knot") hints.push(...knotHints(ctx, p.knot, ctxId, belayEvalInput(ctx, m, p)));
    if (p.braking === "knot" && p.knot?.knotId === "garda" && ctxId === "BELAY_LOWER") hints.push({ key: "knot.garda_blocks_feed" });
    if (p.anchor === "body" && angleAt(geoOf(ctx.state), posOf(ctx, m).s) >= ctx.data.hazards.injury.belayerPulledMinDeg) hints.push({ key: "hint.body_belay_steep" });
    if (!attachmentsOf(ctx.state, m).some((a) => a.target.kind === "base" && a.method !== "hand")) hints.push({ key: "hint.belayer_unsecured" });
    hints.push({ key: "hint.belay_next_step" });
    return hints;
  },
  apply: (tx, m, p) => {
    const st = tx.state;
    const found = belayRopeFor(tx, m, p.climberId)!;
    const mode = belayMode(tx, m, p.climberId);
    const { items } = brakingItems(tx, m, p);
    const id = tx.newId("y");
    let braking: BelayRelation["braking"];
    if (p.braking === "device") braking = { kind: "device", itemId: items[0].id, carabinerIds: items.slice(1).map((i) => i.id) };
    else {
      const k = createKnot(tx, { knotId: p.knot!.knotId, context: mode === "lower" ? "BELAY_LOWER" : "BELAY_UPPER", control: p.knot!.control, turns: p.knot!.turns, memberId: m, itemId: found.rope.ropeId, input: belayEvalInput(tx, m, p) });
      braking = { kind: "knot", knotId: k.id, carabinerIds: items.map((i) => i.id) };
    }
    const anchorBase = belayBase(tx, m);
    const rel: BelayRelation = {
      id,
      belayerId: m,
      climberId: p.climberId,
      ropeId: found.rope.ropeId,
      mode,
      braking,
      anchor: p.anchor === "base" && anchorBase ? { kind: "base", baseId: anchorBase.id } : { kind: "body" },
      step: st.step,
      distanceAtSetM: Math.abs(posOf(tx, m).s - posOf(tx, p.climberId).s),
      inactiveThisStep: false,
    };
    st.belays[id] = rel;
    for (const it of items) tx.setLocation(it.id, { kind: "in_use", structure: { kind: "belay", belayId: id } });
    found.node.attach = { kind: "belay", belayId: id };
    found.node.pos = { ...posOf(tx, m) };
    tx.emit({ type: "belay.set", severity: "info", messageKey: `event.belay_set.${mode}`, params: { member: m, climber: p.climberId }, refs: { members: [m, p.climberId], items: items.map((i) => i.id) } });
  },
  duration: (ctx) => ctx.data.actions.belay,
};

const stopBelay: ActionDef<ParamsOf<"stop_belay">> = {
  kind: "stop_belay",
  phase: "belay",
  validate: (ctx, m, p) => {
    const b = ctx.state.belays[p.belayId];
    if (!b || b.belayerId !== m) return fail("reason.target_missing");
    return OK;
  },
  assess: (ctx, _m, p) => {
    const b = ctx.state.belays[p.belayId];
    return b && ctx.state.protocol.climberSecured[b.id] === undefined ? [{ key: "hint.wait_secured" }] : [];
  },
  apply: (tx, m, p) => {
    const b = tx.state.belays[p.belayId];
    if (tx.state.protocol.climberSecured[b.id] === undefined) tx.violation("P6", m, { climber: b.climberId });
    removeBelay(tx, b);
    tx.emit({ type: "belay.stopped", severity: "info", messageKey: "event.belay_stopped", params: { member: m, climber: b.climberId }, refs: { members: [m, b.climberId] } });
  },
  duration: (ctx) => ctx.data.actions.stopBelay,
};

// ---------------------------------------------------------------- detach / untie / retrieve (§11.8.1)

function ropeBusy(state: GameState, ropeId: string, except?: MemberId): boolean {
  const rope = state.ropes[ropeId];
  if (!rope) return false;
  if (rope.nodes.some((n) => n.attach.kind === "member_harness" && n.attach.memberId !== except)) return true;
  if (rope.nodes.some((n) => n.attach.kind === "belay")) return true;
  return Object.values(state.attachments).some((a) => a.target.kind === "segment" && a.target.ropeId === ropeId);
}

/** Pull-down (§7.1.9): the member stands below the anchor, on the line of a hanging strand. */
function alongRopeBelow(ctx: ReadCtx, rope: RopeLayout, anchor: RopeNode, here: Position): boolean {
  const geo = geoOf(ctx.state);
  if (elevationOfS(geo, here.s) >= elevationOfS(geo, anchor.pos.s) - 1e-6) return false;
  const ss = rope.nodes.map((n) => n.pos.s);
  const a = ctx.data.rules.adjacencyM;
  return here.s >= Math.min(...ss) - a && here.s <= Math.max(...ss) + a;
}

function releasableAnchor(ctx: ReadCtx, rope: RopeLayout): RopeNode | undefined {
  return rope.nodes.find((n) => {
    if (n.attach.kind !== "base") return false;
    if (n.attach.mode === "doubled") return true;
    if (n.attach.mode === "fixed") {
      const k = ctx.state.knots[n.attach.knotId];
      return !!k && knotDef(ctx.data, k.knotId)?.releasable === true;
    }
    return false;
  });
}

/** Step being planned (state.step + 1) or resolved (resolveStep has already counted it). */
function currentStep(ctx: ReadCtx): number {
  return "phase" in ctx ? ctx.state.step : ctx.state.step + 1;
}

/** CR-22: self-secured (non-hand attachment) and shouted `secured` in an earlier step. */
function mayLeaveBelay(ctx: ReadCtx, m: MemberId, belays: BelayRelation[]): boolean {
  if (!attachmentsOf(ctx.state, m).some((a) => a.method !== "hand")) return false;
  return belays.every((b) => {
    const at = ctx.state.protocol.climberSecured[b.id];
    return at !== undefined && at < currentStep(ctx);
  });
}

const detach: ActionDef<ParamsOf<"detach">> = {
  kind: "detach",
  phase: "detach",
  validate: (ctx, m, p) => {
    const st = ctx.state;
    const w = p.what;
    const here = posOf(ctx, m);
    switch (w.kind) {
      case "attachment": {
        const a = st.attachments[w.attachmentId];
        return a && a.memberId === m ? OK : fail("reason.target_missing");
      }
      case "untie": {
        const rope = st.ropes[w.ropeId];
        const n = rope?.nodes.find((x) => x.id === w.nodeId);
        if (!n) return fail("reason.target_missing");
        if (!adj(ctx, n.pos, here)) return fail("reason.not_adjacent");
        if (n.attach.kind === "member_harness") {
          if (n.attach.memberId !== m) return fail("reason.cannot_untie_other");
          const onBelay = belaysAsClimber(st, m).filter((b) => b.ropeId === w.ropeId);
          if (onBelay.length && !mayLeaveBelay(ctx, m, onBelay)) return fail("reason.still_on_belay");
          return OK;
        }
        if (n.attach.kind === "base" && n.attach.mode === "fixed") return OK;
        if (n.attach.kind === "base" && n.attach.mode === "doubled") return ropeBusy(st, w.ropeId) ? fail("reason.rope_in_use") : OK;
        return fail("reason.nothing_to_untie");
      }
      case "unclip": {
        const rope = st.ropes[w.ropeId];
        const n = rope?.nodes.find((x) => x.id === w.nodeId);
        if (!n || n.attach.kind !== "base" || n.attach.mode !== "running") return fail("reason.target_missing");
        return adj(ctx, n.pos, here) ? OK : fail("reason.not_adjacent");
      }
      case "dismantle_base": {
        const b = st.bases[w.baseId];
        if (!b) return fail("reason.target_missing");
        if (!adj(ctx, b.pos, here)) return fail("reason.not_adjacent");
        const used =
          Object.values(st.ropes).some((r) => r.nodes.some((n) => n.attach.kind === "base" && n.attach.baseId === b.id)) ||
          Object.values(st.attachments).some((a) => a.target.kind === "base" && a.target.baseId === b.id) ||
          Object.values(st.belays).some((y) => y.anchor.kind === "base" && y.anchor.baseId === b.id);
        if (used) return fail("reason.base_in_use");
        const kg = itemsOnStructure(st, "base", b.id).reduce((s, i) => s + i.weightKg, 0);
        return canWeigh(ctx, m, kg) ? OK : fail("reason.too_heavy");
      }
      case "coil": {
        const rope = st.ropes[w.ropeId];
        if (!rope) return fail("reason.target_missing");
        if (rope.nodes.some((n) => !adj(ctx, n.pos, here))) return fail("reason.rope_spread_out");
        if (rope.nodes.some((n) => n.attach.kind !== "free")) return fail("reason.rope_still_tied");
        if (ropeBusy(st, w.ropeId)) return fail("reason.rope_in_use");
        return canWeigh(ctx, m, st.items[w.ropeId].weightKg) ? OK : fail("reason.too_heavy");
      }
      case "pull_down": {
        const rope = st.ropes[w.ropeId];
        if (!rope) return fail("reason.target_missing");
        const anchor = releasableAnchor(ctx, rope);
        if (!anchor) return fail("reason.not_releasable");
        if (!alongRopeBelow(ctx, rope, anchor, here)) return fail("reason.not_below_rope");
        if (ropeBusy(st, w.ropeId)) return fail("reason.rope_in_use");
        if (rope.nodes.some((n) => n.attach.kind === "base" && n.attach.mode === "running")) return fail("reason.rope_clipped");
        return canWeigh(ctx, m, st.items[w.ropeId].weightKg) ? OK : fail("reason.too_heavy");
      }
    }
  },
  assess: (ctx, m, p) => {
    const geo = geoOf(ctx.state);
    if (p.what.kind !== "attachment") return [];
    const others = attachmentsOf(ctx.state, m).filter((a) => a.id !== (p.what as { attachmentId: string }).attachmentId && a.method !== "hand");
    const onBelay = belaysAsClimber(ctx.state, m).length > 0;
    if (others.length === 0 && !onBelay && angleAt(geo, posOf(ctx, m).s) >= ctx.data.rules.unsafeDetachDeg) return [{ key: "hint.detach_last_protection" }];
    return [];
  },
  apply: (tx, m, p) => {
    const st = tx.state;
    const w = p.what;
    const ev = (key: string, params: Record<string, string | number> = {}) =>
      tx.emit({ type: "member.detached", severity: "info", messageKey: key, params: { member: m, ...params }, refs: { members: [m] } });
    switch (w.kind) {
      case "attachment": {
        removeAttachment(tx, st.attachments[w.attachmentId]);
        ev("event.detached");
        return;
      }
      case "untie": {
        const rope = st.ropes[w.ropeId];
        const n = rope.nodes.find((x) => x.id === w.nodeId)!;
        if (n.attach.kind === "member_harness") {
          // after «Сам!» the climber leaves the belay themselves (CR-22)
          for (const b of belaysAsClimber(st, m).filter((x) => x.ropeId === w.ropeId)) {
            removeBelay(tx, b);
            tx.emit({ type: "belay.stopped", severity: "info", messageKey: "event.belay_ended_by_climber", params: { member: m, belayer: b.belayerId }, refs: { members: [m, b.belayerId] } });
          }
        }
        if (n.attach.kind === "member_harness" || (n.attach.kind === "base" && n.attach.mode === "fixed")) {
          const knotId = n.attach.knotId;
          const via = Object.values(st.items).filter((it) => it.location.kind === "in_use" && it.location.structure.kind === "knot" && it.location.structure.knotId === knotId);
          releaseToMember(tx, via, m);
          removeKnot(tx, knotId);
        }
        n.attach = { kind: "free" };
        ev("event.untied");
        return;
      }
      case "unclip": {
        const rope = st.ropes[w.ropeId];
        rope.nodes = rope.nodes.filter((x) => x.id !== w.nodeId);
        ev("event.unclipped");
        return;
      }
      case "dismantle_base": {
        removeBase(tx, st.bases[w.baseId], m);
        ev("event.base_dismantled");
        return;
      }
      case "coil": {
        delete st.ropes[w.ropeId];
        tx.setLocation(w.ropeId, { kind: "carried", memberId: m });
        ev("event.rope_coiled");
        return;
      }
      case "pull_down": {
        const rope = st.ropes[w.ropeId];
        const anchor = releasableAnchor(tx, rope)!;
        if (anchor.attach.kind === "base" && anchor.attach.mode === "fixed") {
          const knotId = anchor.attach.knotId;
          const via = Object.values(st.items).filter((it) => it.location.kind === "in_use" && it.location.structure.kind === "knot" && it.location.structure.knotId === knotId);
          releaseToMember(tx, via, m);
          removeKnot(tx, knotId);
        }
        delete st.ropes[w.ropeId];
        tx.setLocation(w.ropeId, { kind: "carried", memberId: m });
        ev("event.rope_pulled_down");
        return;
      }
    }
  },
  duration: (ctx, _m, p) => {
    const d = ctx.data.actions.detach;
    const w = p.what;
    if (w.kind === "untie") {
      const rope = ctx.state.ropes[w.ropeId];
      const n = rope?.nodes.find((x) => x.id === w.nodeId);
      if (n && n.attach.kind === "base" && n.attach.mode === "fixed") {
        const k = ctx.state.knots[n.attach.knotId];
        const def = k && knotDef(ctx.data, k.knotId);
        if (k && def?.untieExtraThin && k.context === "ANCHOR_THIN") return d.untie + d.untieExtraThinHitch;
      }
      return d.untie;
    }
    return d[w.kind];
  },
};

// ---------------------------------------------------------------- items: pass, pick up, wear (no take-off CR-8, no drop CR-24)

const pass: ActionDef<ParamsOf<"pass">> = {
  kind: "pass",
  phase: "detach",
  validate: (ctx, m, p) => {
    const to = ctx.state.members[p.toMemberId];
    if (!to || p.toMemberId === m) return fail("reason.unknown_member");
    if (to.status === "injured") return fail("reason.member_injured");
    if (!adj(ctx, posOf(ctx, m), to.pos)) return fail("reason.not_adjacent");
    if (p.itemIds.length === 0) return fail("reason.choose_items");
    if (p.itemIds.length > ctx.data.actions.maxPassItems) return fail("reason.too_many_items");
    let kg = 0;
    for (const id of p.itemIds) {
      const it = ctx.state.items[id];
      if (!it || it.location.kind !== "carried" || it.location.memberId !== m) return fail("reason.item_not_carried");
      kg += it.weightKg;
    }
    return canWeigh(ctx, p.toMemberId, kg) ? OK : fail("reason.receiver_too_heavy");
  },
  assess: () => [],
  apply: (tx, m, p) => {
    for (const id of p.itemIds) tx.setLocation(id, { kind: "carried", memberId: p.toMemberId });
    tx.emit({ type: "item.passed", severity: "info", messageKey: "event.items_passed", params: { member: m, to: p.toMemberId, count: p.itemIds.length }, refs: { members: [m, p.toMemberId], items: p.itemIds } });
  },
  duration: (ctx, _m, p) => ctx.data.actions.passPerItem * Math.max(1, p.itemIds.length),
};

const pickup: ActionDef<ParamsOf<"pickup">> = {
  kind: "pickup",
  phase: "detach",
  validate: (ctx, m, p) => {
    if (p.itemIds.length === 0) return fail("reason.choose_items");
    let kg = 0;
    for (const id of p.itemIds) {
      const it = ctx.state.items[id];
      if (!it || it.location.kind !== "on_ground") return fail("reason.item_not_on_ground");
      if (!adj(ctx, it.location.pos, posOf(ctx, m))) return fail("reason.not_adjacent");
      kg += it.weightKg;
    }
    return canWeigh(ctx, m, kg) ? OK : fail("reason.too_heavy");
  },
  assess: () => [],
  apply: (tx, m, p) => {
    for (const id of p.itemIds) tx.setLocation(id, { kind: "carried", memberId: m });
    tx.emit({ type: "item.picked", severity: "info", messageKey: "event.items_picked", params: { member: m, count: p.itemIds.length }, refs: { members: [m], items: p.itemIds } });
  },
  duration: (ctx, _m, p) => ctx.data.actions.pickupPerItem * p.itemIds.length,
};

const WEARABLE = new Set(["harness", "helmet", "gloves", "crampons"]);

const wear: ActionDef<ParamsOf<"wear">> = {
  kind: "wear",
  phase: "detach",
  validate: (ctx, m, p) => {
    const it = ctx.state.items[p.itemId];
    if (!it || it.location.kind !== "carried" || it.location.memberId !== m) return fail("reason.item_not_carried");
    if (!WEARABLE.has(it.type)) return fail("reason.not_wearable");
    if (wears(ctx.state, m, it.type)) return fail("reason.already_wearing");
    return safePosition(ctx, m) ? OK : fail("reason.not_safe_position");
  },
  assess: () => [],
  apply: (tx, m, p) => {
    tx.setLocation(p.itemId, { kind: "worn", memberId: m });
    tx.emit({ type: "item.worn", severity: "info", messageKey: "event.item_worn", params: { member: m, item: tx.state.items[p.itemId].type }, refs: { members: [m], items: [p.itemId] } });
  },
  duration: (ctx) => ctx.data.actions.wear,
};

export const ACTIONS: Record<ActionKind, ActionDef<any>> = {
  skip,
  command,
  move,
  attach,
  clip,
  tie_in: tieIn,
  fix_rope: fixRope,
  make_base: makeBase,
  belay,
  stop_belay: stopBelay,
  detach,
  pass,
  pickup,
  wear,
};

export const PHASE_ORDER: ResolutionPhase[] = ["commands", "detach", "build", "attach", "belay", "movement"];

export function validateAction(ctx: ReadCtx, m: MemberId, p: ActionParams): Validation {
  const mem = ctx.state.members[m];
  if (!mem) return fail("reason.unknown_member");
  if (mem.status === "injured") return fail("reason.member_injured");
  if (ctx.state.outcome !== "in_progress") return fail("reason.game_over");
  const def = ACTIONS[p.kind];
  if (!def) return fail("reason.unknown_action");
  return def.validate(ctx, m, p);
}

