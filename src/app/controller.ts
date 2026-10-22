// GameController (ARCHITECTURE §6.2): the only caller of state-changing engine functions.
import type { ActionParams, GameState, PlannedAction, Scenario } from "../engine/model/types";
import { geoOf, itemsWith } from "../engine/model/selectors";
import { KEYS, load, remove, save } from "./persistence/storage";
import {
  animating,
  draft,
  engine,
  go,
  lastResult,
  selectedMember,
  session,
  type ResultRecord,
  type Session,
  withWeights,
} from "./store";

interface SavedGame {
  scenario: Scenario;
  history: PlannedAction[][];
  state: Session["state"];
  savedAt: number;
  realTimeMs: number;
}

export function hasSavedGame(): boolean {
  return !!load<SavedGame | null>(KEYS.current, null);
}

export function startGame(config: Scenario) {
  const scenario = withWeights(config);
  const state = engine.createGame(scenario);
  session.value = { scenario, state, history: [], plan: {}, commands: {}, goals: {}, prevState: null, lastEvents: [], startedAt: Date.now(), realTimeMs: 0 };
  selectedMember.value = scenario.team[0]?.id ?? null;
  autosave();
  go("game");
}

export function continueGame(): boolean {
  const saved = load<SavedGame | null>(KEYS.current, null);
  if (!saved) return false;
  let state = saved.state;
  if (import.meta.env?.DEV) {
    // dev: replay the history and compare (catches determinism bugs early, ARCHITECTURE §6.3.2)
    try {
      const replayed = engine.replay(saved.scenario, saved.history, { checkInvariants: false });
      if (JSON.stringify(replayed) !== JSON.stringify(saved.state)) console.warn("[zgr] replay differs from the saved state");
    } catch (e) {
      console.warn("[zgr] replay failed", e);
    }
  }
  state = state ?? engine.replay(saved.scenario, saved.history);
  session.value = { scenario: saved.scenario, state, history: saved.history, plan: {}, commands: {}, goals: {}, prevState: null, lastEvents: [], startedAt: Date.now(), realTimeMs: saved.realTimeMs };
  selectedMember.value = saved.scenario.team[0]?.id ?? null;
  draft.value = structuredClone(saved.scenario);
  go(state.outcome === "in_progress" ? "game" : "results");
  return true;
}

function autosave() {
  const s = session.value;
  if (!s) return;
  if (s.state.outcome !== "in_progress") {
    remove(KEYS.current);
    return;
  }
  save<SavedGame>(KEYS.current, { scenario: s.scenario, history: s.history, state: s.state, savedAt: Date.now(), realTimeMs: elapsed(s) });
}

function elapsed(s: Session): number {
  return s.realTimeMs + (Date.now() - s.startedAt);
}

/** Any explicitly chosen action replaces the member's right-click goal; a command goes to its own slot (CR-37). */
export function setPlannedAction(memberId: string, params: ActionParams | null) {
  const s = session.value;
  if (!s) return;
  if (params?.kind === "command") {
    session.value = { ...s, commands: { ...s.commands, [memberId]: params } };
    return;
  }
  const plan = { ...s.plan };
  if (params) plan[memberId] = params;
  else delete plan[memberId];
  const goals = { ...s.goals };
  delete goals[memberId];
  session.value = { ...s, plan, goals };
}

const GOAL_EPS_M = 0.05;

/** Move toward `targetS`; the engine clamps the distance to this step's reach. */
function goalMove(state: GameState, memberId: string, targetS: number): ActionParams | null {
  const d = targetS - state.members[memberId].pos.s;
  if (Math.abs(d) < GOAL_EPS_M) return null;
  return { kind: "move", toward: d > 0 ? "finish" : "start", distanceM: Math.round(Math.abs(d) * 100) / 100, targetS };
}

/** Right-click on the hill (CR-18): the member walks to `targetS`, over several steps if needed. */
export function planMoveTo(memberId: string, targetS: number) {
  const s = session.value;
  if (!s || animating.value || s.state.outcome !== "in_progress") return;
  const m = s.state.members[memberId];
  if (!m || m.status === "injured" || m.status === "finished") return;
  const target = Math.round(Math.max(0, Math.min(geoOf(s.state).totalLength, targetS)) * 10) / 10;
  const plan = { ...s.plan };
  const goals = { ...s.goals };
  const move = goalMove(s.state, memberId, target);
  if (move) {
    plan[memberId] = move;
    goals[memberId] = target;
  } else {
    delete plan[memberId];
    delete goals[memberId];
  }
  session.value = { ...s, plan, goals };
}

