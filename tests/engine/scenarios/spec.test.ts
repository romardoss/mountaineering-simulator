// PRD §24.2 scenario tests 2–9 and 11–14.
import { describe, expect, it } from "vitest";
import { buildKit } from "../../../src/engine/scenario/kit";
import { fallChance } from "../../../src/engine/hazards/falls";
import { createTx } from "../../../src/engine/resolution/tx";
import { terrainReach } from "../../../src/engine/actions/movement";
import { belayableSegments, harnessNodes } from "../../../src/engine/model/selectors";
import { anchorContext } from "../../../src/engine/knots/instance";
import type { ActionParams, ItemConfig, MemberConfig } from "../../../src/engine/model/types";
import { CALM, data, engine, Game, K, makeItem, mv, preset, say, scenario, steepHill } from "../dsl";
import { kits } from "../../../src/data/load";

const base = (g: Game, bp: string) => g.base(bp).id;

/** Leader m1 on lower belay by m2 from the start base; returns ropeId. */
function leaderOnBelay(g: Game, opts: { tieKnot?: string; brake?: string; sameStep?: boolean } = {}) {
  const rope = g.item("rope", "m2").id;
  g.step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" }, m2: { kind: "pass", toMemberId: "m1", itemIds: [rope] } });
  g.step({ m1: { kind: "tie_in", ropeId: rope, knot: K(opts.tieKnot ?? "providnyk_visimka_odnym"), viaCarabiner: false }, m2: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base(g, "bp_start") } } });
  if (opts.sameStep) return rope;
  g.step({ m2: { kind: "belay", climberId: "m1", braking: "knot", knot: K(opts.brake ?? "uiaa"), anchor: "base" } });
  g.step({ m2: say("belay_ready"), m1: say("go") });
  return rope;
}

function climbTo(g: Game, m: string, s: number) {
  for (let i = 0; i < 40 && g.s(m) < s - 0.01; i++) g.step({ [m]: mv(s - g.s(m)) });
}

/** Fixed rope from bp_start (3) to bp_top on steepHill, set up by m1 walking up unprotected. */
function fixedRope(g: Game, topBp = "bp_top") {
  const rope = g.item("rope", "m2").id;
  const top = g.state.scenario.route.obstacles[0].basePoints.find((b) => b.id === topBp)!.s;
  g.step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" }, m2: { kind: "pass", toMemberId: "m1", itemIds: [rope] } });
  climbTo(g, "m1", top);
  g.step({ m1: { kind: "make_base", basePointId: topBp, construction: "sling" } });
  g.step({ m1: { kind: "fix_rope", ropeId: rope, baseId: base(g, topBp), method: "knot", knot: K("providnyk_visimka") }, m2: mv(2, "start") });
  g.step({ m2: { kind: "fix_rope", ropeId: rope, baseId: base(g, "bp_start"), method: "knot", knot: K("stremeno") } });
  g.step({ m1: say("fixed_rope_ready"), m2: mv(2) });
  const seg = belayableSegments(g.state).find((x) => x.ropeId === rope)!;
  return { rope, target: { kind: "segment" as const, ropeId: rope, lowerNodeId: seg.lowerNodeId, upperNodeId: seg.upperNodeId } };
}

describe("§24.2.2 wrong tie-in knot", () => {
  it("Стремено fails under shock → unprotected fall → lost", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    leaderOnBelay(g, { tieKnot: "stremeno" });
    expect(Object.values(g.state.knots).find((k) => k.context === "TIE_IN_END")!.evaluation.rating).toBe("dangerous");
    climbTo(g, "m1", 14);
    const ev = g.step({ m1: mv(2) }, { "fall:terrain:m1": true, "injury:m1": true });
    expect(ev.some((e) => e.type === "chain.failed" && e.params.element === "chain.tie_in_knot")).toBe(true);
    expect(ev.some((e) => e.type === "fall.unprotected")).toBe(true);
    expect(g.state.outcome).toBe("lost");
  });
});

