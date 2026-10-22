// Domain model (PRD §5). Everything here is plain, JSON-serialisable data.
import type { EquipmentWeights } from "../data/types";

export type MemberId = string;
export type ItemId = string;
export type BaseId = string;
export type KnotInstanceId = string;
export type AttachmentId = string;
export type BelayId = string;

/** PRD §5.2.6 — positions are (obstacleIndex, s) from day one. */
export interface Position {
  obstacleIndex: number;
  s: number;
}

export type Surface = "grass" | "ground" | "rock" | "scree" | "snow" | "icy_rock" | "snow_scree" | "mud" | "wet_rock";
export type ConfigSurface = "grass" | "ground" | "rock" | "scree";
export type Season = "spring" | "summer" | "autumn" | "winter";
/** Rolled once per game from the season (CR-11). */
export type Weather = "dry" | "mud" | "rain";
export type Mode = "learning" | "exam";
export type RouteType = "ascent" | "descent" | "ascent_descent";

// ---------------------------------------------------------------- obstacle

export interface SectionConfig {
  lengthM: number;
  angleDeg: number;
  surface: ConfigSurface;
}

export interface Section extends SectionConfig {
  direction: "up" | "down";
  /** s where the section starts (computed by normaliseHill). */
  startS: number;
}

export interface Tree {
  id: string;
  s: number;
  size: "small" | "large";
  kind?: "conifer" | "deciduous";
}

export type AnchorType = "tree" | "rock_outcrop" | "bolt";

export interface BasePoint {
  id: string;
  s: number;
  anchorType: AnchorType;
  treeId?: string;
}

/** Hill as configured (preset / editor / scenario file). */
export interface HillConfig {
  id: string;
  nameKey?: string;
  name?: string;
  type: "hill";
  routeType: RouteType;
  startZoneM: number;
  finishZoneM: number;
  summitZoneM?: number;
  /** ascent / descent: the only side; ascent_descent: the ascent side. */
  sections: SectionConfig[];
  /** ascent_descent only. */
  descentSections?: SectionConfig[];
  trees: Tree[];
  basePoints: BasePoint[];
}

export type Obstacle = HillConfig;

export interface Route {
  obstacles: Obstacle[];
}

// ---------------------------------------------------------------- team

export interface Appearance {
  /** Row in the team sprite sheets (0–6). */
  row: number;
  jacketColor?: string;
}

export interface MemberConfig {
  id: MemberId;
  name: string;
  appearance: Appearance;
}

export type MemberStatus = "ok" | "fallen_caught" | "injured" | "finished";

export interface MemberState {
  id: MemberId;
  name: string;
  appearance: Appearance;
  /** PRD §8.5 — kept for the future; the engine never reads it. */
  abilities: Record<string, never>;
  baseWeightKg: number;
  pos: Position;
  status: MemberStatus;
  /** Members hit by a warned rockfall lose their next action. */
  forcedSkipNextStep: boolean;
}

// ---------------------------------------------------------------- items

export type ItemType =
  | "rope"
  | "cord"
  | "sling"
  | "carabiner"
  | "belay_device"
  | "ascender"
  | "harness"
  | "helmet"
  | "lanyard"
  | "gloves"
  | "crampons"
  | "ice_axe"
  | "backpack";

export interface ItemProps {
  lengthM?: number;
  diameterMm?: number;
  kind?: "static" | "dynamic";
  color?: string;
  lengthCm?: number;
  locking?: boolean;
  shape?: "hms" | "d" | "oval";
  model?: "atc" | "figure8";
  arms?: number;
  /** Cord pre-tied into a loop in configuration (§9.3.4). */
  loopKnot?: { knotId: string; control: ControlKnot };
}

export interface ItemConfig {
  id: ItemId;
  type: ItemType;
  props: ItemProps;
  /** Pre-game assignment (§9.3). null = left at home (not taken). */
  assignedTo: { memberId: MemberId; as: "worn" | "carried" } | null;
}

export type StructureRef =
  | { kind: "rope"; ropeId: ItemId }
  | { kind: "base"; baseId: BaseId }
  | { kind: "attachment"; attachmentId: AttachmentId }
  | { kind: "belay"; belayId: BelayId }
  | { kind: "knot"; knotId: KnotInstanceId };

/** PRD §9.2.1 — every item has exactly one location. */
export type ItemLocation =
  | { kind: "carried"; memberId: MemberId }
  | { kind: "worn"; memberId: MemberId }
  | { kind: "in_use"; structure: StructureRef }
  | { kind: "on_ground"; pos: Position };

export interface ItemState {
  id: ItemId;
  type: ItemType;
  weightKg: number;
  props: ItemProps;
  location: ItemLocation;
}

// ---------------------------------------------------------------- structures

export type ControlKnot = "none" | "single" | "double";

