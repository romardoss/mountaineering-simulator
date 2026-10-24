// Ravine «яр» (CR-52 … CR-67): first crossing on belay through the ravine, перила tied with an удавка
// on the start bank and a штик on the finish bank, «Два штики!», one «Тягнемо!» tensions and ties
// them off, crossings with a супровід, the last one rigs a здьорг.
import { describe, expect, it } from "vitest";
import type { ActionParams, GameState } from "../../../src/engine/model/types";
import { crossingsOf, gapSegmentOf, onTraverse } from "../../../src/engine/model/selectors";
import { engine, Game, K, mv, preset, say, scenario } from "../dsl";

const tieKnot = K("providnyk_visimka_odnym");
const startKnot = K("karabinna_udavka");
const finishKnot = K("shtyk_tovsta", "none", 4);

function ravine() {
  return new Game(scenario({ hill: preset("skelnyi-yar") }));
}

function perila(g: Game, ropeId: string) {
  const seg = gapSegmentOf(g.state, ropeId)!;
  return { kind: "segment" as const, ropeId, lowerNodeId: seg.lowerNodeId, upperNodeId: seg.upperNodeId };
}

function nodeOf(g: Game, ropeId: string, pred: (attach: { kind: string; memberId?: string }) => boolean) {
  return g.state.ropes[ropeId].nodes.find((n) => pred(n.attach as { kind: string; memberId?: string }))!;
}

function attachmentOf(g: Game, m: string) {
  return Object.values(g.state.attachments).find((a) => a.memberId === m)!.id;
}

/** A free end of `ropeId` next to member `m`, taken by hand (CR-65). */
function takeEnd(g: Game, m: string, ropeId: string): ActionParams {
  const here = g.s(m);
  const n = g.state.ropes[ropeId].nodes.find((x) => x.attach.kind === "free" && Math.abs(x.pos.s - here) <= 2)!;
  return { kind: "take_end", ropeId, nodeId: n.id };
}

/** m1 crosses through the ravine on belay with the перила rope tied to their harness; перила fixed on both banks. */
function firstCrossing(g: Game) {
  const q = g.item("rope", "m2").id; // belay rope, later the супровід
  const r = g.item("rope", "m3").id; // перила
  const step = (plan: Record<string, ActionParams | ActionParams[]>) => g.step(plan);
  step({ m1: mv(3), m2: mv(3), m3: mv(3), m4: mv(3), m5: mv(3) });
  step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" }, m2: { kind: "pass", toMemberId: "m1", itemIds: [q] }, m3: { kind: "pass", toMemberId: "m1", itemIds: [r] } });
  step({ m1: { kind: "tie_in", ropeId: q, knot: tieKnot, viaCarabiner: false } });
  step({ m1: { kind: "tie_in", ropeId: r, knot: tieKnot, viaCarabiner: false }, m2: { kind: "belay", climberId: "m1", braking: "device", anchor: "base" } });
  step({ m3: { kind: "fix_rope", ropeId: r, baseId: g.base("bp_start").id, method: "knot", knot: startKnot }, m2: say("belay_ready"), m1: say("go") });
  g.walk(["m1"], 45);
  step({ m1: { kind: "make_base", basePointId: "bp_finish", construction: "sling" } });
  step({ m1: { kind: "fix_rope", ropeId: r, baseId: g.base("bp_finish").id, method: "knot", knot: finishKnot } });
  step({ m1: [{ kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: g.base("bp_finish").id } }, say("secured")] });
  step({ m1: { kind: "detach", what: { kind: "untie", ropeId: q, nodeId: nodeOf(g, q, (a) => a.kind === "member_harness").id } } });
  step({ m1: [{ kind: "detach", what: { kind: "attachment", attachmentId: attachmentOf(g, "m1") } }, say("two_hitches")] });
  return { q, r };
}

/** Поліспаст at the start bank, then one «Тягнемо!»: everybody within 10 m pulls, the перила are tied off. */
function tension(g: Game, r: string, ratio = 3) {
  // the builder's own two carabiners go into the поліспаст: m4 lends one for the lanyard later
  const cb = g.item("carabiner", "m4").id;
  g.step({ m3: { kind: "build_pulley", ropeId: r, ratio }, m4: { kind: "pass", toMemberId: "m3", itemIds: [cb] } });
  return g.step({ m2: say("tension") });
}