describe("§24.2.3 distracted belayer", () => {
  it("belayer ties a knot while the leader moves → belay inactive → unprotected", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    leaderOnBelay(g);
    const ropeB = g.item("rope", "m3").id;
    g.step({ m3: { kind: "pass", toMemberId: "m2", itemIds: [ropeB] } });
    climbTo(g, "m1", 12);
    const ev = g.step({ m1: mv(2), m2: { kind: "tie_in", ropeId: ropeB, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } }, { "fall:terrain:m1": true, "injury:m1": false });
    expect(ev.some((e) => e.type === "belay.inactive")).toBe(true);
    expect(ev.some((e) => e.type === "fall.unprotected")).toBe(true);
  });
});

describe("§24.2.4 belay set in the same step", () => {
  it("does not protect the climber in that step (§10.3)", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    leaderOnBelay(g, { sameStep: true });
    climbTo(g, "m1", 9);
    const ev = g.step({ m2: { kind: "belay", climberId: "m1", braking: "knot", knot: K("uiaa"), anchor: "base" }, m1: mv(2) }, { "fall:terrain:m1": true, "injury:m1": false });
    expect(ev.some((e) => e.type === "fall.unprotected")).toBe(true);
    expect(ev.some((e) => e.type === "fall.caught")).toBe(false);
  });
});

describe("§24.2.5 Гарда in lower belay", () => {
  it("leader cannot move further than the slack; knot.garda_blocks_feed emitted", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    leaderOnBelay(g, { brake: "garda" });
    const from = g.s("m1");
    const ev = g.step({ m1: mv(5) });
    expect(ev.some((e) => e.type === "knot.garda_blocks_feed")).toBe(true);
    expect(g.s("m1") - from).toBeLessThanOrEqual(data.hazards.injury.slackM + 1e-6);
    const opt = engine.getActionOptions(g.state, "m1").find((o) => o.id === "move:finish")!;
    expect(opt.enabled).toBe(false);
    expect(opt.reasonKey).toBe("reason.garda_blocks_feed");
  });
});

describe("§24.2.6 prusik diameter ratio", () => {
  it("10 mm cord on 10 mm rope raises the shock failure, but moving on the friction hitch is safe (CR-23)", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground"), items: kit }));
    // prusiks are individual equipment (CR-14): give m3's loops a 10 mm cord before the first step
    for (const it of Object.values(g.state.items)) if (it.type === "cord" && it.location.kind === "carried" && it.location.memberId === "m3") it.props = { ...it.props, diameterMm: 10 };
    const { target } = fixedRope(g);
    g.step({ m3: { kind: "attach", method: "grabbing_knot", target, knot: K("prusik") } });
    const knot = Object.values(g.state.knots).find((k) => k.context === "SELF_BELAY_GRAB")!;
    expect(knot.evaluation.failProbShock).toBeGreaterThanOrEqual(data.hazards.knots.modifiers.diameterRatio.shock);
    expect(knot.evaluation.messages.some((m) => m.key === "knot.msg.cord_too_thick")).toBe(true);
    climbTo(g, "m3", 10);
    const ev = g.step({ m3: mv(2) }, { "fall:terrain:m3": true, "chain:m3:*": true, "injury:m3": false });
    expect(ev.some((e) => e.type.startsWith("fall.") || e.type === "chain.failed")).toBe(false);
  });
});

describe("§24.2.7 carabiner-only self-belay", () => {
  it("member slides to the lower node and must climb again", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    const { target } = fixedRope(g);
    g.step({ m3: { kind: "attach", method: "lanyard_carabiner", target } });
    climbTo(g, "m3", 12);
    const ev = g.step({ m3: mv(2) }, { "fall:terrain:m3": true, "injury:m3": false });
    expect(ev.some((e) => e.type === "fall.slid")).toBe(true);
    expect(g.s("m3")).toBeCloseTo(3, 1);
    expect(Object.values(g.state.attachments).some((a) => a.memberId === "m3")).toBe(true);
  });
});

