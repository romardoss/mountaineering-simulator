// Falls (§14.1–§14.3): fall chance, protection chains, unprotected slides.
import { knotDef } from "../knots/evaluate";
import { anchorKind } from "../knots/instance";
import { angleAt, downhillDir, segmentAt, steepestBetween } from "../geometry/hill";
import {
  attachmentsOf,
  belaysAsClimber,
  effectiveSurface,
  isRockSurface,
  elevationOfS,
  findSegment,
  geoOf,
  harnessNodes,
  heldNodes,
  memberWeightKg,
  membersOnSegment,
  ropeUsedM,
  segmentKey,
  surfaceAt,
  traverseAttachment,
  weightBand,
  wears,
} from "../model/selectors";
import type { Attachment, BaseState, BelayRelation, MemberId, Surface } from "../model/types";
import type { StepTx } from "../resolution/tx";
import { removeAttachment, removeBase, removeBelay, syncMemberNodes } from "../actions/defs";
import { usesGrabbingKnot } from "../actions/movement";
import { removeKnot } from "../knots/instance";

export interface FallFactor {
  key: string;
  value: number;
}

/** pFall = baseByAngle × surface × Π mistakes × method, capped (§14.1.1). */
export function fallChance(tx: StepTx, m: MemberId, from: number, to: number): { p: number; factors: FallFactor[]; angle: number } {
  const { data, state } = tx;
  const geo = geoOf(state);
  const angle = steepestBetween(geo, from, to);
  const fh = data.hazards.fall;
  const base = fh.baseByAngle.find((b) => angle <= b.maxDeg + 1e-9)?.p ?? 0;
  const factors: FallFactor[] = [{ key: "factor.angle", value: base }];
  if (base === 0) return { p: 0, factors, angle };
  // surface of the steepest crossed segment
  let surf: Surface | null = null;
  for (const g of geo.segments) if (g.s1 > Math.min(from, to) && g.s0 <= Math.max(from, to) && g.angleDeg === angle) surf = effectiveSurface(state, data, g.surface);
  const sf = surf ? fh.surface[surf] : 1;
  factors.push({ key: `factor.surface.${surf ?? "flat"}`, value: sf });
  let p = base * sf;
  const mk = fh.mistakes;
  const winterSurface = surf === "snow" || surf === "icy_rock" || surf === "snow_scree";
  if (winterSurface && angle >= mk.winterNoCrampons.minDeg && !wears(state, m, "crampons")) {
    p *= mk.winterNoCrampons.factor;
    factors.push({ key: "factor.no_crampons", value: mk.winterNoCrampons.factor });
  }
  const band = weightBand(data, memberWeightKg(state, m).total);
  if (band === "over" || band === "max") {
    p *= mk.overloaded;
    factors.push({ key: "factor.overloaded", value: mk.overloaded });
  }
  if (tx.uncoordinated.has(m)) {
    p *= mk.uncoordinated;
    factors.push({ key: "factor.uncoordinated", value: mk.uncoordinated });
  }
  for (const a of attachmentsOf(state, m)) {
    if (a.target.kind !== "segment") continue;
    const key = segmentKey(a.target.ropeId, a.target.lowerNodeId, a.target.upperNodeId);
    if (membersOnSegment(state, key).length > data.rules.maxMembersPerSegment) {
      p *= mk.crowdedSegment;
      factors.push({ key: "factor.crowded", value: mk.crowdedSegment });
      break;
    }
  }
  if (tx.unwarnedRockThreat.has(m)) {
    p *= mk.unwarnedRock;
    factors.push({ key: "factor.unwarned_rock", value: mk.unwarnedRock });
  }
  if (attachmentsOf(state, m).some((a) => a.method === "hand")) {
    p *= fh.method.hand;
    factors.push({ key: "factor.hand", value: fh.method.hand });
  }
  return { p: Math.min(fh.pFallMax, Math.round(p * 1e6) / 1e6), factors, angle };
}

// ---------------------------------------------------------------- protection chains

