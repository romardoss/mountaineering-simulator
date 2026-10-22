// §24.2.1 Golden path and §24.2.10 determinism: canonical hill tactic (§17.4) on «Схил з деревами».
import { describe, expect, it } from "vitest";
import type { ActionParams, AttachTarget } from "../../../src/engine/model/types";
import { engine } from "../dsl";
import { Game, K, mv, say, scenario } from "../dsl";
import { belayableSegments, harnessNodes } from "../../../src/engine/model/selectors";

const prusik = K("prusik");

function ropeOf(g: Game, memberId: string) {
  return g.item("rope", memberId).id;
}

function segAt(g: Game, ropeId: string, lo: number, hi: number): AttachTarget {
  const s = belayableSegments(g.state).find((x) => x.ropeId === ropeId && Math.abs(Math.min(x.lower.pos.s, x.upper.pos.s) - lo) < 0.01 && Math.abs(Math.max(x.lower.pos.s, x.upper.pos.s) - hi) < 0.01);
  if (!s) throw new Error(`no segment ${ropeId} ${lo}-${hi}`);
  return { kind: "segment", ropeId: s.ropeId, lowerNodeId: s.lowerNodeId, upperNodeId: s.upperNodeId };
}

function attachmentId(g: Game, m: string, pred: (t: AttachTarget) => boolean) {
  return Object.values(g.state.attachments).find((a) => a.memberId === m && pred(a.target))!.id;
}

function nodeAt(g: Game, ropeId: string, s: number) {
  return g.state.ropes[ropeId].nodes.find((n) => Math.abs(n.pos.s - s) < 0.01)!.id;
}

/** A member climbs a fixed rope segment with a prusik, then moves on (one member per segment). */
function climbSegment(g: Game, m: string, target: AttachTarget, toS: number, rolls?: (i: number) => Record<string, boolean> | undefined) {
  g.step({ [m]: { kind: "attach", method: "grabbing_knot", target, knot: prusik } });
  for (let i = 0; i < 40 && g.s(m) < toS - 0.01; i++) g.step({ [m]: mv(toS - g.s(m)) }, rolls?.(i));
  expect(g.s(m)).toBeCloseTo(toS, 1);
}

function switchSegment(g: Game, m: string, from: AttachTarget, to: AttachTarget) {
  const same = (t: AttachTarget) => JSON.stringify(t) === JSON.stringify(from);
  g.step({ [m]: { kind: "attach", method: "lanyard_carabiner", target: to } });
  g.step({ [m]: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, m, same) } } });
  g.step({ [m]: { kind: "attach", method: "grabbing_knot", target: to, knot: prusik } });
  g.step({ [m]: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, m, (t) => JSON.stringify(t) === JSON.stringify(to) && true) } } });
}

function detachAll(g: Game, m: string) {
  for (const a of Object.values(g.state.attachments).filter((x) => x.memberId === m)) g.step({ [m]: { kind: "detach", what: { kind: "attachment", attachmentId: a.id } } });
}