/** One member crosses on the перила with a супровід held by `holder`. */
function cross(g: Game, m: string, r: string, q: string, holder: string) {
  g.step({ [m]: { kind: "tie_in", ropeId: q, knot: tieKnot, viaCarabiner: false } });
  g.step({ [holder]: takeEnd(g, holder, q), [m]: { kind: "attach", method: "lanyard_carabiner", target: perila(g, r) } });
  g.walk([m], 45);
  g.step({ [m]: { kind: "detach", what: { kind: "untie", ropeId: q, nodeId: nodeOf(g, q, (a) => a.kind === "member_harness").id } } });
  g.step({ [m]: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentOf(g, m) } } });
}

function haul(g: Game, m: string, q: string) {
  g.step({ [m]: { kind: "detach", what: { kind: "haul", ropeId: q } } });
}

/** Crosses m2, m3, m4 with the супровід held on the start bank, hauled back in between. */
function crossMiddle(g: Game, q: string, r: string) {
  haul(g, "m4", q);
  cross(g, "m2", r, q, "m4");
  haul(g, "m4", q);
  cross(g, "m3", r, q, "m4");
  haul(g, "m4", q);
  cross(g, "m4", r, q, "m5");
}

describe("ravine «яр»", () => {
  it("the preset is a valid ravine: descent, bottom, ascent, banks at the same height", () => {
    const g = ravine();
    expect(g.state.scenario.route.obstacles[0].type).toBe("ravine");
    expect(g.s("m1")).toBe(2);
  });

  it("first crossing on belay through the ravine with a second rope tied on (CR-53)", () => {
    const g = ravine();
    const { r } = firstCrossing(g);
    expect(g.s("m1")).toBeGreaterThanOrEqual(44);
    expect(gapSegmentOf(g.state, r)).toBeTruthy();
    expect(g.state.stats.falls.total).toBe(0);
  });

  it("перила knots around the trees: штик on the finish bank (thick preferred), удавка on the start bank, провідники unsuitable (CR-64)", () => {
    const g = ravine();
    const { r } = firstCrossing(g);
    const knots = Object.values(g.state.knots).filter((k) => k.itemId === r);
    expect(knots.map((k) => [k.context, k.knotId, k.evaluation.rating]).sort()).toEqual([
      ["PERILA_FINISH", "shtyk_tovsta", "correct"],
      ["PERILA_START", "karabinna_udavka", "correct"],
    ]);
    const ev = (knotId: string, context: "PERILA_FINISH" | "PERILA_START") => engine.evaluateKnot({ knotId, context, control: "double", turns: 4, lockingCarabiners: 1, carabiners: 1, support: "thick" });
    expect(ev("shtyk_tonka", "PERILA_FINISH").rating).toBe("correct");
    expect(ev("shtyk_tonka", "PERILA_FINISH").messages.map((m) => m.key)).toContain("knot.msg.prefer_shtyk_tovsta");
    for (const c of ["PERILA_FINISH", "PERILA_START"] as const) expect(ev("providnyk_visimka", c).rating).toBe("wrong");
  });

  it("one «Тягнемо!» after «Два штики!»: everybody within 10 m comes and pulls, the перила are tied off (CR-66, CR-67)", () => {
    const g = ravine();
    const q = g.item("rope", "m2").id;
    const r = g.item("rope", "m3").id;
    // a finish-bank «Два штики!» is needed first
    const s0 = firstCrossingWithoutReport(g, q, r);
    g.step({ m3: { kind: "build_pulley", ropeId: r, ratio: 3 } });
    let ev = g.step({ m2: say("tension") });
    expect(ev.some((e) => e.messageKey === "event.tension_no_two_hitches")).toBe(true);
    expect(crossingsOf(g.state)[r].tension).toBe(0);
    g.step({ m1: say("two_hitches") });
    // m5 strolls back 3.5 m (still within 10 m of the поліспаст): they walk over on the command
    g.step({ m5: mv(3.5, "start") });
    expect(g.s("m5")).toBeCloseTo(s0 - 3.5, 1);
    ev = g.step({ m2: say("tension") });
    const c = crossingsOf(g.state)[r];
    expect(ev.find((e) => e.type === "pulley.tensioned")?.refs.members?.sort()).toEqual(["m2", "m3", "m4", "m5"]);
    expect(c.tension).toBe(12);
    expect(c.secured).toBe(true);
    expect(Math.abs(g.s("m5") - g.base("bp_start").pos.s)).toBeLessThanOrEqual(2);
  });

  it("the поліспаст ratio is chosen (1:2 / 1:3 / 1:4) and sets the tension per puller (CR-61)", () => {
    const tensionWith = (ratio: number) => {
      const g = ravine();
      const { r } = firstCrossing(g);
      tension(g, r, ratio);
      return crossingsOf(g.state)[r];
    };
    expect(tensionWith(2).tension).toBe(8);
    expect(tensionWith(4).tension).toBe(16);
    const g = ravine();
    const { r } = firstCrossing(g);
    expect(engine.validatePlan(g.state, [{ memberId: "m3", params: { kind: "build_pulley", ropeId: r, ratio: 5 } }]).members.m3.reasonKey).toBe("reason.pulley_ratio");
    expect(engine.getActionOptions(g.state, "m3").filter((o) => o.params.kind === "build_pulley").map((o) => (o.params as { ratio: number }).ratio)).toEqual([2, 3, 4]);
  });

  it("crossing needs secured перила and a супровід; it moves along the span; weak tension sags (CR-55, CR-56)", () => {
    const g = ravine();
    const { q, r } = firstCrossing(g);
    haul(g, "m4", q);
    g.step({ m2: { kind: "tie_in", ropeId: q, knot: tieKnot, viaCarabiner: false } });
    g.step({ m2: { kind: "attach", method: "lanyard_carabiner", target: perila(g, r) } });
    expect(engine.validatePlan(g.state, [{ memberId: "m2", params: mv(5) }]).members.m2.reasonKey).toBe("reason.traverse_not_secured");
    g.step({ m3: { kind: "build_pulley", ropeId: r, ratio: 2 } });
    // nobody pulls while someone is clipped to the перила
    let ev = g.step({ m3: say("tension") });
    expect(ev.some((e) => e.messageKey === "event.tension_traverse_busy")).toBe(true);
    g.step({ m2: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentOf(g, "m2") } } });
    // m5 steps back to the end of the bank, 6 m from the поліспаст — still within 10 m (CR-70): 4 pull a 1:2 → 8, weak
    g.step({ m5: mv(5.5, "start") });
    ev = g.step({ m3: say("tension") });
    expect(ev.find((e) => e.type === "pulley.tensioned")?.refs.members).toContain("m5");
    expect(ev.find((e) => e.type === "pulley.tensioned")?.params.tension).toBe(8);
    expect(ev.find((e) => e.type === "pulley.tensioned")?.params.quality).toBe("weak");
    g.step({ m2: { kind: "attach", method: "lanyard_carabiner", target: perila(g, r) } });
    expect(engine.validatePlan(g.state, [{ memberId: "m2", params: mv(5) }]).members.m2.reasonKey).toBe("reason.no_escort");
    g.step({ m4: takeEnd(g, "m4", q) });
    const from = g.s("m2");
    g.step({ m2: mv(99) });
    g.step({ m2: mv(99) });
    expect(onTraverse(g.state, "m2")).toBe(true);
    expect(g.state.stats.mistakes.some((x) => x.key === "summary.traverse_sag")).toBe(true);
    expect(g.s("m2")).toBeGreaterThan(from);
    g.walk(["m2"], 45);
    expect(g.state.stats.falls.total).toBe(0);
  });

  it("whole crossing: супровід, здьорг by the last, everything retrieved → victory (CR-57, CR-58)", () => {
    const g = ravine();
    const { q, r } = firstCrossing(g);
    tension(g, r);
    expect(crossingsOf(g.state)[r].secured).toBe(true);
    g.step({ m3: say("fixed_rope_ready") });
    crossMiddle(g, q, r);
    // last one: супровід held from the finish bank, it doubles as the здьорг
    g.step({ m5: { kind: "detach", what: { kind: "release", ropeId: q, nodeId: nodeOf(g, q, (a) => a.kind === "held").id } } });
    g.step({ m5: { kind: "tie_in", ropeId: q, knot: tieKnot, viaCarabiner: false } });
    g.step({ m1: takeEnd(g, "m1", q) });
    g.step({ m5: { kind: "rig_retrieval", ropeId: r, pullRopeId: q } });
    g.step({ m5: { kind: "attach", method: "lanyard_carabiner", target: perila(g, r) } });
    g.walk(["m5"], 45);
    g.step({ m5: { kind: "detach", what: { kind: "untie", ropeId: q, nodeId: nodeOf(g, q, (a) => a.kind === "member_harness").id } } });
    g.step({ m5: { kind: "detach", what: { kind: "attachment", attachmentId: attachmentOf(g, "m5") } } });
    expect(g.state.outcome).toBe("in_progress"); // the перила still hang on the start bank
    expect(engine.getStats(g.state).itemsLeft.length).toBeGreaterThan(0);
    g.step({ m1: { kind: "retrieve", ropeId: r } });
    expect(engine.getStats(g.state).itemsLeft).toEqual([]);
    expect(g.state.outcome).toBe("won");
    expect(engine.getStats(g.state).penalties?.score).toBe(100);
    expect(JSON.stringify(g.replay())).toBe(JSON.stringify(g.state));
  });

  it("without retrieval the level can be finished with penalties for the lost gear (CR-58)", () => {
    const g = ravine();
    const { q, r } = firstCrossing(g);
    tension(g, r);
    crossMiddle(g, q, r);
    g.step({ m5: { kind: "detach", what: { kind: "release", ropeId: q, nodeId: nodeOf(g, q, (a) => a.kind === "held").id } } });
    g.step({ m5: { kind: "tie_in", ropeId: q, knot: tieKnot, viaCarabiner: false } });
    g.step({ m1: takeEnd(g, "m1", q), m5: { kind: "attach", method: "lanyard_carabiner", target: perila(g, r) } });
    expect(engine.canFinishLevel(g.state)).toBe(false);
    g.walk(["m5"], 45);
    g.step({ m5: { kind: "detach", what: { kind: "untie", ropeId: q, nodeId: nodeOf(g, q, (a) => a.kind === "member_harness").id } } });
    expect(g.state.outcome).toBe("in_progress");
    expect(engine.canFinishLevel(g.state)).toBe(true);
    const done: GameState = engine.finishLevel(g.state);
    expect(done.outcome).toBe("completed");
    const p = engine.getStats(done).penalties!;
    // left on the start bank: перила, base sling + carabiner, поліспаст (2 carabiners + prusik)
    expect(p.items.map((i) => i.type).sort()).toEqual(["carabiner", "carabiner", "carabiner", "cord", "rope", "sling"]);
    expect(p.score).toBe(100 - 20 - 5 - 3 * 3 - 3);
  });

  it("the last participant alone may rig the здьорг (CR-57)", () => {
    const g = ravine();
    const { r } = firstCrossing(g);
    tension(g, r);
    const v = engine.validatePlan(g.state, [{ memberId: "m3", params: { kind: "rig_retrieval", ropeId: r, pullRopeId: g.item("rope", "m3")?.id ?? "x" } }]);
    expect(v.members.m3.reasonKey).toBe("reason.not_last");
  });
});