interface ChainElement {
  key: string;
  labelKey: string;
  p: number;
  knotId?: string;
  onFail: () => void;
}

function rollChain(tx: StepTx, elems: ChainElement[]): ChainElement | null {
  for (const e of elems) {
    if (e.knotId) tx.loadedKnots.add(e.knotId);
    const r = tx.roll(e.key, e.p);
    if (r.hit) {
      tx.emit({ type: "chain.failed", severity: "danger", messageKey: "event.chain_failed", params: { element: e.labelKey, p: pct(e.p) }, refs: { rolls: [r], knots: e.knotId ? [e.knotId] : [] } });
      e.onFail();
      return e;
    }
  }
  return null;
}

function pct(p: number): number {
  return Math.round(p * 1000) / 10;
}

function knotShock(tx: StepTx, knotId: string): number {
  return tx.state.knots[knotId]?.evaluation.failProbShock ?? 0;
}

function baseAnchorElement(tx: StepTx, base: BaseState, prefix: string): ChainElement {
  const kind = anchorKind(tx.state, base.basePointId);
  return {
    key: `${prefix}:base:${base.id}`,
    labelKey: `anchor.${kind}`,
    p: tx.data.hazards.anchors[kind].shock,
    onFail: () => {
      tx.emit({ type: "base.failed", severity: "danger", messageKey: "event.base_failed", params: { anchor: kind }, refs: {} });
      removeBase(tx, base, null);
    },
  };
}

function fixedNodeElements(tx: StepTx, ropeId: string, nodeIds: string[], prefix: string): ChainElement[] {
  const out: ChainElement[] = [];
  const rope = tx.state.ropes[ropeId];
  for (const id of nodeIds) {
    const n = rope?.nodes.find((x) => x.id === id);
    if (!n || n.attach.kind !== "base") continue;
    if (n.attach.mode === "fixed") {
      const knotId = n.attach.knotId;
      out.push({
        key: `${prefix}:knot:${knotId}:shock`,
        labelKey: "chain.anchor_knot",
        p: knotShock(tx, knotId),
        knotId,
        onFail: () => {
          removeKnot(tx, knotId);
          n.attach = { kind: "free" };
        },
      });
    }
    const base = tx.state.bases[n.attach.kind === "base" ? n.attach.baseId : ""];
    if (base) out.push(baseAnchorElement(tx, base, prefix));
  }
  return out;
}

type FallResult =
  | { kind: "caught"; via: "self_belay" | "belay"; fallLengthM: number; endS: number; injuryP: number; injuryKey: string }
  | { kind: "slide_protected"; endS: number; injuryP: number }
  | { kind: "unprotected" };

function attachmentProtection(tx: StepTx, m: MemberId, a: Attachment): FallResult | null {
  const st = tx.state;
  if (!tx.snapshot.attachments.has(a.id) || !st.attachments[a.id]) return null;
  if (a.method === "hand") return null;
  const prefix = `chain:${m}:${a.id}`;
  if (a.target.kind === "base") {
    const base = st.bases[a.target.baseId];
    if (!base || !tx.snapshot.bases.has(base.id)) return null;
    const failed = rollChain(tx, [baseAnchorElement(tx, base, prefix)]);
    return failed ? null : { kind: "caught", via: "self_belay", fallLengthM: 0, endS: st.members[m].pos.s, injuryP: 0, injuryKey: "" };
  }
  const seg = findSegment(st, a.target.ropeId, a.target.lowerNodeId, a.target.upperNodeId);
  if (!seg) return null;
  const elems: ChainElement[] = [];
  if (a.method === "grabbing_knot" && a.knotId) {
    const knotId = a.knotId;
    elems.push({ key: `${prefix}:knot:${knotId}:shock`, labelKey: "chain.grabbing_knot", p: knotShock(tx, knotId), knotId, onFail: () => removeAttachment(tx, a) });
  }
  const cb = a.itemIds.map((id) => st.items[id]).find((it) => it?.type === "carabiner");
  if (cb && !cb.props.locking) elems.push({ key: `${prefix}:carabiner`, labelKey: "chain.carabiner_open", p: tx.data.hazards.carabiner.nonLockingShock, onFail: () => removeAttachment(tx, a) });
  elems.push(...fixedNodeElements(tx, seg.ropeId, [seg.lowerNodeId, seg.upperNodeId], prefix));
  if (rollChain(tx, elems)) {
    if (st.attachments[a.id]) removeAttachment(tx, a);
    return null;
  }
  if (a.method === "grabbing_knot") return { kind: "caught", via: "self_belay", fallLengthM: 0, endS: st.members[m].pos.s, injuryP: 0, injuryKey: "" };
  // carabiner only: slide down to the lower node of the segment
  const geo = geoOf(st);
  const from = st.members[m].pos.s;
  const endS = seg.lower.pos.s;
  const d = Math.abs(from - endS);
  const ih = tx.data.hazards.injury;
  const injuryP = d >= ih.slideInjuryThresholdM && steepestBetween(geo, from, endS) >= ih.slideInjuryMinDeg ? ih.pInjurySlideProtected : 0;
  return { kind: "slide_protected", endS, injuryP };
}