export function playGoldenPath(seed = 7) {
  const g = new Game(scenario({ seed }));
  const ropeA = ropeOf(g, "m2");
  const ropeB = ropeOf(g, "m3");
  const base = (bp: string) => g.base(bp).id;
  const step = (plan: Record<string, ActionParams>) => g.step(plan);

  // --- pitch 1: start base → bp_mid1 (s=41)
  step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" }, m2: { kind: "pass", toMemberId: "m1", itemIds: [ropeA] } });
  step({ m1: { kind: "tie_in", ropeId: ropeA, knot: K("providnyk_visimka_odnym"), viaCarabiner: false }, m2: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base("bp_start") } } });
  step({ m2: { kind: "belay", climberId: "m1", braking: "knot", knot: K("uiaa"), anchor: "base" } });
  step({ m2: say("belay_ready"), m1: say("go") });
  for (let i = 0; i < 30 && g.s("m1") < 41 - 0.01; i++) step({ m1: mv(41 - g.s("m1")) });
  expect(g.s("m1")).toBeCloseTo(41, 1);
  step({ m1: { kind: "make_base", basePointId: "bp_mid1", construction: "sling" } });
  step({ m1: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base("bp_mid1") } } });
  step({ m1: say("secured") });
  step({ m2: { kind: "stop_belay", belayId: Object.keys(g.state.belays)[0] } });
  step({ m1: { kind: "fix_rope", ropeId: ropeA, baseId: base("bp_mid1"), method: "knot", knot: K("providnyk_visimka") } });
  step({ m2: { kind: "fix_rope", ropeId: ropeA, baseId: base("bp_start"), method: "knot", knot: K("stremeno") } });
  step({ m1: say("fixed_rope_ready") });
  const segA = segAt(g, ropeA, 3, 41);

  // --- m3 climbs pitch 1 carrying rope B, becomes the belayer for pitch 2
  step({ m2: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, "m2", (t) => t.kind === "base") } } });
  climbSegment(g, "m3", segA, 41);
  step({ m3: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base("bp_mid1") } } });
  step({ m3: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, "m3", (t) => t.kind === "segment") } } });
  step({ m3: { kind: "pass", toMemberId: "m1", itemIds: [ropeB] }, m1: say("fixed_rope_free") });

  // --- pitch 2: bp_mid1 → bp_top (s=79) with an intermediate base at bp_mid2 (s=61)
  step({ m1: { kind: "tie_in", ropeId: ropeB, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } });
  step({ m3: { kind: "belay", climberId: "m1", braking: "knot", knot: K("uiaa"), anchor: "base" } });
  step({ m3: say("belay_ready"), m1: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, "m1", (t) => t.kind === "base") } } });
  step({ m1: say("go") });
  for (let i = 0; i < 30 && g.s("m1") < 61 - 0.01; i++) step({ m1: mv(61 - g.s("m1")) });
  step({ m1: { kind: "make_base", basePointId: "bp_mid2", construction: "sling" } });
  step({ m1: { kind: "clip", ropeId: ropeB, baseId: base("bp_mid2") } });
  for (let i = 0; i < 30 && g.s("m1") < 79 - 0.01; i++) step({ m1: mv(79 - g.s("m1")) });
  step({ m1: { kind: "make_base", basePointId: "bp_top", construction: "sling" } });
  step({ m1: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base("bp_top") } } });
  step({ m1: say("secured") });
  step({ m3: { kind: "stop_belay", belayId: Object.keys(g.state.belays)[0] } });
  step({ m1: { kind: "fix_rope", ropeId: ropeB, baseId: base("bp_top"), method: "knot", knot: K("providnyk_visimka") } });
  step({ m3: { kind: "fix_rope", ropeId: ropeB, baseId: base("bp_mid1"), method: "knot", knot: K("stremeno") } });
  step({ m1: say("fixed_rope_ready") });
  const segB1 = segAt(g, ropeB, 41, 61);
  const segB2 = segAt(g, ropeB, 61, 79);

  // --- m3 continues to the top
  step({ m3: { kind: "attach", method: "grabbing_knot", target: segB1, knot: prusik } });
  step({ m3: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, "m3", (t) => t.kind === "base") } } });
  for (let i = 0; i < 30 && g.s("m3") < 61 - 0.01; i++) step({ m3: mv(61 - g.s("m3")) });
  switchSegment(g, "m3", segB1, segB2);
  for (let i = 0; i < 30 && g.s("m3") < 79 - 0.01; i++) step({ m3: mv(79 - g.s("m3")) });
  detachAll(g, "m3");

  // --- m4 climbs all the way; a forced slip on the 28° section has no effect: a friction hitch on a fixed rope is safe (CR-23)
  let forced = false;
  climbSegment(g, "m4", segA, 41, (i) => {
    if (!forced && g.s("m4") > 22 && i > 0) {
      forced = true;
      return { "fall:terrain:m4": true };
    }
    return undefined;
  });
  switchSegment(g, "m4", segA, segB1);
  for (let i = 0; i < 30 && g.s("m4") < 61 - 0.01; i++) step({ m4: mv(61 - g.s("m4")) });
  switchSegment(g, "m4", segB1, segB2);
  for (let i = 0; i < 30 && g.s("m4") < 79 - 0.01; i++) step({ m4: mv(79 - g.s("m4")) });
  detachAll(g, "m4");
  step({ m4: say("fixed_rope_free") });

  // --- m2 climbs pitch 1 and stays at bp_mid1 to belay the last member from above
  climbSegment(g, "m2", segA, 41);
  step({ m2: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base("bp_mid1") } } });
  step({ m2: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, "m2", (t) => t.kind === "segment") } } });

  // --- last member m5 retrieves rope A on upper belay (§17.4.5)
  step({ m5: { kind: "detach", what: { kind: "untie", ropeId: ropeA, nodeId: nodeAt(g, ropeA, 3) } }, m2: { kind: "detach", what: { kind: "untie", ropeId: ropeA, nodeId: nodeAt(g, ropeA, 41) } } });
  step({ m5: { kind: "detach", what: { kind: "dismantle_base", baseId: base("bp_start") } } });
  step({ m5: { kind: "tie_in", ropeId: ropeA, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } });
  step({ m2: { kind: "belay", climberId: "m5", braking: "knot", knot: K("uiaa"), anchor: "base" } });
  step({ m2: say("belay_ready"), m5: say("go") });
  for (let i = 0; i < 30 && g.s("m5") < 41 - 0.01; i++) step({ m5: mv(41 - g.s("m5")) });
  step({ m5: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base("bp_mid1") } } });
  step({ m5: say("secured") });
  step({ m2: { kind: "stop_belay", belayId: Object.keys(g.state.belays)[0] } });
  step({ m5: { kind: "detach", what: { kind: "untie", ropeId: ropeA, nodeId: harnessNodes(g.state, "m5")[0].node.id } } });
  step({ m5: { kind: "detach", what: { kind: "coil", ropeId: ropeA } } });

  // --- m2 continues to the top on the fixed rope
  step({ m2: { kind: "attach", method: "grabbing_knot", target: segB1, knot: prusik } });
  step({ m2: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, "m2", (t) => t.kind === "base") } } });
  for (let i = 0; i < 30 && g.s("m2") < 61 - 0.01; i++) step({ m2: mv(61 - g.s("m2")) });
  switchSegment(g, "m2", segB1, segB2);
  for (let i = 0; i < 30 && g.s("m2") < 79 - 0.01; i++) step({ m2: mv(79 - g.s("m2")) });
  detachAll(g, "m2");

  // --- m5 retrieves rope B on upper belay from the top, dismantling the bases on the way
  step({ m5: { kind: "detach", what: { kind: "untie", ropeId: ropeB, nodeId: nodeAt(g, ropeB, 41) } }, m1: { kind: "detach", what: { kind: "untie", ropeId: ropeB, nodeId: nodeAt(g, ropeB, 79) } } });
  step({ m5: { kind: "tie_in", ropeId: ropeB, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } });
  step({ m1: { kind: "belay", climberId: "m5", braking: "knot", knot: K("uiaa"), anchor: "base" } });
  step({ m1: say("belay_ready"), m5: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentId(g, "m5", (t) => t.kind === "base") } } });
  step({ m5: { kind: "detach", what: { kind: "dismantle_base", baseId: base("bp_mid1") } } });
  step({ m5: say("go") });
  for (let i = 0; i < 30 && g.s("m5") < 61 - 0.01; i++) step({ m5: mv(61 - g.s("m5")) });
  step({ m5: { kind: "detach", what: { kind: "unclip", ropeId: ropeB, nodeId: nodeAt(g, ropeB, 61) } } });
  step({ m5: { kind: "detach", what: { kind: "dismantle_base", baseId: base("bp_mid2") } } });
  for (let i = 0; i < 30 && g.state.outcome === "in_progress"; i++) step({ m5: mv(79 - g.s("m5")) });
  return g;
}

describe("§24.2.1 golden path (canonical tactic)", () => {
  const g = playGoldenPath();
  it("wins with zero injuries, zero items left, zero protocol violations", () => {
    const stats = engine.getStats(g.state);
    expect(g.state.outcome).toBe("won");
    expect(stats.injuries).toHaveLength(0);
    expect(stats.itemsLeft).toEqual([]);
    expect(stats.commands.violations).toEqual({});
  });
  it("moving on a friction hitch along the fixed rope never falls (CR-23)", () => {
    expect(g.state.stats.falls.unprotected).toBe(0);
    expect(g.state.stats.members.m4.falls).toBe(0);
    expect(g.state.log.some((e) => e.type.startsWith("fall.") && e.params.member === "m4")).toBe(false);
  });
  it("§24.2.10 replaying the history gives a deep-equal state", () => {
    expect(g.replay()).toEqual(g.state);
  });
});
