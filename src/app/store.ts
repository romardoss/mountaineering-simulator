// Session store (ARCHITECTURE §6.1). Preact components and the Phaser scene both read it.
import { computed, signal } from "@preact/signals";
import { createEngine } from "../engine";
import { gameData, hillPresets, kits } from "../data/load";
import type { ActionParams, GameEvent, GameState, HillConfig, MemberConfig, PlannedAction, Scenario, Season } from "../engine/model/types";
import { buildKit } from "../engine/scenario/kit";
import { settings } from "./settings";

export const engine = createEngine(gameData);
export const data = gameData;

export type RouteName =
  | "menu"
  | "obstacle"
  | "hill"
  | "season"
  | "team"
  | "equipment"
  | "readiness"
  | "game"
  | "results"
  | "glossary"
  | "knots"
  | "settings"
  | "scenarios"
  | "library"
  | "hill_editor";

export interface Route {
  name: RouteName;
  /** Screen to go back to (for glossary / knots / settings opened from elsewhere). */
  back?: RouteName;
}

export const route = signal<Route>({ name: "menu" });

export function go(name: RouteName, back?: RouteName) {
  route.value = { name, back };
}

// ---------------------------------------------------------------- draft scenario (configuration screens)

export const DEFAULT_NAMES = ["Оксана", "Тарас", "Марія", "Богдан", "Ірина", "Андрій", "Соломія", "Остап", "Леся", "Микола"];

export const SPRITE_ROWS = 7;

/** A random sprite row not in `used` (visual only, CR-4); any row when all are taken. */
export function randomFreeRow(used: Iterable<number>): number {
  const taken = new Set(used);
  const free = Array.from({ length: SPRITE_ROWS }, (_, r) => r).filter((r) => !taken.has(r));
  const pool = free.length ? free : Array.from({ length: SPRITE_ROWS }, (_, r) => r);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function defaultTeam(n: number): MemberConfig[] {
  const team: MemberConfig[] = [];
  for (let i = 0; i < n; i++) {
    team.push({
      id: `m${i + 1}`,
      name: DEFAULT_NAMES[i % DEFAULT_NAMES.length],
      appearance: { row: randomFreeRow(team.map((m) => m.appearance.row)) },
    });
  }
  return team;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function defaultScenario(hill: HillConfig = hillPresets[0]): Scenario {
  const team = defaultTeam(data.rules.team.default);
  return {
    schemaVersion: 1,
    id: `sc_${Date.now().toString(36)}`,
    name: "",
    route: { obstacles: [structuredClone(hill)] },
    season: "summer",
    mode: "learning",
    seed: newSeed(),
    team,
    items: buildKit(data, kits[0], team, "summer"),
    maxSteps: null,
    weights: settings.value.weights,
  };
}

/** Weights always come from Settings (CR-7): use this wherever a configured scenario is shown, validated or started. */
export function withWeights(sc: Scenario): Scenario {
  return { ...sc, weights: settings.value.weights };
}

export const draft = signal<Scenario>(defaultScenario());

/** Hill open in the obstacle constructor (CR-1); never the draft's hill. */
export const editingHill = signal<HillConfig | null>(null);

export function updateDraft(patch: Partial<Scenario> | ((d: Scenario) => Scenario)) {
  draft.value = typeof patch === "function" ? patch(structuredClone(draft.value)) : { ...draft.value, ...patch };
}

// ---------------------------------------------------------------- game session

export interface Session {
  scenario: Scenario;
  state: GameState;
  history: PlannedAction[][];
  /** Planned main action per member for the current step. */
  plan: Record<string, ActionParams>;
  /** Planned command per member: it does not use the member's step (CR-37). */
  commands: Record<string, ActionParams>;
  /** Right-click targets (s) a member keeps walking to over several steps (CR-18); not autosaved. */
  goals: Record<string, number>;
  /** State before the last step (animation start). */
  prevState: GameState | null;
  lastEvents: GameEvent[];
  startedAt: number;
  /** Wall-clock play time in ms (§10.4.3). */
  realTimeMs: number;
}

export const session = signal<Session | null>(null);

/** Hill view → game screen requests (the view cannot render dialogs). */
export const commandDialogFor = signal<string | null>(null);
export interface BaseConfirm {
  memberId: string;
  params: ActionParams;
  missing: ("sling" | "carabiner")[];
}
export const baseConfirm = signal<BaseConfirm | null>(null);
export const selectedMember = signal<string | null>(null);
export const animating = signal(false);

export const activeMembers = computed(() => {
  const s = session.value;
  if (!s) return [];
  return s.scenario.team.map((m) => s.state.members[m.id]);
});

export interface ResultRecord {
  id: string;
  scenarioId: string;
  scenarioName: string;
  finishedAt: number;
  outcome: GameState["outcome"];
  stats: ReturnType<typeof engine.getStats>;
  realTimeMs: number;
  mode: Scenario["mode"];
  season: Season;
}

export const lastResult = signal<ResultRecord | null>(null);
