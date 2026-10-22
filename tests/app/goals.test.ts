// CR-18: a right-click goal is walked over several steps and cleared by another action.
import { describe, expect, it } from "vitest";
import { animating, session } from "../../src/app/store";
import { executeStep, planMoveTo, setPlannedAction, startGame } from "../../src/app/controller";
import { flatHill, scenario } from "../engine/dsl";

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

describe("CR-37 command slot", () => {
  it("a command does not replace the planned action and both are sent", async () => {
    const { planList } = await import("../../src/app/controller");
    startGame(scenario({ hill: flatHill(), n: 2 }));
    planMoveTo("m1", 12);
    setPlannedAction("m1", { kind: "command", command: "understood", recipient: "all" });
    expect(session.value!.plan.m1.kind).toBe("move");
    expect(session.value!.goals.m1).toBe(12);
    expect(planList(session.value!).filter((p) => p.memberId === "m1").map((p) => p.params.kind).sort()).toEqual(["command", "move"]);
    step();
    expect(session.value!.commands).toEqual({});
    expect(session.value!.state.protocol.recent.some((c) => c.command === "understood")).toBe(true);
  });
});
