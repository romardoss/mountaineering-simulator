// Knot evaluation (§13.5). Pure: the UI hint and the engine use the same function.
import type { ContextRatingEntry, GameData, KnotDef } from "../data/types";
import type { ControlKnot, KnotContext, KnotEvaluation, KnotRating } from "../model/types";

export interface KnotEvalInput {
  knotId: string;
  context: KnotContext;
  control: ControlKnot;
  turns: number | null;
  ropeDiameterMm?: number;
  cordDiameterMm?: number;
  /** Cord is a closed (pre-tied) loop. */
  cordLooped?: boolean;
  lockingCarabiners: number;
  carabiners: number;
  support?: "thick" | "thin" | null;
  loadType?: "static" | "shock";
}

export function knotDef(data: GameData, knotId: string): KnotDef | undefined {
  return data.knots.find((k) => k.id === knotId);
}

export function baseRating(data: GameData, input: KnotEvalInput): { rating: KnotRating; messageKey?: string } {
  const ctx = data.contexts[input.context];
  const entry = ctx?.ratings[input.knotId];
  if (!entry) return { rating: ctx?.default ?? "wrong" };
  if (typeof entry === "string") return { rating: entry };
  const e = entry as ContextRatingEntry;
  if (e.requires === "locking_carabiner" && input.lockingCarabiners < 1) {
    return { rating: e.otherwise ?? "wrong", messageKey: "knot.msg.needs_carabiner" };
  }
  return { rating: e.rating, messageKey: e.messageKey };
}

const RANK: Record<KnotRating, number> = { correct: 0, acceptable: 1, wrong: 2, dangerous: 3 };

export function worseRating(a: KnotRating, b: KnotRating): KnotRating {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Control knots tied correctly for this knot (CR-21): the UI always uses this. */
export function controlFor(def: Pick<KnotDef, "controlKnotsRequired"> | undefined): ControlKnot {
  return def && def.controlKnotsRequired > 0 ? "double" : "none";
}

export function evaluateKnot(data: GameData, input: KnotEvalInput): KnotEvaluation {
  const def = knotDef(data, input.knotId);
  const mods = data.hazards.knots.modifiers;
  const messages: KnotEvaluation["messages"] = [];
  const { rating, messageKey } = baseRating(data, input);
  const base = data.hazards.knots.ratings[rating];
  let pStatic = base.static;
  let pShock = base.shock;
  const p = { knot: input.knotId, context: input.context };
  messages.push({ key: `knot.rating.${rating}`, ruleId: `rating.${input.context}`, params: p });
  if (messageKey) messages.push({ key: messageKey, ruleId: "rating.requires", params: p });
  if (!def) return cap({ rating, failProbStatic: pStatic, failProbShock: pShock, messages });

  // 1. Missing control knot.
  const turns = input.turns ?? def.minTurns ?? null;
  const controlNeeded =
    def.controlKnotsRequired > 0 &&
    !(def.controlNotNeededFromTurns !== undefined && turns !== null && turns >= def.controlNotNeededFromTurns);
  if (controlNeeded && input.control === "none") {
    pShock += mods.missingControl.shock;
    pStatic += mods.missingControl.static;
    messages.push({ key: "knot.msg.missing_control", ruleId: "mod.missingControl", params: p });
  } else if (controlNeeded && input.control === "single") {
    messages.push({ key: "knot.msg.prefer_double_control", ruleId: "hint.doubleControl", params: p });
  }
  // 2. Turns below minimum.
  if (def.minTurns !== undefined && input.turns !== null && input.turns < def.minTurns) {
    pShock += mods.turnsBelowMin.shock;
    messages.push({ key: "knot.msg.turns_below_min", ruleId: "mod.turnsBelowMin", params: { ...p, min: def.minTurns, turns: input.turns } });
  }
  // 3. Constant-load-only knot under shock load.
  if (def.constantLoadOnly && (input.loadType ?? "shock") === "shock") {
    pShock += mods.constantLoadOnlyShock.shock;
    messages.push({ key: "knot.msg.constant_load_only", ruleId: "mod.constantLoadOnly", params: p });
  }
  // 4. Grabbing knot cord:rope diameter ratio.
  if (def.diameterRatio && input.cordDiameterMm && input.ropeDiameterMm) {
    const ratio = input.cordDiameterMm / input.ropeDiameterMm;
    if (ratio < mods.diameterRatio.min || ratio > mods.diameterRatio.max) {
      pShock += mods.diameterRatio.shock;
      messages.push({
        key: ratio > mods.diameterRatio.max ? "knot.msg.cord_too_thick" : "knot.msg.cord_too_thin",
        ruleId: "mod.diameterRatio",
        params: { ...p, ratio: Math.round(ratio * 100) / 100, cord: input.cordDiameterMm, rope: input.ropeDiameterMm },
      });
    }
  }
  if (def.endsMustBeJoined && input.cordLooped === false) {
    pShock += mods.cordNotLooped.shock;
    messages.push({ key: "knot.msg.cord_not_looped", ruleId: "mod.cordNotLooped", params: p });
  }
  // 5. Required carabiner missing or not locking.
  if (def.requires.includes("locking_carabiner") && input.lockingCarabiners < 1) {
    pShock += mods.carabinerMissing.shock;
    messages.push({ key: "knot.msg.carabiner_missing", ruleId: "mod.carabinerMissing", params: p });
  }
  if (def.requires.includes("two_carabiners") && input.carabiners < 2) {
    pShock += mods.twoCarabinersMissing.shock;
    messages.push({ key: "knot.msg.two_carabiners", ruleId: "mod.twoCarabinersMissing", params: p });
  }
  // 6. Minimum support diameter.
  if (def.minSupport === "thick" && input.support === "thin") {
    pShock += mods.minSupportDiameter.shock;
    messages.push({ key: "knot.msg.support_too_thin", ruleId: "mod.minSupportDiameter", params: p });
  }
  return cap({ rating, failProbStatic: pStatic, failProbShock: pShock, messages });
}

function cap(e: KnotEvaluation): KnotEvaluation {
  e.failProbShock = Math.min(1, round(e.failProbShock));
  e.failProbStatic = Math.min(1, round(e.failProbStatic));
  return e;
}

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** True when the evaluation would show anything but a clean "correct" in learning mode. */
export function needsHint(e: KnotEvaluation): boolean {
  return e.rating !== "correct" || e.failProbShock > 0 || e.messages.length > 1;
}
