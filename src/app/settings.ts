// Settings (§6.1.1): language, bilingual term hints, phrase choice, pixel scale, sound.
import { effect, signal } from "@preact/signals";
import { locale, type Locale } from "../i18n/i18n";
import { gameData } from "../data/load";
import type { EquipmentWeights } from "../engine/data/types";
import { KEYS, load, save } from "./persistence/storage";

export interface Settings {
  locale: Locale;
  /** null = automatic: on in English, hover tooltips in Ukrainian. */
  termHints: boolean | null;
  phraseChoice: boolean;
  pixelScale: 0 | 2 | 3 | 4;
  sound: boolean;
  animationSpeed: 1 | 2 | 4;
  /** Base backpack and standard equipment weights — set only here (CR-7). */
  weights: EquipmentWeights;
}

export const DEFAULT_WEIGHTS: EquipmentWeights = gameData.weights;

const DEFAULTS: Settings = { locale: "uk", termHints: null, phraseChoice: false, pixelScale: 0, sound: false, animationSpeed: 1, weights: structuredClone(DEFAULT_WEIGHTS) };

/** Stored weights are merged over the defaults key by key, so new weight kinds get their default. */
function mergeWeights(stored: Partial<EquipmentWeights> | undefined): EquipmentWeights {
  const w = structuredClone(DEFAULT_WEIGHTS) as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(stored ?? {})) {
    if (typeof v === "number" && typeof w[k] === "number") w[k] = v;
    else if (v && typeof v === "object" && w[k] && typeof w[k] === "object") w[k] = { ...(w[k] as object), ...v };
  }
  return w as unknown as EquipmentWeights;
}

const stored = load<Partial<Settings>>(KEYS.settings, {});
export const settings = signal<Settings>({ ...DEFAULTS, ...stored, weights: mergeWeights(stored.weights) });

locale.value = settings.value.locale;

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch };
}

effect(() => {
  const s = settings.value;
  locale.value = s.locale;
  save(KEYS.settings, s);
  if (typeof document !== "undefined") document.documentElement.lang = s.locale;
});

export function bilingualHints(): boolean {
  const s = settings.value;
  return s.termHints ?? s.locale === "en";
}
