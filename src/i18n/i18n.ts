// i18n (§19, ARCHITECTURE §7.3): flat keys, ICU MessageFormat, Ukrainian plurals.
// Locale files are split per area: src/i18n/locales/<locale>/<area>.json.
import { signal } from "@preact/signals";
import { IntlMessageFormat } from "intl-messageformat";

export type Locale = "uk" | "en";
type Dict = Record<string, string>;

function merge(mods: Record<string, unknown>): Dict {
  const out: Dict = {};
  for (const m of Object.values(mods)) Object.assign(out, (m as { default: Dict }).default ?? m);
  return out;
}

export const dictionaries: Record<Locale, Dict> = {
  uk: merge(import.meta.glob("./locales/uk/*.json", { eager: true })),
  en: merge(import.meta.glob("./locales/en/*.json", { eager: true })),
};

export const locale = signal<Locale>("uk");

const cache = new Map<string, IntlMessageFormat>();

export function hasKey(key: string, loc: Locale = locale.value): boolean {
  return key in dictionaries[loc];
}

export function tl(loc: Locale, key: string, params?: Record<string, unknown>): string {
  const src = dictionaries[loc][key];
  if (src === undefined) return import.meta.env?.DEV ? `⟦${key}⟧` : key;
  if (!params || !src.includes("{")) return src;
  const ck = `${loc}\u0000${key}`;
  let f = cache.get(ck);
  if (!f) {
    f = new IntlMessageFormat(src, loc === "uk" ? "uk-UA" : "en-GB");
    cache.set(ck, f);
  }
  try {
    return String(f.format(params as Record<string, string | number>));
  } catch {
    return src;
  }
}

/** Translate in the active locale. Reading `locale.value` subscribes Preact components. */
export function t(key: string, params?: Record<string, unknown>): string {
  return tl(locale.value, key, params);
}

/** Ukrainian original (for bilingual term hints and command bubbles). */
export function tUk(key: string, params?: Record<string, unknown>): string {
  return tl("uk", key, params);
}
