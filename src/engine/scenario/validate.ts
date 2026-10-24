// Scenario / hill validation (§7.3.2), equipment validation (§9.3.6–7), readiness check (§6.1.7).
import type { GameData } from "../data/types";
import { defaultWeight, individualKg, isIndividual } from "./kit";
import { basePointsOf, buildHillGeometry, normaliseSections } from "../geometry/hill";
import type { HillConfig, ItemConfig, MemberConfig, Scenario } from "../model/types";

export interface Issue {
  level: "error" | "warning";
  key: string;
  params?: Record<string, string | number>;
}

export function validateHill(data: GameData, hill: HillConfig): Issue[] {
  const out: Issue[] = [];
  const r = data.rules.hill;
  const sections = normaliseSections(hill);
  if (sections.length === 0) out.push({ level: "error", key: "validate.no_sections" });
  for (const [i, s] of sections.entries()) {
    if (s.lengthM < r.sectionLengthM[0] || s.lengthM > r.sectionLengthM[1]) out.push({ level: "error", key: "validate.section_length", params: { n: i + 1, min: r.sectionLengthM[0], max: r.sectionLengthM[1] } });
    if (s.angleDeg < r.angleDeg[0] || s.angleDeg > r.angleDeg[1]) out.push({ level: "error", key: "validate.section_angle", params: { n: i + 1, max: r.angleDeg[1] } });
  }
  const total = sections.reduce((a, s) => a + s.lengthM, 0);
  if (total < r.minTotalM || total > r.maxTotalM) out.push({ level: "error", key: "validate.total_length", params: { total: Math.round(total), min: r.minTotalM, max: r.maxTotalM } });
  if (out.some((i) => i.level === "error")) return out;
  const geo = buildHillGeometry(hill);
  // Bases are built by members during the game; only a base spot at the finish is mandatory (CR-2).
  const spots = basePointsOf(hill); // incl. large trees (CR-31)
  if (!spots.some((b) => b.s >= geo.finishStart && b.s <= geo.totalLength)) out.push({ level: "error", key: "validate.no_finish_base" });
  // a ravine needs an anchor for the перила on the start bank too (CR-52)
  if (hill.type === "ravine" && !spots.some((b) => b.s <= geo.startZoneEnd)) out.push({ level: "error", key: "validate.no_start_base_ravine" });
  for (const bp of hill.basePoints) {
    if (bp.s < 0 || bp.s > geo.totalLength) out.push({ level: "error", key: "validate.base_outside", params: { id: bp.id } });
    if (bp.anchorType === "tree" && !hill.trees.some((t) => t.id === bp.treeId)) out.push({ level: "error", key: "validate.base_tree_missing", params: { id: bp.id } });
  }
  for (const [i, s] of sections.entries()) {
    if (s.angleDeg >= r.steepWarnDeg && s.lengthM > r.steepWarnLenM) {
      const hasBp = spots.some((b) => b.s > s.startS + 0.5 && b.s < s.startS + s.lengthM - 0.5);
      if (!hasBp) out.push({ level: "warning", key: "validate.steep_without_base", params: { n: i + 1, angle: s.angleDeg, length: s.lengthM } });
    }
  }
  return out;
}

/** Configured items of a member; individual-equipment items (old files) are ignored. */
export function itemsOfMember(data: GameData, items: ItemConfig[], memberId: string): ItemConfig[] {
  return items.filter((i) => i.assignedTo?.memberId === memberId && !isIndividual(data, i.type));
}

/** Base backpack + individual equipment + assigned team gear, all from the weight settings (CR-7, CR-14). */
export function memberLoadKg(data: GameData, sc: Pick<Scenario, "weights" | "season" | "items">, memberId: string): number {
  const w = sc.weights;
  return w.backpackBaseKg + individualKg(data, w, sc.season) + itemsOfMember(data, sc.items, memberId).reduce((s, i) => s + defaultWeight(w, i.type, i.props), 0);
}

export function validateTeam(data: GameData, team: MemberConfig[]): Issue[] {
  const out: Issue[] = [];
  const t = data.rules.team;
  if (team.length < t.min || team.length > t.max) out.push({ level: "error", key: "validate.team_size", params: { min: t.min, max: t.max } });
  if (new Set(team.map((m) => m.id)).size !== team.length) out.push({ level: "error", key: "validate.duplicate_member" });
  for (const m of team) if (!m.name.trim()) out.push({ level: "error", key: "validate.empty_name" });
  return out;
}

/** Equipment validation (§9.3.6 warnings, §9.3.7 errors). */
export function validateEquipment(data: GameData, scenario: Scenario): Issue[] {
  const out: Issue[] = [];
  const { items, team } = scenario;
  const w = data.rules.weight;
  for (const m of team) {
    const mine = itemsOfMember(data, items, m.id);
    const kg = memberLoadKg(data, scenario, m.id);
    if (kg > w.maxKg + 1e-9) out.push({ level: "error", key: "validate.over_max", params: { member: m.name, kg: round1(kg), max: w.maxKg } });
    else if (kg > w.heavyKg + 1e-9) out.push({ level: "warning", key: "validate.heavy", params: { member: m.name, kg: round1(kg) } });
    for (const i of mine) {
      const def = data.equipment.find((e) => e.type === i.type);
      if (i.assignedTo?.as === "worn" && !def?.wearable) out.push({ level: "error", key: "validate.not_wearable", params: { member: m.name, item: i.type } });
    }
  }
  const taken = items.filter((i) => i.assignedTo);
  if (!taken.some((i) => i.type === "carabiner" && i.props.locking && i.props.shape === "hms")) out.push({ level: "warning", key: "validate.no_hms" });
  const hill = scenario.route.obstacles[0];
  if (hill) {
    // a ravine rope must reach from bank to bank along the ground (CR-52)
    const longest = hill.type === "ravine" ? Math.round(buildHillGeometry(hill).finishStart - hill.startZoneM + 4) : Math.max(0, ...normaliseSections(hill).map((s) => s.lengthM));
    const ropes = taken.filter((i) => i.type === "rope");
    if (ropes.length === 0) out.push({ level: "warning", key: "validate.no_rope" });
    else if (Math.max(...ropes.map((r) => r.props.lengthM ?? 0)) < longest) out.push({ level: "warning", key: "validate.rope_short", params: { longest } });
  }
  const unassigned = items.filter((i) => !i.assignedTo && !isIndividual(data, i.type));
  if (unassigned.length) out.push({ level: "warning", key: "validate.unassigned", params: { count: unassigned.length } });
  return out;
}

export function validateScenario(data: GameData, scenario: Scenario): Issue[] {
  if (!scenario.route.obstacles.length) return [{ level: "error", key: "validate.no_obstacle" }];
  return [...validateHill(data, scenario.route.obstacles[0]), ...validateTeam(data, scenario.team), ...validateEquipment(data, scenario)];
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
