// Small DSL for readable scenario tests (ARCHITECTURE §8.2).
import { gameData, hillPresets, kits } from "../../src/data/load";
import { createEngine } from "../../src/engine";
import type {
  ActionParams,
  AttachTarget,
  CommandKey,
  ControlKnot,
  GameState,
  HillConfig,
  ItemConfig,
  KnotChoice,
  MemberConfig,
  PlannedAction,
  Scenario,
  Season,
} from "../../src/engine/model/types";
import { buildKit, makeItem } from "../../src/engine/scenario/kit";
import { belayableSegments } from "../../src/engine/model/selectors";
import type { RollScript } from "../../src/engine/rng/rng";

export const engine = createEngine(gameData);
export const data = gameData;
export const NAMES = ["Оксана", "Тарас", "Марія", "Богдан", "Ірина", "Андрій", "Соломія"];

export function team(n: number): MemberConfig[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i + 1}`,
    name: NAMES[i],
    appearance: { row: i },
  }));
}

export function preset(id: string): HillConfig {
  const h = hillPresets.find((p) => p.id === id);
  if (!h) throw new Error(`no preset ${id}`);
  return structuredClone(h);
}

export function flatHill(): HillConfig {
  return {
    id: "flat",
    type: "hill",
    routeType: "ascent",
    startZoneM: 6,
    finishZoneM: 8,
    sections: [
      { lengthM: 20, angleDeg: 5, surface: "grass" },
      { lengthM: 20, angleDeg: 10, surface: "grass" },
    ],
    trees: [
      { id: "t1", s: 3, size: "large" },
      { id: "t2", s: 49, size: "large" },
    ],
    basePoints: [
      { id: "bp_start", s: 3, anchorType: "tree", treeId: "t1" },
      { id: "bp_top", s: 49, anchorType: "tree", treeId: "t2" },
    ],
  };
}

/** Single steep section — handy for fall tests. */
export function steepHill(angle = 38, surface: "grass" | "ground" | "rock" | "scree" = "ground", length = 30): HillConfig {
  return {
    id: "steep",
    type: "hill",
    routeType: "ascent",
    startZoneM: 6,
    finishZoneM: 8,
    sections: [{ lengthM: length, angleDeg: angle, surface }],
    trees: [
      { id: "t1", s: 3, size: "large" },
      { id: "t2", s: 6 + length + 3, size: "large" },
    ],
    basePoints: [
      { id: "bp_start", s: 3, anchorType: "tree", treeId: "t1" },
      { id: "bp_mid", s: 6 + length / 2, anchorType: "bolt" },
      { id: "bp_top", s: 6 + length + 3, anchorType: "tree", treeId: "t2" },
    ],
  };
}

export function scenario(opts: { hill?: HillConfig; n?: number; season?: Season; mode?: "learning" | "exam"; seed?: number; items?: (t: MemberConfig[]) => ItemConfig[] } = {}): Scenario {
  const season = opts.season ?? "summer";
  const t = team(opts.n ?? 5);
  return {
    schemaVersion: 1,
    id: "test",
    name: "test",
    route: { obstacles: [opts.hill ?? preset("skhyl-z-derevamy")] },
    season,
    mode: opts.mode ?? "learning",
    seed: opts.seed ?? 42,
    team: t,
    items: opts.items ? opts.items(t) : buildKit(data, kits[0], t, season),
    maxSteps: null,
    weights: data.weights,
  };
}

export { makeItem };

/** No random terrain falls / rocks unless a test asks for them. */
export const CALM: RollScript = { "fall:terrain:*": false, "rockfall:dislodge:*": false, "weather:*": false };

function toPlan(plan: Record<string, ActionParams | ActionParams[]>): PlannedAction[] {
  return Object.entries(plan).flatMap(([memberId, params]) => (Array.isArray(params) ? params : [params]).map((x) => ({ memberId, params: x })));
}

export class Game {
  state: GameState;
  history: PlannedAction[][] = [];
  rollHistory: RollScript[] = [];
  rolls: RollScript;
  constructor(public sc: Scenario, rolls: RollScript = CALM) {
    this.state = engine.createGame(sc, { rolls });
    this.rolls = rolls;
  }
  /** A member may get one action and one command in the same step (CR-37): pass an array. */
  step(plan: Record<string, ActionParams | ActionParams[]>, rolls?: RollScript) {
    const p = toPlan(plan);
    const v = engine.validatePlan(this.state, p);
    for (const [kind, all] of [["action", v.members], ["command", v.commands]] as const)
      for (const [m, r] of Object.entries(all)) if (!r.ok) throw new Error(`step ${this.state.step + 1}: ${m} ${kind} invalid: ${r.reasonKey}`);
    this.history.push(p);
    this.rollHistory.push({ ...this.rolls, ...(rolls ?? {}) });
    const res = engine.resolveStep(this.state, p, { rolls: { ...this.rolls, ...(rolls ?? {}) } });
    this.state = res.state;
    return res.events;
  }
  /** Step that is allowed to contain invalid actions (for disabled-action tests). */
  stepRaw(plan: Record<string, ActionParams | ActionParams[]>, rolls?: RollScript) {
    const p = toPlan(plan);
    this.history.push(p);
    this.rollHistory.push({ ...this.rolls, ...(rolls ?? {}) });
    const res = engine.resolveStep(this.state, p, { rolls: { ...this.rolls, ...(rolls ?? {}) } });
    this.state = res.state;
    return res.events;
  }
  /** Replays the recorded history with the same per-step roll scripts. */
  replay(): GameState {
    let st = engine.createGame(this.sc, { rolls: this.rolls });
    this.history.forEach((p, i) => (st = engine.resolveStep(st, p, { rolls: this.rollHistory[i] }).state));
    return st;
  }
  m(id: string) {
    return this.state.members[id];
  }
  s(id: string) {
    return this.state.members[id].pos.s;
  }
  item(type: string, memberId?: string) {
    return Object.values(this.state.items).find((i) => i.type === type && (!memberId || ((i.location.kind === "carried" || i.location.kind === "worn") && i.location.memberId === memberId)))!;
  }
  base(bpId: string) {
    return Object.values(this.state.bases).find((b) => b.basePointId === bpId)!;
  }
  segments() {
    return belayableSegments(this.state);
  }
  segTarget(i = 0): AttachTarget {
    const s = this.segments()[i];
    return { kind: "segment", ropeId: s.ropeId, lowerNodeId: s.lowerNodeId, upperNodeId: s.upperNodeId };
  }
  /** Walk every listed member toward the finish until they reach `s` (or the finish). */
  walk(ids: string[], toS: number, rolls?: RollScript, guard = 60) {
    for (let i = 0; i < guard; i++) {
      const plan: Record<string, ActionParams> = {};
      for (const id of ids) if (this.s(id) < toS - 0.01) plan[id] = mv(Math.min(10, toS - this.s(id)));
      if (!Object.keys(plan).length) return;
      this.step(plan, rolls);
    }
    throw new Error("walk did not finish");
  }
}

export const K = (knotId: string, control: ControlKnot = "none", turns: number | null = null): KnotChoice => ({ knotId, control, turns });
export const skip = (): ActionParams => ({ kind: "skip" });
export const say = (command: CommandKey, recipient: string = "all"): ActionParams => ({ kind: "command", command, recipient });
/** Move toward the finish; the engine clamps to what is physically possible. */
export const mv = (distanceM = 99, toward: "finish" | "start" = "finish"): ActionParams => ({ kind: "move", toward, distanceM });
