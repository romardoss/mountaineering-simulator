// Configuration rules: CR-2 (base spots), CR-3 (no roles), CR-7 (weights from settings), CR-8 (no take-off), CR-10/12/14 (individual equipment), CR-11 (seasons, weather), legacy import.
import { describe, expect, it } from "vitest";
import { memberLoadKg, validateHill, validateTeam } from "../../../src/engine/scenario/validate";
import { startS } from "../../../src/engine/scenario/create";
import { validateScenarioJson } from "../../../src/app/persistence/importScenario";
import { ACTIONS } from "../../../src/engine/actions/defs";
import { mapSurface, surfaceAt } from "../../../src/engine/model/selectors";
import { basePointsOf } from "../../../src/engine/geometry/hill";
import { kits } from "../../../src/data/load";
import { buildKit, individualKg, isIndividual } from "../../../src/engine/scenario/kit";
import { data, engine, flatHill, makeItem, preset, scenario, team } from "../dsl";

const errors = (issues: { level: string; key: string }[]) => issues.filter((i) => i.level === "error").map((i) => i.key);

describe("CR-2 base spots", () => {
  it("a hill with only a finish base spot is valid and the game starts without bases", () => {
    const h = flatHill();
    h.basePoints = h.basePoints.filter((b) => b.id === "bp_top");
    expect(errors(validateHill(data, h))).toEqual([]);
    const sc = scenario({ hill: h });
    const st = engine.createGame(sc);
    expect(st.bases).toEqual({});
    expect(startS(sc)).toBe(h.startZoneM / 2);
  });

  it("a missing finish base spot is an error; a large tree there counts as one (CR-31)", () => {
    const h = flatHill();
    h.basePoints = h.basePoints.filter((b) => b.id === "bp_start");
    expect(errors(validateHill(data, h))).toEqual([]); // t2 (large) at the finish is a base spot
    // a new hill object, as the editors make (spots are memoised by identity)
    const small = { ...h, trees: h.trees.map((t) => (t.id === "t2" ? { ...t, size: "small" as const } : t)) };
    expect(errors(validateHill(data, small))).toEqual(["validate.no_finish_base"]);
  });

  it("every large tree without a configured spot is a base spot; small trees are not (CR-31)", () => {
    const h = preset("skhyl-z-derevamy"); // t2 large at 21, t4 small at 52, no base spots there
    const spots = basePointsOf(h);
    expect(spots.find((b) => b.id === "bp@t2")).toMatchObject({ s: 21, anchorType: "tree", treeId: "t2" });
    expect(spots.some((b) => b.treeId === "t4")).toBe(false);
    expect(spots.filter((b) => b.treeId === "t1")).toHaveLength(1); // configured spot, no duplicate
    const g = engine.createGame(scenario({ hill: h }));
    g.members.m1.pos.s = 21;
    expect(engine.getActionOptions(g, "m1").some((o) => o.params.kind === "make_base" && o.params.basePointId === "bp@t2" && o.enabled)).toBe(true);
  });

  it("the summit base spot is optional", () => {
    const h = preset("cherez-vershynu");
    const geo = { s0: h.startZoneM + h.sections.reduce((s, x) => s + x.lengthM, 0) };
    h.basePoints = h.basePoints.filter((b) => b.s < geo.s0 || b.s > geo.s0 + (h.summitZoneM ?? 6));
    expect(errors(validateHill(data, h))).toEqual([]);
  });

  it("presets start with no bases", () => {
    expect(engine.createGame(scenario()).bases).toEqual({});
  });
});

describe("CR-3 no roles", () => {
  it("any team without roles is valid", () => {
    expect(errors(validateTeam(data, team(2)))).toEqual([]);
  });

  it("the typical kit gives team gear to the first member in team order", () => {
    const sc = scenario({ n: 4 });
    const slings = sc.items.filter((i) => i.type === "sling");
    expect(slings.every((i) => i.assignedTo?.memberId === "m1")).toBe(true);
  });

  it("imported scenarios with a legacy role are accepted and the role is dropped", () => {
    const sc = scenario();
    const legacy = { ...sc, team: sc.team.map((m, i) => ({ ...m, role: i === 0 ? "leader" : "member" })) };
    const res = validateScenarioJson(JSON.parse(JSON.stringify(legacy)));
    expect(res.ok).toBe(true);
    expect(res.scenario!.team.every((m) => !("role" in m))).toBe(true);
  });
});