/** Goals that keep going next step: member ok, got closer this step, not there yet. */
function nextGoals(prev: GameState, state: GameState, goals: Record<string, number>, executed: PlannedAction[]) {
  const plan: Record<string, ActionParams> = {};
  const kept: Record<string, number> = {};
  if (state.outcome !== "in_progress") return { plan, goals: kept };
  for (const [id, target] of Object.entries(goals)) {
    const moved = executed.some((p) => p.memberId === id && p.params.kind === "move");
    const before = Math.abs(target - prev.members[id].pos.s);
    const after = Math.abs(target - state.members[id].pos.s);
    const move = goalMove(state, id, target);
    if (!moved || !move || state.members[id].status !== "ok" || after > before - 0.01) continue;
    plan[id] = move;
    kept[id] = target;
  }
  return { plan, goals: kept };
}

export function clearPlannedCommand(memberId: string) {
  const s = session.value;
  if (!s) return;
  const commands = { ...s.commands };
  delete commands[memberId];
  session.value = { ...s, commands };
}

/** Commands first, then main actions (one of each per member). */
export function planList(s: Session): PlannedAction[] {
  return [...Object.entries(s.commands ?? {}), ...Object.entries(s.plan)].map(([memberId, params]) => ({ memberId, params }));
}

export function executeStep() {
  const s = session.value;
  if (!s || animating.value || s.state.outcome !== "in_progress") return;
  const plan = planList(s);
  const v = engine.validatePlan(s.state, plan);
  // impossible actions cannot be confirmed (§10.1.2): drop them to skip
  const valid = plan.filter((p) => (p.params.kind === "command" ? v.commands : v.members)[p.memberId]?.ok);
  const res = engine.resolveStep(s.state, valid, { checkInvariants: !!import.meta.env?.DEV });
  const carry = nextGoals(s.state, res.state, s.goals, valid);
  const next: Session = { ...s, prevState: s.state, state: res.state, lastEvents: res.events, history: [...s.history, valid], plan: carry.plan, commands: {}, goals: carry.goals };
  session.value = next;
  animating.value = res.events.some((e) => e.type !== "step.done");
  autosave();
  if (res.state.outcome !== "in_progress") finish();
}

export function giveUp() {
  const s = session.value;
  if (!s) return;
  session.value = { ...s, state: engine.giveUp(s.state) };
  finish();
}

function finish() {
  const s = session.value;
  if (!s) return;
  const rec: ResultRecord = {
    id: `r_${Date.now().toString(36)}`,
    scenarioId: s.scenario.id,
    scenarioName: s.scenario.name,
    finishedAt: Date.now(),
    outcome: s.state.outcome,
    stats: engine.getStats(s.state),
    realTimeMs: elapsed(s),
    mode: s.scenario.mode,
    season: s.scenario.season,
  };
  lastResult.value = rec;
  const all = load<ResultRecord[]>(KEYS.results, []);
  save(KEYS.results, [rec, ...all].slice(0, 50));
  remove(KEYS.current);
}

export function resultsHistory(): ResultRecord[] {
  return load<ResultRecord[]>(KEYS.results, []);
}

export function replaySameScenario() {
  const s = session.value;
  if (!s) return;
  startGame(structuredClone(s.scenario));
}

export function editScenario() {
  const s = session.value;
  if (s) draft.value = structuredClone(s.scenario);
  go("hill");
}

// ---------------------------------------------------------------- saved scenarios

export function savedScenarios(): Scenario[] {
  return load<Scenario[]>(KEYS.scenarios, []);
}

export function saveScenario(sc: Scenario) {
  const all = savedScenarios().filter((x) => x.id !== sc.id);
  save(KEYS.scenarios, [sc, ...all]);
}

export function deleteScenario(id: string) {
  save(KEYS.scenarios, savedScenarios().filter((x) => x.id !== id));
}

/** What a member lacks for the default base on a sling (CR-39): a sling and a locking carabiner. */
export function baseMissing(state: GameState, memberId: string): ("sling" | "carabiner")[] {
  const carried = itemsWith(state, memberId, ["carried"]);
  const out: ("sling" | "carabiner")[] = [];
  if (!carried.some((i) => i.type === "sling")) out.push("sling");
  if (!carried.some((i) => i.type === "carabiner" && i.props.locking)) out.push("carabiner");
  return out;
}
