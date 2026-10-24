// resolveStep (§10.2): fixed phase pipeline over a cloned state.
import type { GameData } from "../data/types";
import { ACTIONS, PHASE_ORDER, validateAction } from "../actions/defs";
import { dislodgeRolls, rockfallHits, rockfallWarnings } from "../hazards/rockfall";
import { resolveFall, staticLoadRolls, terrainFallRolls } from "../hazards/falls";
import { checkInvariants, checkTransition, InvariantViolation } from "../invariants/invariants";
import { itemsLeftOnHill } from "../stats/stats";
import {
  attachmentsOf,
  belaysAsClimber,
  inFinish,
  isActive,
  memberWeightKg,
  membersOnSegment,
  ravineOf,
  segmentKey,
  weightBand,
} from "../model/selectors";
import type { ActionParams, GameEvent, GameState, MemberId, PlannedAction } from "../model/types";
import type { RollScript } from "../rng/rng";
import { createTx, type ProtectionSnapshot, type StepTx } from "./tx";

export interface ResolveOptions {
  rolls?: RollScript;
  checkInvariants?: boolean;
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

function snapshotOf(state: GameState): ProtectionSnapshot {
  return {
    attachments: new Set(Object.keys(state.attachments)),
    belays: new Set(Object.keys(state.belays)),
    bases: new Set(Object.keys(state.bases)),
    knots: new Set(Object.keys(state.knots)),
    fallenCaught: new Set(Object.values(state.members).filter((m) => m.status === "fallen_caught").map((m) => m.id)),
  };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/**
 * Plan normalised per active member, team order: at most one command (it does not use the
 * member's step, CR-37) plus exactly one main action (default: skip).
 */
export function normalisePlan(state: GameState, plan: PlannedAction[]): PlannedAction[] {
  const out: PlannedAction[] = [];
  for (const m of state.scenario.team.map((t) => state.members[t.id]).filter((x) => isActive(x))) {
    const mine = plan.filter((p) => p.memberId === m.id);
    const command = mine.find((p) => p.params.kind === "command");
    if (command) out.push(command);
    out.push(mine.find((p) => p.params.kind !== "command") ?? { memberId: m.id, params: { kind: "skip" } });
  }
  return out;
}

export function resolveStep(data: GameData, input: GameState, plan: PlannedAction[], opts: ResolveOptions = {}): StepResult {
  if (input.outcome !== "in_progress") return { state: input, events: [] };
  const check = opts.checkInvariants ?? true;
  if (check) deepFreeze(input);
  const state: GameState = structuredClone(input);
  state.step += 1;
  // a member caught last step is back on their feet
  const snapshot = snapshotOf(state);
  for (const m of Object.values(state.members)) if (m.status === "fallen_caught") m.status = "ok";
  const tx = createTx(data, state, snapshot, opts.rolls);
  const actions = normalisePlan(state, plan);
  const forced = new Set<MemberId>();
  for (const m of Object.values(state.members)) {
    if (m.forcedSkipNextStep) {
      forced.add(m.id);
      m.forcedSkipNextStep = false;
    }
  }
  // busy members (distracted belayer, §11.3.3)
  for (const a of actions) {
    if (!["skip", "command", "belay", "stop_belay"].includes(a.params.kind)) tx.busy.add(a.memberId);
  }
  for (const b of Object.values(state.belays)) b.inactiveThisStep = tx.busy.has(b.belayerId);

  const executed = new Set<MemberId>();
  for (const phase of PHASE_ORDER) {
    tx.phase = phase;
    if (phase === "detach") {
      // rocks from last step warned now → threatened members take cover this step
      for (const m of rockfallWarnings(tx)) forced.add(m);
      for (const m of forced) {
        state.stats.members[m].forcedSkips += 1;
        tx.emit({ type: "member.took_cover", severity: "info", messageKey: "event.took_cover", params: { member: m }, refs: { members: [m] } });
      }
    }
    if (phase === "movement") protocolBeforeMovement(tx, actions);
    for (const a of actions) {
      const def = ACTIONS[a.params.kind];
      if (def.phase !== phase || a.params.kind === "skip") continue;
      if (forced.has(a.memberId)) continue;
      const v = validateAction(tx, a.memberId, a.params);
      if (!v.ok) {
        tx.emit({ type: "action.failed", severity: "warning", messageKey: "event.action_failed", params: { member: a.memberId, action: a.params.kind, reason: v.reasonKey }, refs: { members: [a.memberId] } });
        continue;
      }
      def.apply(tx, a.memberId, a.params);
      tx.durations.push(def.duration(tx, a.memberId, a.params));
      if (a.params.kind !== "command") executed.add(a.memberId);
    }
  }

  // 7. hazard rolls
  tx.phase = "hazardRolls";
  staticLoadRolls(tx);
  terrainFallRolls(tx);
  dislodgeRolls(tx);

  // 8. hazard resolution
  tx.phase = "hazardResolution";
  for (const f of tx.falls) resolveFall(tx, f.memberId, f.cause, f.params);
  rockfallHits(tx);

  // 9. bookkeeping
  tx.phase = "bookkeeping";
  bookkeeping(tx, actions, executed, forced);
  if (check) {
    const v = [...checkInvariants(data, state), ...checkTransition(data, input, state)];
    if (v.length) throw new InvariantViolation(v);
  }
  state.log.push(...tx.events);
  return { state, events: tx.events };
}

/** P1/P2 (uncoordinated) and P4 (crowded segment) feed the fall chance (§14.1.2). */
function protocolBeforeMovement(tx: StepTx, actions: PlannedAction[]) {
  const st = tx.state;
  for (const a of actions) {
    if (a.params.kind !== "move") continue;
    const m = a.memberId;
    for (const b of belaysAsClimber(st, m)) {
      // a belay set up this step cannot have been announced yet (commands come first): no P1 (CR-26)
      if (tx.snapshot.belays.has(b.id) && st.protocol.flagged[`${b.id}:P1`] === undefined && st.protocol.belayReady[b.id] === undefined) {
        st.protocol.flagged[`${b.id}:P1`] = true;
        tx.violation("P1", m, { belayer: b.belayerId });
        tx.uncoordinated.add(m);
      }
      if (st.protocol.flagged[`${b.id}:P2`] === undefined && st.protocol.climberGo[b.id] === undefined) {
        st.protocol.flagged[`${b.id}:P2`] = true;
        tx.violation("P2", m);
        tx.uncoordinated.add(m);
      }
    }
    for (const at of attachmentsOf(st, m)) {
      if (at.target.kind !== "segment") continue;
      const key = segmentKey(at.target.ropeId, at.target.lowerNodeId, at.target.upperNodeId);
      const n = membersOnSegment(st, key).length;
      if (n > tx.data.rules.maxMembersPerSegment && !st.protocol.flagged[`${key}:P4:${st.step}`]) {
        st.protocol.flagged[`${key}:P4:${st.step}`] = true;
        tx.violation("P4", m, { count: n });
      }
    }
  }
}

function bookkeeping(tx: StepTx, actions: PlannedAction[], executed: Set<MemberId>, forced: Set<MemberId>) {
  const st = tx.state;
  const data = tx.data;
  st.stats.steps = st.step;
  for (const a of actions) {
    const ms = st.stats.members[a.memberId];
    if (forced.has(a.memberId) || a.params.kind === "command") continue; // a command is not a step (CR-37)
    if (a.params.kind === "skip" || !executed.has(a.memberId)) ms.skippedSteps += 1;
    else ms.activeSteps += 1;
  }
  for (const m of Object.keys(st.members)) {
    const w = memberWeightKg(st, m).total;
    const ms = st.stats.members[m];
    ms.maxWeightKg = Math.max(ms.maxWeightKg, Math.round(w * 100) / 100);
    const band = weightBand(data, w);
    if (band === "over" || band === "max") ms.overloadedSteps += 1;
  }
  const dur = Math.max(data.rules.minStepSeconds, ...tx.durations, 0);
  st.simTimeS += dur;
  for (const id of tx.loadedKnots) if (st.knots[id]) st.knots[id].revealed = true;
  // keep only recent commands (protocol windows are at most 2 steps)
  st.protocol.recent = st.protocol.recent.filter((c) => c.step >= st.step - 2);
  // outcome (§15)
  const members = Object.values(st.members);
  if (members.some((m) => m.status === "injured")) {
    st.outcome = "lost";
    tx.emit({ type: "game.lost", severity: "danger", messageKey: "event.game_lost_injury", params: {}, refs: {} });
  } else if (members.every((m) => inFinish(st, m)) && (!ravineOf(st) || itemsLeftOnHill(st).length === 0)) {
    // a ravine is won only with all equipment back; otherwise the team may still retrieve it or finish the level (CR-58)
    st.outcome = "won";
    for (const m of members) m.status = "finished";
    tx.emit({ type: "game.won", severity: "info", messageKey: "event.game_won", params: {}, refs: {} });
  } else if (st.scenario.maxSteps && st.step >= st.scenario.maxSteps) {
    st.outcome = "lost";
    tx.emit({ type: "game.lost", severity: "danger", messageKey: "event.game_lost_steps", params: { max: st.scenario.maxSteps }, refs: {} });
  }
  tx.emit({ type: "step.done", severity: "info", messageKey: "event.step_done", params: { step: st.step, seconds: dur }, refs: {} });
}

/** Ravine (CR-58): the whole team is on the finish bank, nobody injured. */
export function canFinishLevel(state: GameState): boolean {
  if (state.outcome !== "in_progress" || !ravineOf(state)) return false;
  const members = Object.values(state.members);
  return members.every((m) => m.status !== "injured" && inFinish(state, m));
}

/** Ends a ravine level: victory with all equipment back, otherwise completed with penalties. */
export function finishLevel(state: GameState): GameState {
  if (!canFinishLevel(state)) return state;
  const s = structuredClone(state);
  const left = itemsLeftOnHill(s);
  s.outcome = left.length ? "completed" : "won";
  for (const m of Object.values(s.members)) m.status = "finished";
  s.log.push({ id: `${s.step}:end`, step: s.step, phase: "bookkeeping", type: left.length ? "game.completed" : "game.won", severity: left.length ? "warning" : "info", messageKey: left.length ? "event.level_completed" : "event.game_won", params: { count: left.length }, refs: {} });
  return s;
}

/**
 * A command shouted at once (CR-72): applied right away, no step, no time. It belongs to the step
 * being planned (`step + 1`), exactly like a command given in that step's plan, so every protocol
 * rule («Сам!» → untie next step, P1, «Камінь!») reads it the same way.
 */
export function shout(data: GameData, input: GameState, memberId: MemberId, params: ActionParams, opts: ResolveOptions = {}): StepResult {
  if (input.outcome !== "in_progress" || params.kind !== "command") return { state: input, events: [] };
  const check = opts.checkInvariants ?? true;
  if (!validateAction({ data, state: input }, memberId, params).ok) return { state: input, events: [] };
  if (check) deepFreeze(input);
  const state: GameState = structuredClone(input);
  state.step += 1;
  const tx = createTx(data, state, snapshotOf(state), opts.rolls);
  tx.phase = "commands";
  ACTIONS.command.apply(tx, memberId, params);
  state.step -= 1;
  // ids distinct from the ones the step itself will use (`<step>:<n>`)
  const before = input.log.filter((e) => e.step === input.step + 1).length;
  tx.events.forEach((e, i) => (e.id = `${input.step + 1}:c${before + i}`));
  if (check) {
    const v = [...checkInvariants(data, state), ...checkTransition(data, input, state)];
    if (v.length) throw new InvariantViolation(v);
  }
  state.log.push(...tx.events);
  return { state, events: tx.events };
}

export function giveUp(state: GameState): GameState {
  if (state.outcome !== "in_progress") return state;
  const s = structuredClone(state);
  s.outcome = "aborted";
  return s;
}