describe("§24.2.8 rockfall warned vs unwarned", () => {
  function setup() {
    const sc = scenario({ hill: steepHill(30, "rock"), items: kit });
    const g = new Game(sc);
    climbTo(g, "m1", 12);
    g.step({ m1: mv(1) }, { "rockfall:dislodge:m1": true });
    return g;
  }
  it("warned in time → no hits, forced skips counted", () => {
    const g = setup();
    expect(g.state.stats.rockfall.total).toBe(1);
    g.step({ m2: say("rock"), m3: mv(1) });
    expect(g.state.stats.rockfall.warned).toBe(1);
    expect(g.state.stats.rockfall.hits).toBe(0);
    expect(g.state.stats.members.m3.forcedSkips).toBe(1);
    expect(g.s("m3")).toBeCloseTo(3, 5);
  });
  it("unwarned → hit rolls; the always-worn helmet reduces injury chance (CR-10)", () => {
    const g = setup();
    const ev = g.step({}, { "rockfall:hit:*": true, "injury:*": false });
    const rolls = ev.filter((e) => e.type === "injury.roll");
    const p = (m: string) => rolls.find((e) => e.params.member === m)!.params.p;
    expect(p("m2")).toBeCloseTo(data.hazards.rockfall.pInjuryRock * data.hazards.rockfall.helmetFactor * 100, 5);
    expect(p("m3")).toBeCloseTo(data.hazards.rockfall.pInjuryRock * data.hazards.rockfall.helmetFactor * 100, 5);
    expect(g.state.stats.commands.violations.P5).toBe(1);
  });
});

describe("§24.2.9 accountability", () => {
  it("using a rope not carried by the member is impossible (disabled with reason)", () => {
    const g = new Game(scenario({ hill: steepHill() }));
    const rope = g.item("rope", "m2").id;
    const v = engine.validatePlan(g.state, [{ memberId: "m1", params: { kind: "tie_in", ropeId: rope, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } }]);
    expect(v.members.m1.ok).toBe(false);
    expect(v.members.m1.reasonKey).toBe("reason.rope_not_carried");
  });
  it("passing an item to a non-adjacent member is impossible", () => {
    const g = new Game(scenario({ hill: steepHill() }));
    climbTo(g, "m1", 12);
    const cord = g.item("cord", "m2").id;
    const v = engine.validatePlan(g.state, [{ memberId: "m2", params: { kind: "pass", toMemberId: "m1", itemIds: [cord] } }]);
    expect(v.members.m2.reasonKey).toBe("reason.not_adjacent");
  });
  it("a rope cannot be stretched beyond its length", () => {
    const sc = scenario({ hill: steepHill(10, "grass", 60), items: (t) => kit(t).map((i) => (i.type === "rope" ? { ...i, props: { ...i.props, lengthM: 20 } } : i)) });
    const g = new Game(sc);
    const rope = g.item("rope", "m2").id;
    g.step({ m2: { kind: "pass", toMemberId: "m1", itemIds: [rope] } });
    g.step({ m1: { kind: "tie_in", ropeId: rope, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } });
    for (let i = 0; i < 30 && engine.getActionOptions(g.state, "m1").find((o) => o.id === "move:finish")!.enabled; i++) g.step({ m1: mv(10) });
    expect(g.s("m1")).toBeLessThanOrEqual(3 + 20 - 1 + 1e-6);
    const opt = engine.getActionOptions(g.state, "m1").find((o) => o.id === "move:finish")!;
    expect(opt.reasonKey).toBe("reason.rope_too_short");
  });
});