/** firstCrossing without the closing «Два штики!»; returns where the start-bank members stand. */
function firstCrossingWithoutReport(g: Game, q: string, r: string): number {
  g.step({ m1: mv(3), m2: mv(3), m3: mv(3), m4: mv(3), m5: mv(3) });
  g.step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" }, m2: { kind: "pass", toMemberId: "m1", itemIds: [q] }, m3: { kind: "pass", toMemberId: "m1", itemIds: [r] } });
  g.step({ m1: { kind: "tie_in", ropeId: q, knot: tieKnot, viaCarabiner: false } });
  g.step({ m1: { kind: "tie_in", ropeId: r, knot: tieKnot, viaCarabiner: false }, m2: { kind: "belay", climberId: "m1", braking: "device", anchor: "base" } });
  g.step({ m3: { kind: "fix_rope", ropeId: r, baseId: g.base("bp_start").id, method: "knot", knot: startKnot }, m2: say("belay_ready"), m1: say("go") });
  g.walk(["m1"], 45);
  g.step({ m1: { kind: "make_base", basePointId: "bp_finish", construction: "sling" } });
  g.step({ m1: { kind: "fix_rope", ropeId: r, baseId: g.base("bp_finish").id, method: "knot", knot: finishKnot } });
  return g.s("m5");
}