describe("CR-7 weights come only from scenario.weights", () => {
  it("member base weight and item weights are computed from the weight snapshot", () => {
    const sc = scenario({ season: "winter" });
    expect(engine.createGame(sc).members.m1.baseWeightKg).toBe(15);
    const heavy = { ...sc, weights: { ...sc.weights, backpackBaseKg: 20, helmetKg: 1 } };
    const st = engine.createGame(heavy);
    expect(Object.values(st.members).every((m) => m.baseWeightKg === 20)).toBe(true);
    expect(Object.values(st.items).filter((i) => i.type === "helmet").every((i) => i.weightKg === 1)).toBe(true);
  });

  it("legacy per-member and per-item weights are dropped on import", () => {
    const sc = scenario();
    const legacy = { ...sc, team: sc.team.map((m) => ({ ...m, baseWeightKg: 22 })), items: sc.items.map((i) => ({ ...i, weightKg: 9 })) };
    const res = validateScenarioJson(JSON.parse(JSON.stringify(legacy)));
    expect(res.ok).toBe(true);
    expect(res.scenario!.team.every((m) => !("baseWeightKg" in m))).toBe(true);
    expect(res.scenario!.items.every((i) => !("weightKg" in i))).toBe(true);
    expect(res.scenario!.weights.backpackBaseKg).toBe(data.weights.backpackBaseKg);
  });
});

describe("CR-8 no take-off", () => {
  it("there is no take_off action and worn items offer none", () => {
    expect(Object.keys(ACTIONS)).not.toContain("take_off");
    const st = engine.createGame(scenario());
    expect(engine.getActionOptions(st, "m1").some((o) => o.params.kind === ("take_off" as string))).toBe(false);
  });
});

describe("CR-10 / CR-12 implicit harness, helmet and belay gloves", () => {
  it("every member wears exactly one harness and one helmet without configuring them", () => {
    const sc = scenario({ items: () => [] });
    expect(sc.items.some((i) => i.type === "harness" || i.type === "helmet")).toBe(false);
    const st = engine.createGame(sc);
    for (const m of sc.team)
      for (const type of ["harness", "helmet", "gloves"]) {
        const worn = Object.values(st.items).filter((i) => i.type === type && i.location.kind === "worn" && i.location.memberId === m.id);
        expect(worn.length).toBe(1);
      }
  });

  it("configured harness / helmet items (old files) are ignored and their weight is counted once", () => {
    const sc = scenario({ n: 2, items: (t) => [makeItem(data, "h1", "helmet", {}, { memberId: t[0].id, as: "worn" })] });
    const st = engine.createGame(sc);
    expect(st.items.h1).toBeUndefined();
    const w = data.weights;
    expect(memberLoadKg(data, sc, "m1")).toBeCloseTo(w.backpackBaseKg + individualKg(data, w, sc.season), 6);
  });
});

