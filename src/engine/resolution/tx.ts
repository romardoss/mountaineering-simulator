// Mutable working copy for one step (ARCHITECTURE §4.4.4).
import type { GameData } from "../data/types";
import { roll, type RollScript } from "../rng/rng";
import type {
  GameEvent,
  GameState,
  ItemId,
  ItemLocation,
  MemberId,
  ResolutionPhase,
  RollRecord,
  Severity,
} from "../model/types";

export interface ReadCtx {
  data: GameData;
  state: GameState;
}

/** Protection that existed at step start (§10.3). */
export interface ProtectionSnapshot {
  attachments: Set<string>;
  belays: Set<string>;
  bases: Set<string>;
  knots: Set<string>;
  fallenCaught: Set<MemberId>;
}

export interface StepTx extends ReadCtx {
  phase: ResolutionPhase;
  events: GameEvent[];
  script?: RollScript;
  snapshot: ProtectionSnapshot;
  /** Members who do a non-command action this step (distracted belayer, §11.3.3). */
  busy: Set<MemberId>;
  /** Members who moved this step: from/to s. */
  moved: Map<MemberId, { from: number; to: number }>;
  /** Members for whom P1/P2 was violated this step (uncoordinated, ×1.5). */
  uncoordinated: Set<MemberId>;
  /** Members threatened by an unwarned rock this step (×3.0 if they move). */
  unwarnedRockThreat: Set<MemberId>;
  /** Falls to resolve in hazardResolution. */
  falls: { memberId: MemberId; cause: string; params: Record<string, string | number> }[];
  /** Knots loaded this step (exam reveal). */
  loadedKnots: Set<string>;
  durations: number[];
  emit(e: Omit<GameEvent, "id" | "step" | "phase" | "refs"> & { refs?: GameEvent["refs"] }): GameEvent;
  roll(key: string, p: number): RollRecord;
  newId(prefix: string): string;
  setLocation(itemId: ItemId, loc: ItemLocation): void;
  violation(ruleId: string, memberId: MemberId, params?: Record<string, string | number>): void;
  mistake(key: string, params: Record<string, string | number>, ref?: string): void;
}

export function createTx(data: GameData, state: GameState, snapshot: ProtectionSnapshot, script?: RollScript): StepTx {
  let seq = 0;
  const tx: StepTx = {
    data,
    state,
    phase: "setup",
    events: [],
    script,
    snapshot,
    busy: new Set(),
    moved: new Map(),
    uncoordinated: new Set(),
    unwarnedRockThreat: new Set(),
    falls: [],
    loadedKnots: new Set(),
    durations: [],
    emit(e) {
      const ev: GameEvent = {
        id: `${state.step}:${seq++}`,
        step: state.step,
        phase: tx.phase,
        type: e.type,
        severity: e.severity as Severity,
        messageKey: e.messageKey,
        params: e.params,
        refs: e.refs ?? {},
      };
      tx.events.push(ev);
      return ev;
    },
    roll(key, p) {
      return roll(state.rng, key, Math.max(0, Math.min(1, p)), script);
    },
    newId(prefix) {
      state.nextId += 1;
      return `${prefix}${state.nextId}`;
    },
    setLocation(itemId, loc) {
      state.items[itemId].location = loc;
    },
    violation(ruleId, memberId, params = {}) {
      const rule = data.protocol.find((r) => r.id === ruleId);
      if (!rule || !rule.enabled) return;
      state.stats.commands.violations[ruleId] = (state.stats.commands.violations[ruleId] ?? 0) + 1;
      tx.emit({
        type: "protocol.violation",
        severity: rule.severity,
        messageKey: rule.messageKey,
        params: { member: memberId, rule: ruleId, ...params },
        refs: { members: [memberId], ruleIds: [ruleId] },
      });
      tx.mistake(rule.messageKey, { member: memberId, rule: ruleId, ...params }, `rule:${ruleId}`);
    },
    mistake(key, params, ref) {
      state.stats.mistakes.push({ step: state.step, key, params, ref });
    },
  };
  return tx;
}