describe("«Взяти кінець мотузки» (CR-65)", () => {
  it("a free end of a laid-out rope is taken without a knot and carried; the rope length still limits the walk", async () => {
    const { flatHill, makeItem, data } = await import("../dsl");
    const g = new Game(scenario({ hill: flatHill(), n: 2, items: (t) => [makeItem(data, "rope_a", "rope", { lengthM: 20 }, { memberId: t[0].id, as: "carried" })] }));
    g.step({ m1: { kind: "tie_in", ropeId: "rope_a", knot: tieKnot, viaCarabiner: false } });
    const opt = engine.getActionOptions(g.state, "m2").find((o) => o.params.kind === "take_end");
    expect(opt?.enabled).toBe(true);
    g.step({ m2: opt!.params });
    expect(g.state.knots && Object.values(g.state.knots).filter((k) => k.itemId === "rope_a")).toHaveLength(1); // only m1's tie-in
    g.walk(["m2"], 15);
    const held = g.state.ropes.rope_a.nodes.find((n) => n.attach.kind === "held")!;
    expect(held.pos.s).toBeCloseTo(g.s("m2"), 5);
    // 20 m rope, 1 m for m1's knot: m2 cannot get further than 19 m from m1
    for (let i = 0; i < 10; i++) g.stepRaw({ m2: mv(10) });
    expect(g.s("m2") - g.s("m1")).toBeLessThanOrEqual(19.01);
  });
});