describe("§24.2.11 missing control knot", () => {
  it("adds +0.25 shock and an explanation", () => {
    const e = engine.evaluateKnot({ knotId: "bulin", context: "ANCHOR_THICK", control: "none", turns: null, lockingCarabiners: 0, carabiners: 0, support: "thick" });
    expect(e.rating).toBe("correct");
    expect(e.failProbShock).toBeCloseTo(data.hazards.knots.modifiers.missingControl.shock, 6);
    expect(e.messages.some((m) => m.key === "knot.msg.missing_control")).toBe(true);
    const ok = engine.evaluateKnot({ knotId: "bulin", context: "ANCHOR_THICK", control: "double", turns: null, lockingCarabiners: 0, carabiners: 0, support: "thick" });
    expect(ok.failProbShock).toBe(0);
  });
});

describe("§24.2.12 descent pull-down", () => {
  it("the last member pulls the doubled rope down; only the abandoned base is left", () => {
    const g = new Game(scenario({ hill: preset("spusk-zi-schylu") }));
    const rope = g.item("rope", "m2").id;
    g.step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" }, m2: { kind: "pass", toMemberId: "m1", itemIds: [rope] } });
    g.step({ m1: { kind: "fix_rope", ropeId: rope, baseId: base(g, "bp_start"), method: "doubled" } });
    g.step({ m1: say("fixed_rope_ready") });
    const strands = belayableSegments(g.state).filter((s) => s.ropeId === rope);
    expect(strands).toHaveLength(2);
    const t = (i: number) => ({ kind: "segment" as const, ropeId: rope, lowerNodeId: strands[i].lowerNodeId, upperNodeId: strands[i].upperNodeId });
    const down = (m: string, toS: number) => {
      for (let i = 0; i < 40 && g.s(m) < toS - 0.01; i++) g.step({ [m]: mv(toS - g.s(m)) });
    };
    const detachAll = (m: string) => {
      for (const a of Object.values(g.state.attachments).filter((x) => x.memberId === m)) g.step({ [m]: { kind: "detach", what: { kind: "attachment", attachmentId: a.id } } });
    };
    // first member down builds the lower base at bp_mid2 (s=21)
    g.step({ m1: { kind: "attach", method: "grabbing_knot", target: t(0), knot: K("prusik") } });
    down("m1", 21);
    g.step({ m1: { kind: "make_base", basePointId: "bp_mid2", construction: "sling" } });
    g.step({ m1: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base(g, "bp_mid2") } } });
    g.step({ m1: { kind: "detach", what: { kind: "attachment", attachmentId: Object.values(g.state.attachments).find((a) => a.memberId === "m1" && a.target.kind === "segment")!.id } } });
    for (const m of ["m2", "m3", "m4"]) {
      g.step({ [m]: { kind: "attach", method: "grabbing_knot", target: t(0), knot: K("prusik") } });
      down(m, 21);
      detachAll(m);
      g.step({ [m]: { kind: "move", toward: "finish", distanceM: 1 } });
    }
    // last member: self-belay on both strands
    g.step({ m5: { kind: "attach", method: "grabbing_knot", target: t(0), knot: K("prusik") } });
    g.step({ m5: { kind: "attach", method: "lanyard_carabiner", target: t(1) } });
    down("m5", 21);
    detachAll("m5");
    g.step({ m5: { kind: "detach", what: { kind: "pull_down", ropeId: rope } } });
    const item = g.state.items[rope];
    expect(item.location).toEqual({ kind: "carried", memberId: "m5" });
    const left = engine.getStats(g.state).itemsLeft.map((i) => i.type).sort();
    // the abandoned start base (sling + its carabiner) and the lower base still in use
    expect(left).toEqual(expect.arrayContaining(["carabiner", "sling"]));
    expect(left.filter((x) => x === "rope")).toHaveLength(0);
  });
});

