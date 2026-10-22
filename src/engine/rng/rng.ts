// Seeded PRNG (mulberry32). Its whole state lives in GameState.rng (§0.2.2).
import type { RngState, RollRecord } from "../model/types";

export function createRng(seed: number): RngState {
  return { algo: "mulberry32", s: seed >>> 0 };
}

/** Advances the state in place and returns a float in [0, 1). */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Forced roll outcomes for tests (ARCHITECTURE §4.6.3). A key maps to `true`
 * (event happens) or `false`. Patterns ending in `*` match by prefix.
 */
export type RollScript = Record<string, boolean>;

export function scriptedOutcome(script: RollScript | undefined, key: string): boolean | undefined {
  if (!script) return undefined;
  if (key in script) return script[key];
  let best: string | undefined;
  for (const k of Object.keys(script)) {
    if (k.endsWith("*") && key.startsWith(k.slice(0, -1)) && (!best || k.length > best.length)) best = k;
  }
  return best ? script[best] : undefined;
}

/** Named roll: always advances the PRNG so forcing one roll never shifts the others. */
export function roll(rng: RngState, key: string, p: number, script?: RollScript): RollRecord {
  const r = nextFloat(rng);
  const forced = scriptedOutcome(script, key);
  const hit = forced ?? (p > 0 && r < p);
  return { key, p, roll: r, hit };
}
