// Obstacle library (CR-1): built-in hill and ravine presets + user-made hills from the constructor.
import { obstaclePresets } from "../data/load";
import type { HillConfig, ObstacleType } from "../engine/model/types";
import { KEYS, load, save } from "./persistence/storage";

export function isPreset(id: string): boolean {
  return obstaclePresets.some((p) => p.id === id);
}

export function userHills(): HillConfig[] {
  return load<HillConfig[]>(KEYS.obstacles, []);
}

/** Every playable obstacle of one kind: presets first (default first), then user hills (hills only, CR-52). */
export function libraryHills(type: ObstacleType = "hill"): HillConfig[] {
  return [...obstaclePresets, ...userHills()].filter((h) => (h.type ?? "hill") === type);
}

/** Insert or replace by id. Presets are read-only. */
export function saveUserHill(hill: HillConfig): boolean {
  if (isPreset(hill.id)) return false;
  const list = userHills();
  const i = list.findIndex((h) => h.id === hill.id);
  if (i >= 0) list[i] = hill;
  else list.push(hill);
  return save(KEYS.obstacles, list);
}

export function deleteUserHill(id: string) {
  save(KEYS.obstacles, userHills().filter((h) => h.id !== id));
}
