// createGame (§20.3): validates a scenario and places team and items at the start.
import type { GameData } from "../data/types";
import { evaluateKnot } from "../knots/evaluate";
import { countKnot } from "../knots/instance";
import { basePointsOf, buildHillGeometry } from "../geometry/hill";
import { createRng, roll, type RollScript } from "../rng/rng";
import type {
  GameState,
  ItemState,
  KnotInstance,
  KnotRating,
  MemberStats,
  Scenario,
  StatsCounters,
  Weather,
} from "../model/types";
import { defaultWeight, individualKit, isIndividual, makeItem } from "./kit";
import { validateScenario } from "./validate";

export class ScenarioError extends Error {
  constructor(public readonly issues: { key: string; params?: Record<string, string | number> }[]) {
    super(`Invalid scenario: ${issues.map((i) => i.key).join(", ")}`);
  }
}

export function emptyMemberStats(): MemberStats {
  const knots: Record<KnotRating, number> = { correct: 0, acceptable: 0, wrong: 0, dangerous: 0 };
  return { activeSteps: 0, skippedSteps: 0, forcedSkips: 0, distanceUpM: 0, distanceDownM: 0, falls: 0, knots, commands: 0, maxWeightKg: 0, overloadedSteps: 0 };
}

export function emptyStats(memberIds: string[]): StatsCounters {
  return {
    steps: 0,
    falls: { total: 0, selfBelay: 0, belay: 0, unprotected: 0 },
    injuries: [],
    knots: { total: 0, correct: 0, acceptable: 0, wrong: 0, dangerous: 0, missingControl: 0, preTied: 0 },
    commands: { issued: 0, violations: {} },
    rockfall: { total: 0, warned: 0, hits: 0 },
    members: Object.fromEntries(memberIds.map((id) => [id, emptyMemberStats()])),
    knotHistory: [],
    mistakes: [],
  };
}

/** Start position: the start-zone base point, or the middle of the start zone. */
export function startS(scenario: Scenario): number {
  const hill = scenario.route.obstacles[0];
  const bp = basePointsOf(hill).find((b) => b.s <= hill.startZoneM);
  return bp ? bp.s : hill.startZoneM / 2;
}

export interface CreateOptions {
  /** Forces weather:rain / weather:mud (tests). */
  rolls?: RollScript;
}

export function createGame(data: GameData, scenario: Scenario, opts: CreateOptions = {}): GameState {
  const errors = validateScenario(data, scenario).filter((i) => i.level === "error");
  if (errors.length) throw new ScenarioError(errors);
  const sc: Scenario = structuredClone(scenario);
  buildHillGeometry(sc.route.obstacles[0]);
  const s0 = startS(sc);
  const members: GameState["members"] = {};
  for (const mc of sc.team) {
    members[mc.id] = {
      id: mc.id,
      name: mc.name,
      appearance: mc.appearance,
      abilities: {},
      baseWeightKg: sc.weights.backpackBaseKg,
      pos: { obstacleIndex: 0, s: s0 },
      status: "ok",
      forcedSkipNextStep: false,
    };
  }
  const items: GameState["items"] = {};
  // the same individual equipment for everybody (CR-14)
  for (const mc of sc.team) {
    for (const e of individualKit(data, sc.season)) {
      const n = e.count ?? 1;
      for (let k = 1; k <= n; k++) {
        const id = n > 1 ? `${e.type}@${mc.id}#${k}` : `${e.type}@${mc.id}`;
        const props = makeItem(data, id, e.type, structuredClone(e.props ?? {})).props;
        items[id] = { id, type: e.type, weightKg: defaultWeight(sc.weights, e.type, props), props, location: { kind: e.as, memberId: mc.id } };
      }
    }
  }
  for (const ic of sc.items) {
    if (!ic.assignedTo || isIndividual(data, ic.type)) continue; // §9.3.3: unassigned items are not taken
    const it: ItemState = { id: ic.id, type: ic.type, weightKg: defaultWeight(sc.weights, ic.type, ic.props), props: ic.props, location: { kind: ic.assignedTo.as, memberId: ic.assignedTo.memberId } };
    items[it.id] = it;
  }
  // weather: rolled once from the season (S§6.5, CR-11)
  const rng = createRng(sc.seed);
  const pw = data.seasons.seasons[sc.season];
  const rain = roll(rng, "weather:rain", pw.pRain, opts.rolls);
  const mud = roll(rng, "weather:mud", pw.pMud, opts.rolls);
  const weather: Weather = rain.hit ? "rain" : mud.hit ? "mud" : "dry";
  const state: GameState = {
    schemaVersion: 1,
    scenario: sc,
    step: 0,
    rng,
    outcome: "in_progress",
    simTimeS: 0,
    weather,
    members,
    items,
    ropes: {},
    knots: {},
    bases: {},
    attachments: {},
    belays: {},
    crossings: {},
    hazards: { pendingRockfalls: [] },
    protocol: { recent: [], belayReady: {}, climberGo: {}, climberSecured: {}, readySegments: {}, flagged: {} },
    stats: emptyStats(sc.team.map((m) => m.id)),
    log: [],
    nextId: 0,
    itemIds: Object.keys(items),
  };
  // Pre-tied cord loops count as pre-tied knots (§9.3.4).
  for (const it of Object.values(items)) {
    const loop = it.props.loopKnot;
    if (it.type !== "cord" || !loop) continue;
    state.nextId += 1;
    const k: KnotInstance = {
      id: `k${state.nextId}`,
      knotId: loop.knotId,
      context: "LOOP_CORD",
      control: loop.control,
      turns: null,
      tiedBy: null,
      step: 0,
      preTied: true,
      itemId: it.id,
      evaluation: evaluateKnot(data, { knotId: loop.knotId, context: "LOOP_CORD", control: loop.control, turns: null, lockingCarabiners: 0, carabiners: 0 }),
      revealed: sc.mode === "learning",
    };
    countKnot(state, data, k, null);
  }
  state.log.push({ id: "0:0", step: 0, phase: "setup", type: "weather.set", severity: weather === "dry" ? "info" : "warning", messageKey: `event.weather.${weather}`, params: { season: sc.season }, refs: { rolls: [rain, mud] } });
  for (const id of Object.keys(members)) state.stats.members[id].maxWeightKg = weightOf(state, id);
  return state;
}

function weightOf(state: GameState, id: string): number {
  const gear = Object.values(state.items).filter((it) => (it.location.kind === "carried" || it.location.kind === "worn") && it.location.memberId === id).reduce((s, it) => s + it.weightKg, 0);
  return Math.round((state.members[id].baseWeightKg + gear) * 100) / 100;
}
