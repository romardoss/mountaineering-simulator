// CR-18: a right-click goal is walked over several steps and cleared by another action.
import { describe, expect, it } from "vitest";
import { animating, session } from "../../src/app/store";
import { executeStep, planMoveTo, setPlannedAction, startGame } from "../../src/app/controller";
import { Game, flatHill, mv, scenario, steepHill } from "../engine/dsl";
import { nextGoals } from "../../src/app/controller";

function step() {
  executeStep();
  animating.value = false; // no renderer in tests
}

describe("CR-18 right-click goal", () => {
  it("walks to the point over several steps, then the goal ends", () => {
    startGame(scenario({ hill: flatHill(), n: 2 }));
    planMoveTo("m1", 20.04);
    expect(session.value!.goals.m1).toBe(20);
    expect(session.value!.plan.m1).toMatchObject({ kind: "move", toward: "finish", targetS: 20 });
    for (let i = 0; i < 10 && session.value!.goals.m1 !== undefined; i++) step();
    expect(session.value!.goals.m1).toBeUndefined();
    expect(session.value!.state.members.m1.pos.s).toBeCloseTo(20, 1);
    expect(session.value!.state.step).toBeGreaterThan(1);
  });

  it("another chosen action clears the goal; a click on the member's own spot plans nothing", () => {
    startGame(scenario({ hill: flatHill(), n: 2 }));
    planMoveTo("m2", 30);
    setPlannedAction("m2", { kind: "skip" });
    expect(session.value!.goals.m2).toBeUndefined();
    planMoveTo("m2", session.value!.state.members.m2.pos.s);
    expect(session.value!.plan.m2).toBeUndefined();
  });
});

describe("CR-63 goal after a fall", () => {
  it("a member who fell without injury keeps walking to the same point", () => {
    const g = new Game(scenario({ hill: steepHill(30, "ground"), n: 2 }));
    g.step({ m1: mv(3) });
    const prev = g.state;
    const plan = [{ memberId: "m1", params: { kind: "move" as const, toward: "finish" as const, distanceM: 20, targetS: 30 } }];
    const events = g.step({ m1: plan[0].params }, { "fall:terrain:m1": true, "injury:*": false });
    expect(events.some((e) => e.type === "fall.start")).toBe(true);
    expect(g.state.members.m1.status).not.toBe("injured");
    const next = nextGoals(prev, g.state, { m1: 30 }, plan, events);
    expect(next.goals.m1).toBe(30);
    expect(next.plan.m1).toMatchObject({ kind: "move", toward: "finish", targetS: 30 });
  });
});

describe("CR-72 commands are shouted at once", () => {
  it("a chosen command is shouted right away: no step, no time, the planned action stays", async () => {
    const { planList } = await import("../../src/app/controller");
    const { engine } = await import("../../src/app/store");
    startGame(scenario({ hill: flatHill(), n: 2 }));
    planMoveTo("m1", 12);
    const before = session.value!.state;
    setPlannedAction("m1", { kind: "command", command: "understood", recipient: "all" });
    animating.value = false;
    const after = session.value!.state;
    expect(after.step).toBe(before.step);
    expect(after.simTimeS).toBe(before.simTimeS);
    expect(after.protocol.recent.some((c) => c.command === "understood" && c.memberId === "m1")).toBe(true);
    expect(session.value!.plan.m1.kind).toBe("move");
    expect(planList(session.value!).map((p) => p.params.kind)).toEqual(["move"]);
    step();
    expect(session.value!.state.step).toBe(1);
    expect(session.value!.state.stats.members.m1.activeSteps).toBe(1);
    // the history replays the shout and the step to the same state
    expect(JSON.stringify(engine.replay(session.value!.scenario, session.value!.history))).toBe(JSON.stringify(session.value!.state));
  });
});