function belayProtection(tx: StepTx, m: MemberId, b: BelayRelation, depth: number): FallResult | null {
  const st = tx.state;
  if (!tx.snapshot.belays.has(b.id) || !st.belays[b.id]) return null;
  if (st.protocol.belayReady[b.id] === undefined) {
    // CR-26: the belay catches only after «Страховка готова!»
    tx.emit({ type: "belay.not_ready", severity: "danger", messageKey: "event.belay_not_ready", params: { member: b.belayerId, climber: m }, refs: { members: [b.belayerId, m] } });
    tx.mistake("summary.belay_not_ready", { member: b.belayerId, climber: m });
    return null;
  }
  if (b.inactiveThisStep) {
    tx.emit({ type: "belay.inactive", severity: "danger", messageKey: "event.belayer_distracted", params: { member: b.belayerId, climber: m }, refs: { members: [b.belayerId, m] } });
    tx.mistake("summary.belayer_distracted", { member: b.belayerId, climber: m });
    return null;
  }
  const rope = st.ropes[b.ropeId];
  const harness = harnessNodes(st, m).find((h) => h.rope.ropeId === b.ropeId);
  if (!rope || !harness) return null;
  const geo = geoOf(st);
  const prefix = `chain:${m}:${b.id}`;
  const elems: ChainElement[] = [];
  if (harness.node.attach.kind === "member_harness") {
    const knotId = harness.node.attach.knotId;
    elems.push({
      key: `${prefix}:knot:${knotId}:shock`,
      labelKey: "chain.tie_in_knot",
      p: knotShock(tx, knotId),
      knotId,
      onFail: () => {
        removeKnot(tx, knotId);
        harness.node.attach = { kind: "free" };
      },
    });
  }
  const p = st.members[m].pos.s;
  const belayer = st.members[b.belayerId];
  // highest intermediate base below the climber that the rope runs through (by elevation)
  let pp = belayer.pos.s;
  let ppElev = elevationOfS(geo, pp);
  const climberElev = elevationOfS(geo, p);
  for (const n of rope.nodes) {
    if (n.attach.kind !== "base" || n.attach.mode !== "running") continue;
    const base = st.bases[n.attach.baseId];
    if (!base || !tx.snapshot.bases.has(base.id)) continue;
    const e = elevationOfS(geo, n.pos.s);
    if (e < climberElev && e > ppElev) {
      pp = n.pos.s;
      ppElev = e;
    }
    elems.push(baseAnchorElement(tx, base, prefix));
  }
  if (b.braking.kind === "knot") {
    const knotId = b.braking.knotId;
    elems.push({ key: `${prefix}:knot:${knotId}:shock`, labelKey: "chain.braking_knot", p: knotShock(tx, knotId), knotId, onFail: () => removeBelay(tx, b) });
  }
  if (b.anchor.kind === "base") {
    const base = st.bases[b.anchor.baseId];
    if (base) elems.push(baseAnchorElement(tx, base, prefix));
  }
  if (rollChain(tx, elems)) return null;
  const ih = tx.data.hazards.injury;
  // belayer pulled off the stance (§14.2.2.6)
  if (b.anchor.kind === "body" && angleAt(geo, belayer.pos.s) >= ih.belayerPulledMinDeg && depth < Object.keys(st.members).length) {
    const r = tx.roll(`belayer_pulled:${b.belayerId}`, ih.pBelayerPulled);
    if (r.hit) {
      tx.emit({ type: "belayer.pulled", severity: "danger", messageKey: "event.belayer_pulled", params: { member: b.belayerId, climber: m }, refs: { members: [b.belayerId, m], rolls: [r] } });
      tx.mistake("summary.body_belay", { member: b.belayerId });
      const res = resolveFall(tx, b.belayerId, "pulled", {}, depth + 1);
      if (res === "unprotected" || res === "injured") return null;
    }
  }
  const slack = ih.slackM;
  const dir = downhillDir(geo, p);
  let fallLen: number;
  let endS: number;
  if (b.mode === "upper" || elevationOfS(geo, belayer.pos.s) > climberElev) {
    fallLen = slack;
    endS = p + dir * slack;
  } else {
    fallLen = 2 * Math.abs(p - pp) + slack;
    endS = pp + downhillDir(geo, pp) * slack;
  }
  endS = Math.max(0, Math.min(geo.totalLength, endS));
  const surf = surfaceAt(st, tx.data, st.members[m].pos);
  // CR-28: longer falls are more dangerous; intermediate points shorten them
  const lf = ih.longFall;
  const perM = isRockSurface(surf) ? lf.perM.rock : lf.perM.default;
  const raw = Math.min(lf.max, perM * Math.max(0, fallLen - lf.freeM));
  const injuryP = Math.round(raw * (wears(st, m, "helmet") ? ih.helmetFactor : 1) * 1e6) / 1e6;
  return { kind: "caught", via: "belay", fallLengthM: Math.round(fallLen * 10) / 10, endS, injuryP, injuryKey: "injury.long_fall" };
}

