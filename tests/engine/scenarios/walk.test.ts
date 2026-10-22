import { describe, expect, it } from "vitest";
import { Game, flatHill, mv, scenario, engine } from "../dsl";

describe("M1: five members walk up a gentle hill", () => {
  it("wins with no falls", () => {
    const g = new Game(scenario({ hill: flatHill() }));
    const ids = ["m1", "m2", "m3", "m4", "m5"];
    for (let i = 0; i < 30 && g.state.outcome === "in_progress"; i++) {
      g.step(Object.fromEntries(ids.map((id) => [id, mv()])));
    }
    expect(g.state.outcome).toBe("won");
    expect(g.state.stats.falls.total).toBe(0);
    expect(g.state.stats.members.m1.activeSteps).toBeGreaterThan(0);
    expect(g.state.simTimeS).toBeGreaterThan(0);
    // gentle (≤15°) walking: 6 m per step, ×1.5 uphill (CR-19) → 54 m in at least 5 steps
    const first = g.history.length;
    expect(first).toBeGreaterThanOrEqual(5);
  });

  it("replays deterministically", () => {
    const g = new Game(scenario({ hill: flatHill() }), {});
    for (let i = 0; i < 5; i++) g.step({ m1: mv(), m2: mv(), m3: mv() });
    const again = engine.replay(g.sc, g.history, {});
    expect(again).toEqual(g.state);
  });
});