describe("§24.2.13 weight cap", () => {
  it("assigning above maxKg is rejected", () => {
    const sc = scenario({ hill: steepHill(), items: (t) => [...kit(t), makeItem(data, "extra", "rope", { lengthM: 60, diameterMm: 12 }, { memberId: "m1", as: "carried" }), makeItem(data, "extra2", "rope", { lengthM: 60, diameterMm: 12 }, { memberId: "m1", as: "carried" }), makeItem(data, "extra3", "rope", { lengthM: 60, diameterMm: 12 }, { memberId: "m1", as: "carried" }), makeItem(data, "extra4", "rope", { lengthM: 60, diameterMm: 12 }, { memberId: "m1", as: "carried" })] });
    expect(() => engine.createGame(sc)).toThrow(/validate.over_max/);
  });
  it("between heavyKg and maxKg: move ×0.7 and fall ×1.3", () => {
    const sc = scenario({ hill: steepHill(38, "ground"), items: (t) => [...kit(t), makeItem(data, "x1", "rope", { lengthM: 60, diameterMm: 11 }, { memberId: "m1", as: "carried" }), makeItem(data, "x2", "rope", { lengthM: 60, diameterMm: 11 }, { memberId: "m1", as: "carried" }), makeItem(data, "x3", "rope", { lengthM: 60, diameterMm: 11 }, { memberId: "m1", as: "carried" })] });
    const g = new Game(sc);
    const kg = engine.getStats(g.state).members.m1.maxWeightKg;
    expect(kg).toBeGreaterThan(data.rules.weight.heavyKg);
    expect(kg).toBeLessThanOrEqual(data.rules.weight.maxKg);
    // from s=3: 3 m of flat start zone (6 m/step × 0.7), then 38° uphill (2 m/step × 0.7 × 1.5, CR-19)
    const flatShare = 3 / (6 * 0.7);
    expect(terrainReach(data, g.state, "m1", 1)).toBeCloseTo(3 + (1 - flatShare) * 2 * 0.7 * data.rules.moveModifiers.uphill, 1);
    const tx = createTx(data, structuredClone(g.state), { attachments: new Set(), belays: new Set(), bases: new Set(), knots: new Set(), fallenCaught: new Set() });
    const f = fallChance(tx, "m1", 10, 12);
    expect(f.factors.find((x) => x.key === "factor.overloaded")?.value).toBe(data.rules.weight.overFallFactor);
  });
});

describe("§24.2.14 long caught fall", () => {
  it("injury chance grows with the fall length; an intermediate point makes it much smaller (CR-28)", () => {
    const lf = data.hazards.injury.longFall;
    const pOf = (len: number) => Math.min(lf.max, lf.perM.rock * Math.max(0, len - lf.freeM)) * data.hazards.injury.helmetFactor * 100;
    const g = new Game(scenario({ hill: steepHill(45, "rock", 30) }));
    leaderOnBelay(g);
    climbTo(g, "m1", 9.5);
    const ev = g.step({ m1: mv(0.5) }, { "fall:terrain:m1": true, "injury:m1": false });
    const caught = ev.find((e) => e.type === "fall.caught")!;
    const len1 = Number(caught.params.length);
    expect(len1).toBeGreaterThan(10);
    const roll = ev.find((e) => e.type === "injury.roll")!;
    expect(Number(roll.params.p)).toBeCloseTo(pOf(len1), 1);

    const g2 = new Game(scenario({ hill: steepHill(45, "rock", 30) }));
    const rope = leaderOnBelay(g2);
    climbTo(g2, "m1", 21);
    g2.step({ m1: { kind: "make_base", basePointId: "bp_mid", construction: "bolt" } });
    g2.step({ m1: { kind: "clip", ropeId: rope, baseId: base(g2, "bp_mid") } });
    climbTo(g2, "m1", 22.5);
    const ev2 = g2.step({ m1: mv(0.1) }, { "fall:terrain:m1": true });
    const c2 = ev2.find((e) => e.type === "fall.caught")!;
    const len2 = Number(c2.params.length);
    expect(len2).toBeLessThan(6);
    const p2 = Number(ev2.find((e) => e.type === "injury.roll")?.params.p ?? 0);
    expect(p2).toBeCloseTo(pOf(len2), 1);
    expect(p2).toBeLessThan(Number(roll.params.p) / 4);
    expect(harnessNodes(g2.state, "m1")).toHaveLength(1);
  });
});