describe("CR-11 seasons and weather", () => {
  const hill = () => preset("skhyl-z-derevamy"); // sections: grass, grass, ground, rock

  it("weather is rolled from the season: forced rain → mud and wet rock; forced dry → as configured", () => {
    const sc = scenario({ hill: hill(), season: "autumn" });
    const wet = engine.createGame(sc, { rolls: { "weather:rain": true } });
    expect(wet.weather).toBe("rain");
    expect(surfaceAt(wet, data, { obstacleIndex: 0, s: 10 })).toBe("mud");
    expect(surfaceAt(wet, data, { obstacleIndex: 0, s: 70 })).toBe("wet_rock");
    expect(wet.log[0]).toMatchObject({ type: "weather.set", messageKey: "event.weather.rain", step: 0 });
    const muddy = engine.createGame(sc, { rolls: { "weather:rain": false, "weather:mud": true } });
    expect(muddy.weather).toBe("mud");
    expect(surfaceAt(muddy, data, { obstacleIndex: 0, s: 10 })).toBe("grass");
    expect(surfaceAt(muddy, data, { obstacleIndex: 0, s: 50 })).toBe("mud");
    const dry = engine.createGame(sc, { rolls: { "weather:*": false } });
    expect(dry.weather).toBe("dry");
    expect(surfaceAt(dry, data, { obstacleIndex: 0, s: 10 })).toBe("grass");
  });

  it("weather is deterministic for a seed and winter never rains", () => {
    const sc = scenario({ season: "spring", seed: 7 });
    expect(engine.createGame(sc).weather).toBe(engine.createGame(sc).weather);
    for (let seed = 0; seed < 30; seed++) expect(engine.createGame(scenario({ season: "winter", seed })).weather).toBe("dry");
    expect(mapSurface(data, "winter", "rain", "grass")).toBe("snow");
  });

  it("every season has probabilities in [0, 1]; mud and wet rock are more slippery than dry", () => {
    for (const s of ["spring", "summer", "autumn", "winter"] as const) {
      const w = data.seasons.seasons[s];
      expect(w.pRain).toBeGreaterThanOrEqual(0);
      expect(w.pRain).toBeLessThanOrEqual(1);
      expect(w.pMud).toBeGreaterThanOrEqual(0);
      expect(w.pMud).toBeLessThanOrEqual(1);
    }
    expect(data.seasons.seasons.autumn.pRain).toBeGreaterThan(data.seasons.seasons.summer.pRain);
    const f = data.hazards.fall.surface;
    expect(f.mud).toBeGreaterThan(f.ground);
    expect(f.wet_rock).toBeGreaterThan(f.rock);
  });

  it("only winter adds crampons and ice axe to every member; the kit never contains individual gear", () => {
    const n = (season: "spring" | "autumn" | "winter") => Object.values(engine.createGame(scenario({ n: 3, season })).items).filter((i) => i.type === "crampons").length;
    expect(n("spring")).toBe(0);
    expect(n("autumn")).toBe(0);
    expect(n("winter")).toBe(3);
    expect(buildKit(data, kits[0], team(3), "winter").some((i) => ["gloves", "crampons", "cord", "belay_device", "lanyard"].includes(i.type))).toBe(false);
  });
});

describe("CR-14 individual equipment", () => {
  it("every member gets the same set: helmet, harness, gloves, belay device, ascender, lanyard and two prusik loops", () => {
    const sc = scenario({ n: 3, items: () => [] });
    const st = engine.createGame(sc);
    const count = (m: string, type: string, kind: "worn" | "carried") => Object.values(st.items).filter((i) => i.type === type && i.location.kind === kind && i.location.memberId === m).length;
    for (const m of ["m1", "m2", "m3"]) {
      expect([count(m, "helmet", "worn"), count(m, "harness", "worn"), count(m, "gloves", "worn")]).toEqual([1, 1, 1]);
      expect([count(m, "belay_device", "carried"), count(m, "ascender", "carried"), count(m, "lanyard", "carried"), count(m, "cord", "carried")]).toEqual([1, 1, 1, 2]);
    }
    expect(Object.values(st.items).filter((i) => i.type === "cord").every((i) => i.props.loopKnot?.knotId === "grapevine")).toBe(true);
    expect(st.stats.knots.preTied).toBe(6);
    expect(isIndividual(data, "cord")).toBe(true);
    expect(isIndividual(data, "carabiner")).toBe(false);
  });

  it("configured individual items (old files) are ignored and dropped on import", () => {
    const sc = scenario({ n: 2, items: (t) => [makeItem(data, "dev", "belay_device", {}, { memberId: t[0].id, as: "carried" })] });
    expect(engine.createGame(sc).items.dev).toBeUndefined();
    const res = validateScenarioJson(JSON.parse(JSON.stringify(sc)));
    expect(res.scenario!.items).toEqual([]);
  });
});
