// Equipment accountability invariants (§9.2, ARCHITECTURE §4.11).
import type { GameData } from "../data/types";
import { carabinerLoad, itemPos, memberWeightKg, ropeUsedM } from "../model/selectors";
import type { GameState, StructureRef } from "../model/types";

export interface Violation {
  rule: string;
  detail: string;
}

export class InvariantViolation extends Error {
  constructor(public readonly violations: Violation[]) {
    super(`Invariant violation: ${violations.map((v) => `${v.rule}: ${v.detail}`).join("; ")}`);
  }
}

function structureExists(state: GameState, st: StructureRef): boolean {
  switch (st.kind) {
    case "rope":
      return !!state.ropes[st.ropeId];
    case "base":
      return !!state.bases[st.baseId];
    case "attachment":
      return !!state.attachments[st.attachmentId];
    case "belay":
      return !!state.belays[st.belayId];
    case "knot":
      return !!state.knots[st.knotId];
  }
}

function structureHolds(state: GameState, st: StructureRef, itemId: string): boolean {
  switch (st.kind) {
    case "rope":
      return st.ropeId === itemId;
    case "base":
      return state.bases[st.baseId].itemIds.includes(itemId);
    case "attachment":
      return state.attachments[st.attachmentId].itemIds.includes(itemId);
    case "belay": {
      const b = state.belays[st.belayId];
      return (b.braking.kind === "device" && b.braking.itemId === itemId) || b.braking.carabinerIds.includes(itemId);
    }
    case "knot":
      return state.knots[st.knotId].itemId !== itemId;
  }
}

export function checkInvariants(data: GameData, state: GameState): Violation[] {
  const out: Violation[] = [];
  // 1. The item id set never changes.
  const ids = Object.keys(state.items).sort();
  const initial = [...state.itemIds].sort();
  if (ids.join(",") !== initial.join(",")) out.push({ rule: "9.2.2", detail: `item set changed: ${ids.length} vs ${initial.length}` });
  // 2. Exactly one valid location per item, two-way consistent.
  for (const it of Object.values(state.items)) {
    const loc = it.location;
    if ((loc.kind === "carried" || loc.kind === "worn") && !state.members[loc.memberId]) out.push({ rule: "9.2.1", detail: `${it.id} held by unknown member` });
    if (loc.kind === "in_use") {
      if (!structureExists(state, loc.structure)) out.push({ rule: "9.2.1", detail: `${it.id} in missing ${loc.structure.kind}` });
      else if (!structureHolds(state, loc.structure, it.id)) out.push({ rule: "9.2.1", detail: `${it.id} not referenced by its ${loc.structure.kind}` });
    }
    if (loc.kind === "worn" && !["harness", "helmet", "gloves", "crampons"].includes(it.type)) out.push({ rule: "9.2.1", detail: `${it.id} (${it.type}) cannot be worn` });
  }
  for (const r of Object.values(state.ropes)) {
    const it = state.items[r.ropeId];
    if (!it || it.location.kind !== "in_use" || it.location.structure.kind !== "rope") out.push({ rule: "9.2.1", detail: `rope layout ${r.ropeId} without in_use rope` });
  }
  for (const b of Object.values(state.bases)) for (const id of b.itemIds) {
    const l = state.items[id]?.location;
    if (!l || l.kind !== "in_use" || l.structure.kind !== "base" || l.structure.baseId !== b.id) out.push({ rule: "9.2.1", detail: `base ${b.id} lists ${id} it does not hold` });
  }
  for (const a of Object.values(state.attachments)) for (const id of a.itemIds) {
    const l = state.items[id]?.location;
    if (!l || l.kind !== "in_use" || l.structure.kind !== "attachment" || l.structure.attachmentId !== a.id) out.push({ rule: "9.2.1", detail: `attachment ${a.id} lists ${id} it does not hold` });
  }
  // 4. Rope length.
  for (const r of Object.values(state.ropes)) {
    const len = state.items[r.ropeId]?.props.lengthM ?? 0;
    const used = ropeUsedM(state, data, r);
    if (used > len + 1e-6) out.push({ rule: "9.2.4", detail: `rope ${r.ropeId} uses ${used.toFixed(2)} m of ${len} m` });
  }
  // 5. Carabiner load.
  for (const it of Object.values(state.items)) {
    if (it.type !== "carabiner") continue;
    const load = carabinerLoad(state, it.id);
    if (load > data.rules.maxThingsPerCarabiner) out.push({ rule: "9.2.5", detail: `carabiner ${it.id} holds ${load}` });
  }
  // weight cap (§9.5.2.4)
  for (const m of Object.keys(state.members)) {
    const w = memberWeightKg(state, m).total;
    if (w > data.rules.weight.maxKg + 1e-6) out.push({ rule: "9.5.2.4", detail: `${m} carries ${w.toFixed(2)} kg` });
  }
  return out;
}

/** §9.2.3 — an item changes location only via a member adjacent to its previous position. */
export function checkTransition(data: GameData, prev: GameState, next: GameState): Violation[] {
  const out: Violation[] = [];
  const adjM = data.rules.adjacencyM;
  for (const it of Object.values(next.items)) {
    const before = prev.items[it.id];
    if (!before) continue;
    if (JSON.stringify(before.location) === JSON.stringify(it.location)) continue;
    const a = itemPos(prev, before);
    const holderBefore = before.location.kind === "carried" || before.location.kind === "worn" ? before.location.memberId : null;
    const holderAfter = it.location.kind === "carried" || it.location.kind === "worn" ? it.location.memberId : null;
    if (!a) continue;
    // the member who now holds it must have been adjacent before (pull-down is the documented exception, §7.1.9)
    if (holderAfter && holderAfter !== holderBefore) {
      const mPos = prev.members[holderAfter].pos;
      const wasRope = before.location.kind === "in_use" && before.location.structure.kind === "rope";
      const wasKnot = before.location.kind === "in_use" && before.location.structure.kind === "knot";
      if (!wasRope && !wasKnot && Math.abs(mPos.s - a.s) > adjM + 0.01 && !next.log.some((e) => e.step === prev.step && e.type === "base.failed")) {
        out.push({ rule: "9.2.3", detail: `${it.id} moved to ${holderAfter} from ${a.s.toFixed(1)} (member at ${mPos.s.toFixed(1)})` });
      }
    }
  }
  return out;
}