describe("CR-19 uphill ×1.5", () => {
  it("the same 38° slope gives 1.5× reach uphill", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    g.state.members.m3.pos.s = 15;
    const up = terrainReach(data, g.state, "m3", 1);
    const down = terrainReach(data, g.state, "m3", -1);
    expect(up).toBeCloseTo(down * data.rules.moveModifiers.uphill, 5);
  });
});

describe("CR-22 untie after «Сам!»", () => {
  it("self-secured climber who shouted «Сам!» unties on the next step and the belay ends without P6", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    leaderOnBelay(g);
    climbTo(g, "m1", 21);
    g.step({ m1: { kind: "make_base", basePointId: "bp_mid", construction: "bolt" } });
    g.step({ m1: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: base(g, "bp_mid") } } });
    const node = harnessNodes(g.state, "m1")[0];
    const untie: ActionParams = { kind: "detach", what: { kind: "untie", ropeId: node.rope.ropeId, nodeId: node.node.id } };
    expect(engine.validatePlan(g.state, [{ memberId: "m1", params: untie }]).members.m1.reasonKey).toBe("reason.still_on_belay");
    g.step({ m1: say("secured") });
    const ev = g.step({ m1: untie });
    expect(ev.some((e) => e.messageKey === "event.belay_ended_by_climber")).toBe(true);
    expect(Object.keys(g.state.belays)).toEqual([]);
    expect(g.state.stats.commands.violations.P6).toBeUndefined();
    // braking items went back to the belayer: nothing is left in use by the belay
    expect(Object.values(g.state.items).some((i) => i.location.kind === "in_use" && i.location.structure.kind === "belay")).toBe(false);
  });
});

describe("CR-23 friction hitch on a fixed rope", () => {
  it("every grabbing knot is correct for self-belay and moving does not load the anchor knots", () => {
    for (const k of data.knots.filter((x) => x.category === "grabbing")) expect(engine.evaluateKnot({ knotId: k.id, context: "SELF_BELAY_GRAB", control: "double", turns: k.minTurns ?? null, ropeDiameterMm: 10, cordDiameterMm: 6, cordLooped: true, lockingCarabiners: 1, carabiners: 1 }).rating, k.id).toBe("correct");
    const g = new Game(scenario({ hill: steepHill(45, "ground") }));
    const { target } = fixedRope(g);
    g.step({ m3: { kind: "attach", method: "grabbing_knot", target, knot: K("prusik_odnym") } });
    const ev = g.step({ m3: mv(2) }, { "fall:terrain:m3": true, "static:*": true });
    expect(ev.some((e) => e.type === "knot.failed" || e.type.startsWith("fall."))).toBe(false);
    expect(belayableSegments(g.state).some((x) => x.ropeId === target.ropeId)).toBe(true);
  });
});

describe("CR-21 / CR-24", () => {
  it("control knots default to correct; there is no drop action", async () => {
    const { controlFor } = await import("../../../src/engine/knots/evaluate");
    expect(controlFor(data.knots.find((k) => k.id === "pryamyi"))).toBe("double");
    expect(controlFor(data.knots.find((k) => k.id === "prusik"))).toBe("none");
    const { ACTIONS } = await import("../../../src/engine/actions/defs");
    expect(Object.keys(ACTIONS)).not.toContain("drop");
  });
});

