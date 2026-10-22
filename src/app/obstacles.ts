// Obstacle library (CR-1): built-in hill presets + user-made hills from the constructor.
import { hillPresets } from "../data/load";
import type { HillConfig } from "../engine/model/types";
import { KEYS, load, save } from "./persistence/storage";

export function isPreset(id: string): boolean {
  return hillPresets.some((p) => p.id === id);
}

export function userHills(): HillConfig[] {
  return load<HillConfig[]>(KEYS.obstacles, []);
}

/** Every playable hill: presets first (default preset first), then user hills. */
export function libraryHills(): HillConfig[] {
  return [...hillPresets, ...userHills()];
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