/** Resolves one fall; returns how it ended. */
export function resolveFall(
  tx: StepTx,
  m: MemberId,
  cause: string,
  params: Record<string, string | number>,
  depth = 0,
): "caught" | "slid" | "unprotected" | "injured" {
  const st = tx.state;
  const mem = st.members[m];
  if (mem.status === "injured") return "injured";
  st.stats.falls.total += 1;
  st.stats.members[m].falls += 1;
  tx.emit({ type: "fall.start", severity: "danger", messageKey: `event.fall.${cause}`, params: { member: m, ...params }, refs: { members: [m] } });
  // a falling member lets go of a rope end they carried (CR-65)
  for (const { node } of heldNodes(st, m)) node.attach = { kind: "free" };

  let result: FallResult | null = null;
  for (const a of attachmentsOf(st, m)) {
    result = attachmentProtection(tx, m, a);
    if (result) break;
  }
  if (!result) {
    for (const b of belaysAsClimber(st, m)) {
      result = belayProtection(tx, m, b, depth);
      if (result) break;
    }
  }
  if (!result) result = { kind: "unprotected" };

  if (result.kind === "caught") {
    if (result.via === "self_belay") st.stats.falls.selfBelay += 1;
    else st.stats.falls.belay += 1;
    moveTo(tx, m, result.endS);
    mem.status = "fallen_caught";
    tx.emit({ type: "fall.caught", severity: "warning", messageKey: `event.caught.${result.via}`, params: { member: m, length: result.fallLengthM }, refs: { members: [m] } });
    if (result.via === "belay") {
      const shoutedHold = st.protocol.recent.some((c) => c.memberId === m && c.command === "hold" && c.step >= st.step - 1);
      if (!shoutedHold) tx.violation("P7", m);
    }
    if (result.injuryP > 0) return injuryRoll(tx, m, result.injuryP, result.injuryKey, { length: result.fallLengthM }) ? "injured" : "caught";
    return "caught";
  }
  if (result.kind === "slide_protected") {
    st.stats.falls.selfBelay += 1;
    const from = mem.pos.s;
    moveTo(tx, m, result.endS);
    tx.emit({ type: "fall.slid", severity: "warning", messageKey: "event.slid_to_node", params: { member: m, distance: Math.round(Math.abs(from - result.endS) * 10) / 10 }, refs: { members: [m] } });
    tx.mistake("summary.carabiner_slide", { member: m });
    if (result.injuryP > 0 && injuryRoll(tx, m, result.injuryP, "injury.slide", {})) return "injured";
    return "slid";
  }
  // unprotected slide (§14.2.3)
  st.stats.falls.unprotected += 1;
  const geo = geoOf(st);
  const ih = tx.data.hazards.injury.unprotected;
  const from = mem.pos.s;
  const dir = downhillDir(geo, from);
  let s = from;
  let guard = 0;
  while (guard++ < 1000) {
    const g = segmentAt(geo, dir === -1 ? s - 1e-6 : s + 1e-6);
    if (g.angleDeg < ih.stopBelowDeg || g.zone !== "slope") break;
    s = dir === -1 ? g.s0 : g.s1;
    if (s <= 0 || s >= geo.totalLength) break;
  }
  // a rope the member is still tied into stops the slide when it comes tight
  for (const { rope, node } of harnessNodes(st, m)) {
    const len = st.items[rope.ropeId].props.lengthM ?? 0;
    let lo = 0;
    let hi = Math.abs(s - from);
    if (ropeUsedM(st, tx.data, rope, { nodeId: node.id, s }) > len) {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (ropeUsedM(st, tx.data, rope, { nodeId: node.id, s: from + dir * mid }) <= len) lo = mid;
        else hi = mid;
      }
      s = from + dir * lo;
    }
  }
  const d = Math.abs(s - from);
  moveTo(tx, m, s);
  tx.emit({ type: "fall.unprotected", severity: "danger", messageKey: "event.fall_unprotected", params: { member: m, distance: Math.round(d * 10) / 10 }, refs: { members: [m] } });
  tx.mistake("summary.unprotected_fall", { member: m, distance: Math.round(d * 10) / 10 });
  const steep = steepestBetween(geo, from, s);
  if (d >= ih.minSlideM && steep >= ih.minDeg) {
    const surf = surfaceAt(st, tx.data, { obstacleIndex: 0, s: from });
    const p = isRockSurface(surf) ? ih.pRock : ih.p;
    if (injuryRoll(tx, m, p, "injury.unprotected", { distance: Math.round(d * 10) / 10 })) return "injured";
  }
  return "unprotected";
}