export type RopeNodeAttach =
  | { kind: "member_harness"; memberId: MemberId; knotId: KnotInstanceId }
  | { kind: "base"; baseId: BaseId; mode: "fixed"; knotId: KnotInstanceId }
  | { kind: "base"; baseId: BaseId; mode: "running" }
  | { kind: "base"; baseId: BaseId; mode: "doubled" }
  | { kind: "belay"; belayId: BelayId }
  | { kind: "free" };

export interface RopeNode {
  id: string;
  /** Position of the node; for member_harness nodes it follows the member. */
  pos: Position;
  attach: RopeNodeAttach;
}

export interface RopeLayout {
  ropeId: ItemId;
  nodes: RopeNode[];
}

export type KnotContext =
  | "TIE_IN_END"
  | "TIE_IN_MIDDLE"
  | "ANCHOR_THICK"
  | "ANCHOR_THIN"
  | "ANCHOR_ROCK"
  | "ANCHOR_CARABINER"
  | "SELF_BELAY_GRAB"
  | "BELAY_LOWER"
  | "BELAY_UPPER"
  | "JOIN_SAME"
  | "JOIN_DIFF"
  | "LOOP_CORD";

export type KnotRating = "correct" | "acceptable" | "wrong" | "dangerous";

export interface KnotEvaluation {
  rating: KnotRating;
  failProbStatic: number;
  failProbShock: number;
  messages: { key: string; ruleId: string; params?: Record<string, string | number> }[];
}

export interface KnotInstance {
  id: KnotInstanceId;
  knotId: string;
  context: KnotContext;
  control: ControlKnot;
  turns: number | null;
  tiedBy: MemberId | null;
  step: number;
  preTied: boolean;
  /** What the knot is tied on. */
  itemId: ItemId;
  evaluation: KnotEvaluation;
  /** Exam mode: rating becomes visible once the knot is loaded. */
  revealed: boolean;
}

export type BaseConstruction = "sling" | "direct" | "bolt";

export interface BaseState {
  id: BaseId;
  basePointId: string;
  pos: Position;
  construction: BaseConstruction;
  /** Items used to build the base (sling, carabiner). */
  itemIds: ItemId[];
  /** Locking carabiner that ropes / lanyards / belays clip into (if any). */
  carabinerId: ItemId | null;
  builtBy: MemberId | null;
  step: number;
}

export type AttachMethod = "hand" | "lanyard_carabiner" | "grabbing_knot";

export type AttachTarget =
  | { kind: "segment"; ropeId: ItemId; lowerNodeId: string; upperNodeId: string }
  | { kind: "base"; baseId: BaseId };

export interface Attachment {
  id: AttachmentId;
  memberId: MemberId;
  method: AttachMethod;
  target: AttachTarget;
  itemIds: ItemId[];
  knotId: KnotInstanceId | null;
  step: number;
}

export type Braking =
  | { kind: "device"; itemId: ItemId; carabinerIds: ItemId[] }
  | { kind: "knot"; knotId: KnotInstanceId; carabinerIds: ItemId[] };

export interface BelayRelation {
  id: BelayId;
  belayerId: MemberId;
  climberId: MemberId;
  ropeId: ItemId;
  mode: "lower" | "upper";
  braking: Braking;
  anchor: { kind: "base"; baseId: BaseId } | { kind: "body" };
  step: number;
  /** Belayer–climber distance when the belay was set (Гарда feeds no rope beyond it + slack). */
  distanceAtSetM: number;
  /** Set during resolution when the belayer does something else this step (§11.3.3). */
  inactiveThisStep: boolean;
}

export interface PendingRockfall {
  id: string;
  createdStep: number;
  sourceMemberId: MemberId;
  pos: Position;
  threatened: MemberId[];
  warned: boolean;
}

// ---------------------------------------------------------------- protocol

export interface ProtocolState {
  /** Commands issued: per step, list of (member, command, recipient). */
  recent: { step: number; memberId: MemberId; command: string; recipient: MemberId | "all" }[];
  /** belayId -> step in which belay_ready was shouted for it. */
  belayReady: Record<BelayId, number>;
  /** belayId -> climber shouted go. */
  climberGo: Record<BelayId, number>;
  /** belayId -> climber shouted secured. */
  climberSecured: Record<BelayId, number>;
  /** Fixed rope segments declared ready (key: rope:lower:upper). */
  readySegments: Record<string, number>;
  /** Belays that have already been flagged for P1/P2 (one violation per belay). */
  flagged: Record<string, true>;
}

// ---------------------------------------------------------------- scenario, state

export interface Scenario {
  schemaVersion: 1;
  id: string;
  name: string;
  route: Route;
  season: Season;
  mode: Mode;
  seed: number;
  team: MemberConfig[];
  items: ItemConfig[];
  maxSteps: number | null;
  /** Snapshot of the weight settings, written by the app at game start (CR-7). */
  weights: EquipmentWeights;
}

export type Outcome = "in_progress" | "won" | "lost" | "aborted";

export interface RngState {
  algo: "mulberry32";
  s: number;
}

