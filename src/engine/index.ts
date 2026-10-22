// Public engine API (§20.3, ARCHITECTURE §4.1). No module-level state: the engine
// is a factory bound to validated rule data.
import type { GameData } from "./data/types";
import { ACTIONS, validateAction, type Hint } from "./actions/defs";
import { getActionOptions, type ActionOption } from "./actions/options";
import { evaluateKnot, type KnotEvalInput } from "./knots/evaluate";
import type { GameState, KnotEvaluation, Outcome, PlannedAction, Scenario } from "./model/types";
import { createGame, type CreateOptions } from "./scenario/create";
import { giveUp, resolveStep, type ResolveOptions, type StepResult } from "./resolution/resolve";
import { computeStats, type Stats } from "./stats/stats";

export interface MemberValidation {
  ok: boolean;
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
  hints: Hint[];
  durationS: number;
}

export interface PlanValidation {
  ok: boolean;
  /** Main action per member. */
  members: Record<string, MemberValidation>;
  /** The member's command, if planned (CR-37). */
  commands: Record<string, MemberValidation>;
}

export interface Engine {
  data: GameData;
  createGame(scenario: Scenario, opts?: CreateOptions): GameState;
  getActionOptions(state: GameState, memberId: string): ActionOption[];
  validatePlan(state: GameState, plan: PlannedAction[]): PlanValidation;
  resolveStep(state: GameState, plan: PlannedAction[], opts?: ResolveOptions): StepResult;
  evaluateKnot(input: KnotEvalInput): KnotEvaluation;
  getStats(state: GameState): Stats;
  getOutcome(state: GameState): Outcome;
  giveUp(state: GameState): GameState;
  replay(scenario: Scenario, history: PlannedAction[][], opts?: ResolveOptions): GameState;
}

export function createEngine(data: GameData): Engine {
  return {
    data,
    createGame: (scenario, opts) => createGame(data, scenario, opts),
    getActionOptions: (state, memberId) => getActionOptions({ data, state }, memberId),
    validatePlan: (state, plan) => {
      const ctx = { data, state };
      const members: PlanValidation["members"] = {};
      const commands: PlanValidation["commands"] = {};
      for (const p of plan) {
        const v = validateAction(ctx, p.memberId, p.params);
        const def = ACTIONS[p.params.kind];
        (p.params.kind === "command" ? commands : members)[p.memberId] = {
          ok: v.ok,
          reasonKey: v.ok ? undefined : v.reasonKey,
          reasonParams: v.ok ? undefined : v.params,
          hints: v.ok ? def.assess(ctx, p.memberId, p.params) : [],
          durationS: v.ok ? def.duration(ctx, p.memberId, p.params) : 0,
        };
      }
      return { ok: [...Object.values(members), ...Object.values(commands)].every((m) => m.ok), members, commands };
    },
    resolveStep: (state, plan, opts) => resolveStep(data, state, plan, opts),
    evaluateKnot: (input) => evaluateKnot(data, input),
    getStats: (state) => computeStats(data, state),
    getOutcome: (state) => state.outcome,
    giveUp: (state) => giveUp(state),
    replay: (scenario, history, opts) => {
      let s = createGame(data, scenario, { rolls: opts?.rolls });
      for (const plan of history) s = resolveStep(data, s, plan, opts).state;
      return s;
    },
  };
}

export type { ActionOption, CreateOptions, Hint, KnotEvalInput, ResolveOptions, StepResult, Stats };
export * from "./model/types";