describe("commands shouted at once (CR-72)", () => {
  it("«Тягнемо!» tensions the перила right away, without a step; replay gives the same state", () => {
    const g = ravine();
    const { r } = firstCrossing(g);
    g.step({ m3: { kind: "build_pulley", ropeId: r, ratio: 3 } });
    const before = g.state;
    const res = engine.shout(g.state, "m2", say("tension"));
    expect(res.state.step).toBe(before.step);
    expect(res.state.simTimeS).toBe(before.simTimeS);
    expect(crossingsOf(res.state)[r].secured).toBe(true);
    expect(new Set(res.events.map((e) => e.id)).size).toBe(res.events.length);
    // the next step's events do not clash with the shout's ids
    const next = engine.resolveStep(res.state, [{ memberId: "m4", params: { kind: "skip" } }]).state;
    expect(new Set(next.log.map((e) => e.id)).size).toBe(next.log.length);
    const history = [...g.history, { shout: { memberId: "m2", params: say("tension") } }];
    expect(JSON.stringify(engine.replay(g.sc, history, { rolls: g.rolls }))).toBe(JSON.stringify(res.state));
  });
});

describe("rope actions of the hover rope icon (CR-62, CR-70)", () => {
  it("include self-belay, belay and bases as well as the actions with a rope (CR-71)", async () => {
    const { isRopeAction } = await import("../../../src/engine/actions/options");
    const yes: ActionParams[] = [
      { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: "b1" } },
      { kind: "belay", climberId: "m1", braking: "device", anchor: "base" },
      { kind: "stop_belay", belayId: "y1" },
      { kind: "tie_in", ropeId: "r", knot: tieKnot, viaCarabiner: false },
      { kind: "take_end", ropeId: "r", nodeId: "n1" },
      { kind: "make_base", basePointId: "bp", construction: "sling" },
      { kind: "detach", what: { kind: "dismantle_base", baseId: "b1" } },
    ];
    const no: ActionParams[] = [{ kind: "pass", toMemberId: "m2", itemIds: [] }, { kind: "skip" }];
    for (const p of yes) expect(isRopeAction({ params: p }), p.kind).toBe(true);
    for (const p of no) expect(isRopeAction({ params: p }), p.kind).toBe(false);
  });
});