describe("CR-26 belay sequence", () => {
  it("the belayer must be self-secured at a base before setting up the belay", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    const rope = g.item("rope", "m2").id;
    g.step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" }, m2: { kind: "pass", toMemberId: "m1", itemIds: [rope] } });
    g.step({ m1: { kind: "tie_in", ropeId: rope, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } });
    const v = engine.validatePlan(g.state, [{ memberId: "m2", params: { kind: "belay", climberId: "m1", braking: "knot", knot: K("uiaa"), anchor: "body" } }]);
    expect(v.members.m2.reasonKey).toBe("reason.belayer_not_secured");
  });

  it("no P1 for a belay set up this step; before «Страховка готова!» the belay does not hold", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    leaderOnBelay(g, { sameStep: true });
    g.step({ m2: { kind: "belay", climberId: "m1", braking: "knot", knot: K("uiaa"), anchor: "base" }, m1: mv(1) });
    expect(g.state.stats.commands.violations.P1).toBeUndefined();
    climbTo(g, "m1", 12);
    expect(g.state.stats.commands.violations.P1).toBe(1);
    const ev = g.step({ m1: mv(1) }, { "fall:terrain:m1": true, "injury:m1": false });
    expect(ev.some((e) => e.type === "belay.not_ready")).toBe(true);
    expect(ev.some((e) => e.type === "fall.unprotected")).toBe(true);
  });
});

describe("CR-29 anchor knots", () => {
  it("Зустрічна вісімка and Булінь are correct around a tree; direct knots around rock are one step worse", () => {
    const rate = (ctx: "ANCHOR_THICK" | "ANCHOR_ROCK", knotId: string) => engine.evaluateKnot({ knotId, context: ctx, control: "double", turns: null, lockingCarabiners: 0, carabiners: 0, support: "thick" }).rating;
    expect(rate("ANCHOR_THICK", "zustrichna_visimka")).toBe("correct");
    expect(rate("ANCHOR_THICK", "bulin")).toBe("correct");
    expect(rate("ANCHOR_ROCK", "zustrichna_visimka")).toBe("acceptable");
    expect(rate("ANCHOR_ROCK", "bulin")).toBe("acceptable");
    const g = new Game(scenario({ hill: preset("skhyl-z-derevamy") }));
    expect(anchorContext(g.state, { id: "b", basePointId: "bp_mid2", pos: { obstacleIndex: 0, s: 61 }, construction: "direct", itemIds: [], carabinerId: null, builtBy: "m1", step: 0 })).toBe("ANCHOR_ROCK");
  });
});

describe("CR-37 free commands / CR-36 «Зрозумів.»", () => {
  it("a member moves and shouts in the same step; the command is not a step", () => {
    const g = new Game(scenario({ hill: flatHillLocal() }));
    const from = g.s("m1");
    g.step({ m1: [mv(2), say("understood")] });
    expect(g.s("m1")).toBeGreaterThan(from);
    expect(g.state.protocol.recent.some((c) => c.memberId === "m1" && c.command === "understood")).toBe(true);
    expect(g.state.stats.members.m1.activeSteps).toBe(1);
    expect(g.state.stats.members.m1.commands).toBe(1);
  });
});

describe("CR-33 belay options", () => {
  it("none unless clipped to a base; then base anchor only and only enabled ones", () => {
    const g = new Game(scenario({ hill: steepHill(38, "ground") }));
    leaderOnBelay(g, { sameStep: true }); // m1 tied in, m2 clipped to the start base
    const belayOpts = (m: string) => engine.getActionOptions(g.state, m).filter((o) => o.params.kind === "belay");
    expect(belayOpts("m3")).toEqual([]);
    const opts = belayOpts("m2");
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o.enabled && o.params.kind === "belay" && o.params.anchor === "base")).toBe(true);
  });
});

// ---------------------------------------------------------------- helpers

function flatHillLocal() {
  return preset("pologyi-travianystyi");
}

function kit(t: MemberConfig[]): ItemConfig[] {
  return buildKit(data, kits[0], t, "summer");
}

export const _unused: ActionParams[] = [];
export { CALM };