function moveTo(tx: StepTx, m: MemberId, s: number) {
  const mem = tx.state.members[m];
  mem.pos = { ...mem.pos, s: Math.round(s * 100) / 100 };
  syncMemberNodes(tx.state, m);
}

export function injuryRoll(tx: StepTx, m: MemberId, p: number, causeKey: string, params: Record<string, string | number>): boolean {
  const r = tx.roll(`injury:${m}`, p);
  tx.emit({ type: "injury.roll", severity: r.hit ? "danger" : "info", messageKey: r.hit ? "event.injured" : "event.injury_avoided", params: { member: m, p: pct(p), cause: causeKey, ...params }, refs: { members: [m], rolls: [r] } });
  if (r.hit) {
    tx.state.members[m].status = "injured";
    tx.state.stats.injuries.push({ memberId: m, causeKey, params: { ...params, p: pct(p) } });
    tx.mistake(causeKey, { member: m, ...params });
  }
  return r.hit;
}

/** §13.6.2 — wrong anchor / tie-in knots under static load roll every loaded step. */
export function staticLoadRolls(tx: StepTx) {
  const { state, data } = tx;
  const geo = geoOf(state);
  for (const m of Object.keys(state.members)) {
    const mv = tx.moved.get(m);
    if (!mv) continue;
    if (steepestBetween(geo, mv.from, mv.to) < data.rules.staticLoadDeg) continue;
    for (const a of attachmentsOf(state, m)) {
      // a friction hitch slides with the member: the rope stays fixed, its anchor knots are not loaded (CR-23)
      if (a.target.kind !== "segment" || a.method === "grabbing_knot") continue;
      const seg = findSegment(state, a.target.ropeId, a.target.lowerNodeId, a.target.upperNodeId);
      if (!seg) continue;
      for (const node of [seg.upper, seg.lower]) {
        if (node.attach.kind !== "base" || node.attach.mode !== "fixed") continue;
        const knot = state.knots[node.attach.knotId];
        if (!knot) continue;
        tx.loadedKnots.add(knot.id);
        const p = knot.evaluation.failProbStatic;
        const r = tx.roll(`static:${m}:knot:${knot.id}`, p);
        if (r.hit) {
          tx.emit({ type: "knot.failed", severity: "danger", messageKey: "event.knot_failed_static", params: { member: m, knot: knot.knotId, p: pct(p) }, refs: { members: [m], knots: [knot.id], rolls: [r] } });
          removeKnot(tx, knot.id);
          node.attach = { kind: "free" };
          tx.falls.push({ memberId: m, cause: "knot_failed", params: { knot: knot.knotId } });
        }
      }
    }
  }
  // members hanging on the rope since last step load their tie-in knot statically
  for (const m of tx.snapshot.fallenCaught) {
    for (const { node } of harnessNodes(state, m)) {
      if (node.attach.kind !== "member_harness") continue;
      const knot = state.knots[node.attach.knotId];
      if (!knot || knot.evaluation.failProbStatic === 0) continue;
      tx.loadedKnots.add(knot.id);
      const r = tx.roll(`static:${m}:knot:${knot.id}`, knot.evaluation.failProbStatic);
      if (r.hit) {
        tx.emit({ type: "knot.failed", severity: "danger", messageKey: "event.knot_failed_static", params: { member: m, knot: knot.knotId, p: pct(knot.evaluation.failProbStatic) }, refs: { members: [m], knots: [knot.id], rolls: [r] } });
        removeKnot(tx, knot.id);
        node.attach = { kind: "free" };
        tx.falls.push({ memberId: m, cause: "knot_failed", params: { knot: knot.knotId } });
      }
    }
  }
}