export interface GameState {
  schemaVersion: 1;
  scenario: Scenario;
  step: number;
  rng: RngState;
  outcome: Outcome;
  simTimeS: number;
  weather: Weather;
  members: Record<MemberId, MemberState>;
  items: Record<ItemId, ItemState>;
  ropes: Record<ItemId, RopeLayout>;
  knots: Record<KnotInstanceId, KnotInstance>;
  bases: Record<BaseId, BaseState>;
  attachments: Record<AttachmentId, Attachment>;
  belays: Record<BelayId, BelayRelation>;
  hazards: { pendingRockfalls: PendingRockfall[] };
  protocol: ProtocolState;
  stats: StatsCounters;
  log: GameEvent[];
  /** Counter for generated ids (deterministic). */
  nextId: number;
  /** Initial item id set (§9.2.2). */
  itemIds: ItemId[];
}

// ---------------------------------------------------------------- events

export type ResolutionPhase =
  | "setup"
  | "commands"
  | "detach"
  | "build"
  | "attach"
  | "belay"
  | "movement"
  | "hazardRolls"
  | "hazardResolution"
  | "bookkeeping";

export type Severity = "info" | "hint" | "warning" | "danger";

export interface RollRecord {
  key: string;
  p: number;
  roll: number;
  hit: boolean;
}

export interface GameEvent {
  id: string;
  step: number;
  phase: ResolutionPhase;
  type: string;
  severity: Severity;
  messageKey: string;
  params: Record<string, string | number>;
  refs: {
    members?: MemberId[];
    items?: ItemId[];
    knots?: KnotInstanceId[];
    ruleIds?: string[];
    rolls?: RollRecord[];
  };
}

// ---------------------------------------------------------------- stats

export interface MemberStats {
  activeSteps: number;
  skippedSteps: number;
  forcedSkips: number;
  distanceUpM: number;
  distanceDownM: number;
  falls: number;
  knots: Record<KnotRating, number>;
  commands: number;
  maxWeightKg: number;
  overloadedSteps: number;
}

export interface StatsCounters {
  steps: number;
  falls: { total: number; selfBelay: number; belay: number; unprotected: number };
  injuries: { memberId: MemberId; causeKey: string; params: Record<string, string | number> }[];
  knots: { total: number; correct: number; acceptable: number; wrong: number; dangerous: number; missingControl: number; preTied: number };
  commands: { issued: number; violations: Record<string, number> };
  rockfall: { total: number; warned: number; hits: number };
  members: Record<MemberId, MemberStats>;
  /** Every knot tied during the game (results screen, exam reveal). */
  knotHistory: { id: string; knotId: string; context: KnotContext; rating: KnotRating; tiedBy: MemberId | null; step: number; preTied: boolean; messages: string[] }[];
  /** Learning summary entries (§16.3). */
  mistakes: { step: number; key: string; params: Record<string, string | number>; ref?: string }[];
}

// ---------------------------------------------------------------- actions

export type CommandKey =
  | "belay_ready"
  | "go"
  | "stop"
  | "take_in"
  | "give_slack"
  | "secured"
  | "fixed_rope_ready"
  | "fixed_rope_free"
  | "rock"
  | "hold"
  | "understood";

export interface KnotChoice {
  knotId: string;
  control: ControlKnot;
  turns: number | null;
}

export type ActionParams =
  | { kind: "skip" }
  | { kind: "command"; command: CommandKey; recipient: MemberId | "all"; misunderstood?: boolean }
  | { kind: "move"; toward: "finish" | "start"; distanceM: number; /** Right-click target (display only, CR-18). */ targetS?: number }
  | { kind: "attach"; method: AttachMethod; target: AttachTarget; knot?: KnotChoice }
  | { kind: "clip"; ropeId: ItemId; baseId: BaseId }
  | { kind: "tie_in"; ropeId: ItemId; knot: KnotChoice; viaCarabiner: boolean }
  | { kind: "fix_rope"; ropeId: ItemId; baseId: BaseId; method: "knot" | "doubled"; knot?: KnotChoice }
  | { kind: "make_base"; basePointId: string; construction: BaseConstruction }
  | { kind: "belay"; climberId: MemberId; braking: "device" | "knot"; knot?: KnotChoice; anchor: "base" | "body" }
  | { kind: "stop_belay"; belayId: BelayId }
  | { kind: "detach"; what: DetachTarget }
  | { kind: "pass"; toMemberId: MemberId; itemIds: ItemId[] }
  | { kind: "pickup"; itemIds: ItemId[] }
  | { kind: "wear"; itemId: ItemId };

export type DetachTarget =
  | { kind: "attachment"; attachmentId: AttachmentId }
  | { kind: "untie"; ropeId: ItemId; nodeId: string }
  | { kind: "unclip"; ropeId: ItemId; nodeId: string }
  | { kind: "dismantle_base"; baseId: BaseId }
  | { kind: "coil"; ropeId: ItemId }
  | { kind: "pull_down"; ropeId: ItemId };

export type ActionKind = ActionParams["kind"];

export interface PlannedAction {
  memberId: MemberId;
  params: ActionParams;
}
