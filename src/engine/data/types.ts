// Shape of the validated rule data (src/data/*.json). The engine receives a
// GameData object and never loads files itself.
import type { CommandKey, ConfigSurface, ItemProps, ItemType, KnotContext, KnotRating, Season, Surface } from "../model/types";

export interface AngleBand {
  maxDeg: number;
  id: string;
  moveM: number;
}

export interface Rules {
  adjacencyM: number;
  knotRopeAllowanceM: number;
  maxThingsPerCarabiner: number;
  minStepSeconds: number;
  maxMembersPerSegment: number;
  angleBands: AngleBand[];
  moveModifiers: { grabbingKnot: number; snow: number; mud: number; rock: number; uphill: number };
  weight: {
    comfortKg: number;
    heavyKg: number;
    maxKg: number;
    heavyMoveFactor: number;
    overMoveFactor: number;
    overFallFactor: number;
  };
  team: { min: number; max: number; default: number };
  hill: {
    minTotalM: number;
    maxTotalM: number;
    steepWarnDeg: number;
    steepWarnLenM: number;
    sectionLengthM: [number, number];
    angleDeg: [number, number];
  };
  unsafeDetachDeg: number;
  unprotectedHintDeg: number;
  staticLoadDeg: number;
  /** Friction-hitch self-belay on a fixed rope: no terrain fall below this angle (CR-23). */
  safeGrabbingMaxDeg: number;
}

export interface Hazards {
  fall: {
    pFallMax: number;
    baseByAngle: { maxDeg: number; p: number }[];
    surface: Record<Surface, number>;
    method: { hand: number };
    mistakes: {
      winterNoCrampons: { factor: number; minDeg: number };
      overloaded: number;
      uncoordinated: number;
      crowdedSegment: number;
      unwarnedRock: number;
    };
  };
  knots: {
    ratings: Record<KnotRating, { static: number; shock: number }>;
    modifiers: {
      missingControl: { shock: number; static: number };
      turnsBelowMin: { shock: number };
      constantLoadOnlyShock: { shock: number };
      diameterRatio: { min: number; max: number; shock: number };
      carabinerMissing: { shock: number };
      minSupportDiameter: { shock: number };
      cordNotLooped: { shock: number };
      twoCarabinersMissing: { shock: number };
    };
  };
  anchors: Record<"tree_large" | "tree_small" | "rock_outcrop" | "bolt", { shock: number; static: number }>;
  carabiner: { nonLockingShock: number };
  injury: {
    slackM: number;
    slideInjuryThresholdM: number;
    slideInjuryMinDeg: number;
    pInjurySlideProtected: number;
    /** Caught belay fall (CR-28): p = min(max, perM × (length − freeM)). */
    longFall: { freeM: number; perM: { rock: number; default: number }; max: number };
    helmetFactor: number;
    pBelayerPulled: number;
    belayerPulledMinDeg: number;
    unprotected: { minSlideM: number; minDeg: number; p: number; pRock: number; stopBelowDeg: number };
  };
  rockfall: {
    pDislodge: Partial<Record<Surface, number>>;
    pHit: number;
    pInjuryRock: number;
    helmetFactor: number;
  };
}

export interface ActionDurations {
  attach: { hand: number; lanyard_carabiner: number; grabbing_knot: number };
  clip: number;
  tieKnot: number;
  perControlKnot: number;
  fixDoubled: number;
  belay: number;
  stopBelay: number;
  move: { base: number; perDegreeAbove: number; aboveDeg: number };
  makeBase: number;
  command: number;
  detach: { attachment: number; untie: number; unclip: number; dismantle_base: number; coil: number; pull_down: number; release: number; haul: number; untieExtraThinHitch: number };
  passPerItem: number;
  maxPassItems: number;
  pickupPerItem: number;
  wear: number;
  skip: number;
  ravine: { holdEscort: number; takeEnd: number; buildPulley: number; rigRetrieval: number; retrieve: number };
}

/** Ravine crossing rules (CR-54 … CR-58, ravine.json). */
export interface RavineRules {
  /** Selectable поліспаст ratios 1:n (CR-61): tension = pullers × n. */
  pulleyRatios: number[];
  pulleyCarabiners: number;
  /** Tension from which the перила hardly sag. */
  goodTension: number;
  /** «Тягнемо!» brings every free member within this path distance to the поліспаст (CR-66). */
  pullRadiusM: number;
  /** Metres along the перила per step. */
  traverseMoveM: number;
  /** Move factor on sagging (weakly tensioned) перила. */
  sagMoveFactor: number;
  score: { base: number; sagPoints: number; lostItemPoints: Record<string, number> };
}