/** Terrain fall chance for every member who moved (§14.1.1). */
export function terrainFallRolls(tx: StepTx) {
  for (const [m, mv] of tx.moved) {
    if (tx.falls.some((f) => f.memberId === m)) continue;
    if (attachmentsOf(tx.state, m).some((a) => a.target.kind === "base")) continue; // self-secured at a base cannot fall
    if (traverseAttachment(tx.state, m)) continue; // hanging on secured перила over the ravine (CR-55)
    // friction hitch on a fixed rope: safe movement below safeGrabbingMaxDeg (CR-23)
    if (usesGrabbingKnot(tx.state, m) && steepestBetween(geoOf(tx.state), mv.from, mv.to) < tx.data.rules.safeGrabbingMaxDeg) continue;
    const { p, factors, angle } = fallChance(tx, m, mv.from, mv.to);
    if (p <= 0) continue;
    const r = tx.roll(`fall:terrain:${m}`, p);
    const params: Record<string, string | number> = { p: pct(p), angle };
    factors.forEach((f, i) => (params[`f${i}`] = `${f.key}=${f.value}`));
    if (r.hit) tx.falls.push({ memberId: m, cause: "terrain", params });
    else if (tx.state.scenario.mode === "learning" && factors.length > 2) {
      tx.emit({ type: "fall.chance", severity: "hint", messageKey: "event.fall_chance", params: { member: m, p: pct(p) }, refs: { members: [m], rolls: [r] } });
    }
  }
}

export function knotDefFor(tx: StepTx, knotId: string) {
  return knotDef(tx.data, knotId);
}
