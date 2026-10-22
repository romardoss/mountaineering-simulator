// One test per accountability rule (§9.2.7).
import { describe, expect, it } from "vitest";
import { checkInvariants, checkTransition } from "../../../src/engine/invariants/invariants";
import type { GameState } from "../../../src/engine/model/types";
import { data, Game, K, scenario, steepHill } from "../dsl";

function fresh(): GameState {
  return structuredClone(new Game(scenario({ hill: steepHill() })).state);
}

const rules = (s: GameState) => checkInvariants(data, s).map((v) => v.rule);

describe("§9.2 invariants", () => {
  it("a fresh game is clean", () => {
    expect(checkInvariants(data, fresh())).toEqual([]);
  });
  it("9.2.2 — the item id set never changes (no spawning / deletion)", () => {
    const s = fresh();
    delete s.items[Object.keys(s.items)[0]];
    expect(rules(s)).toContain("9.2.2");
    const t = fresh();
    t.items.ghost = { ...Object.values(t.items)[0], id: "ghost" };
    expect(rules(t)).toContain("9.2.2");
  });
  it("9.2.1 — every item has exactly one valid location", () => {
    const s = fresh();
    const id = Object.keys(s.items)[0];
    s.items[id].location = { kind: "in_use", structure: { kind: "base", baseId: "nope" } };
    expect(rules(s)).toContain("9.2.1");
    const t = fresh();
    t.items[Object.keys(t.items)[0]].location = { kind: "carried", memberId: "nobody" };
    expect(rules(t)).toContain("9.2.1");
  });
  it("9.2.3 — no teleportation: only an adjacent member may take an item", () => {
    const g = new Game(scenario({ hill: steepHill() }));
    for (let i = 0; i < 4; i++) g.step({ m1: { kind: "move", toward: "finish", distanceM: 5 } });
    const prev = g.state;
    const next = structuredClone(prev);
    const cord = Object.values(next.items).find((i) => i.type === "cord" && i.location.kind === "carried" && i.location.memberId === "m2")!;
    cord.location = { kind: "carried", memberId: "m1" };
    expect(checkTransition(data, prev, next).map((v) => v.rule)).toContain("9.2.3");
  });
  it("9.2.4 — a rope cannot be longer than its length", () => {
    const g = new Game(scenario({ hill: steepHill() }));
    const rope = g.item("rope", "m2").id;
    g.step({ m2: { kind: "pass", toMemberId: "m1", itemIds: [rope] } });
    g.step({ m1: { kind: "tie_in", ropeId: rope, knot: K("providnyk_visimka_odnym"), viaCarabiner: false } });
    const s = structuredClone(g.state);
    s.ropes[rope].nodes[1].pos.s = 3 + 80;
    expect(rules(s)).toContain("9.2.4");
  });
  it("9.2.5 — a carabiner holds at most maxThingsPerCarabiner", () => {
    const g = new Game(scenario({ hill: steepHill() }));
    g.step({ m1: { kind: "make_base", basePointId: "bp_start", construction: "sling" } });
    const s = structuredClone(g.state);
    const base = Object.values(s.bases)[0];
    const ropeIds = Object.values(s.items).filter((i) => i.type === "rope").map((i) => i.id);
    for (const r of ropeIds) {
      s.items[r].location = { kind: "in_use", structure: { kind: "rope", ropeId: r } };
      s.ropes[r] = { ropeId: r, nodes: [0, 1].map((k) => ({ id: `${r}n${k}`, pos: { obstacleIndex: 0, s: 3 }, attach: { kind: "base", baseId: base.id, mode: "running" } })) };
    }
    expect(rules(s)).toContain("9.2.5");
  });
  it("9.5.2.4 — nobody carries more than maxKg", () => {
    const s = fresh();
    s.members.m1.baseWeightKg = 40;
    expect(rules(s)).toContain("9.5.2.4");
  });
  it("random play never breaks invariants", () => {
    const g = new Game(scenario({ hill: steepHill(30, "scree") }), {});
    // resolveStep throws InvariantViolation in test mode
    for (let i = 0; i < 25 && g.state.outcome === "in_progress"; i++) {
      g.stepRaw({ m1: { kind: "move", toward: "finish", distanceM: 3 }, m2: { kind: "move", toward: "finish", distanceM: 2 }, m3: { kind: "command", command: "rock", recipient: "all" } });
    }
    expect(checkInvariants(data, g.state)).toEqual([]);
  });
});