export interface CommandDef {
  key: CommandKey;
  textKey: string;
  hintKey: string;
  /** Plausible wrong phrasings for the language practice option (§12.2.3). */
  wrongKeys: string[];
}

export interface ProtocolRule {
  id: string;
  enabled: boolean;
  severity: "hint" | "warning";
  messageKey: string;
  /** Physical effect in MVP (P1/P2/P4 raise fall chance, P5 is physical). */
  physical: boolean;
}

export interface EquipmentDef {
  type: ItemType;
  nameKey: string;
  icon: string;
  wearable: boolean;
  defaults: ItemProps;
}

export type KnotCategory =
  | "join_same"
  | "join_diff"
  | "loop"
  | "attach_support"
  | "grabbing"
  | "braking";

export interface KnotDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  enRef: string;
  category: KnotCategory;
  controlKnotsRequired: number;
  minTurns?: number;
  /** Turns from which a control knot is no longer needed (half-hitch knots). */
  controlNotNeededFromTurns?: number;
  constantLoadOnly?: boolean;
  /** Cord must be a closed loop (both ends loaded / joined). */
  endsMustBeJoined?: boolean;
  /** Grabbing knots: allowed cord:rope diameter ratio. */
  diameterRatio?: { min: number; max: number; ideal: number };
  /** "thick" = support must be thick (≥ 2 carabiner lengths). */
  minSupport?: "thick";
  requires: ("locking_carabiner" | "two_carabiners")[];
  releasable?: boolean;
  /** Extra seconds to untie when tied around a thin support (§13.6.3). */
  untieExtraThin?: boolean;
  /** Braking knots that can feed rope in lower belay. */
  feedsInLowerBelay?: boolean;
  icon: string;
}

export interface ContextRatingEntry {
  rating: KnotRating;
  /** Rating only applies if a locking carabiner is used; otherwise `otherwise`. */
  requires?: "locking_carabiner";
  otherwise?: KnotRating;
  messageKey?: string;
}

export interface ContextDef {
  nameKey: string;
  ratings: Record<string, KnotRating | ContextRatingEntry>;
  default: KnotRating;
  /** A belay device instead of a knot is correct here. */
  deviceRating?: KnotRating;
}

export interface GlossaryEntry {
  key: string;
}

/** Standard weights (CR-7): defaults in weights.json, values in use come from the app settings. */
export interface EquipmentWeights {
  backpackBaseKg: number;
  /** Per metre at 10 mm; scales with (diameter / 10)² (D-38). */
  ropePerMeterKg: number;
  cordPerMeterKg: number;
  slingKg: { "60": number; "120": number; "240": number };
  carabinerKg: { locking: number; nonLocking: number };
  belayDeviceKg: { atc: number; figure8: number };
  harnessKg: number;
  helmetKg: number;
  lanyardKg: number;
  glovesKg: number;
  cramponsKg: number;
  iceAxeKg: number;
  ascenderKg: number;
}

/** Seasons and weather (CR-11, seasons.json). */
export interface SeasonsData {
  seasons: Record<Season, { pRain: number; pMud: number }>;
  surfaceMap: { winter: Record<ConfigSurface, Surface>; rain: Partial<Record<ConfigSurface, Surface>>; mud: Partial<Record<ConfigSurface, Surface>> };
}

/** Personal equipment every member gets automatically (CR-14, individual.json). */
export interface IndividualEntry {
  type: ItemType;
  as: "worn" | "carried";
  count?: number;
  props?: ItemProps;
}

export interface GameData {
  rules: Rules;
  hazards: Hazards;
  actions: ActionDurations;
  commands: CommandDef[];
  protocol: ProtocolRule[];
  equipment: EquipmentDef[];
  knots: KnotDef[];
  contexts: Record<KnotContext, ContextDef>;
  glossary: string[];
  weights: EquipmentWeights;
  seasons: SeasonsData;
  individual: { always: IndividualEntry[]; winter: IndividualEntry[] };
  ravine: RavineRules;
}
