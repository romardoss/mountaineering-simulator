// Data validation (§21) and locale completeness (§24.2.15).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { gameData, hillPresets, kits } from "../../src/data/load";
import { validateHill } from "../../src/engine/scenario/validate";
import { buildKit, isIndividual } from "../../src/engine/scenario/kit";
import { team } from "../engine/dsl";

const root = join(__dirname, "../../src");
function locale(loc: string): Record<string, string> {
  const dir = join(root, "i18n/locales", loc);
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir)) Object.assign(out, JSON.parse(readFileSync(join(dir, f), "utf8")));
  return out;
}
const uk = locale("uk");
const en = locale("en");

describe("§21 data files", () => {
  it("every rating in contexts.json references an existing knot", () => {
    const ids = new Set(gameData.knots.map((k) => k.id));
    for (const [ctx, def] of Object.entries(gameData.contexts)) for (const k of Object.keys(def.ratings)) expect(ids.has(k), `${ctx}: ${k}`).toBe(true);
  });
  it("probabilities are within [0, 1]", () => {
    const walk = (o: unknown, path: string) => {
      if (typeof o === "number" && /(^|\.)p[A-Z_]|\.p$|shock|static|pHit|pInjury|pFall|pDislodge/.test(path)) {
        expect(o, path).toBeGreaterThanOrEqual(0);
        expect(o, path).toBeLessThanOrEqual(1);
      } else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
    };
    walk(gameData.hazards, "hazards");
  });
  it("hill presets are valid and kits build", () => {
    for (const h of hillPresets) expect(validateHill(gameData, h).filter((i) => i.level === "error"), h.id).toEqual([]);
    // team gear only; individual equipment is automatic (CR-14)
    for (const n of [2, 5, 7]) {
      const kit = buildKit(gameData, kits[0], team(n), "winter");
      expect(kit.length).toBeGreaterThan(n * 3);
      expect(kit.filter((i) => isIndividual(gameData, i.type))).toEqual([]);
    }
    for (const e of [...gameData.individual.always, ...gameData.individual.winter]) expect(gameData.equipment.some((d) => d.type === e.type), e.type).toBe(true);
  });
  it("every knot, term, item, command and context has text in both locales", () => {
    const keys = [
      ...gameData.knots.flatMap((k) => [k.nameKey, k.descriptionKey]),
      ...gameData.glossary.flatMap((g) => [g, `${g}.meaning`]),
      ...gameData.equipment.map((e) => e.nameKey),
      ...gameData.commands.flatMap((c) => [c.textKey, c.hintKey, ...c.wrongKeys]),
      ...Object.values(gameData.contexts).map((c) => c.nameKey),
      ...gameData.protocol.map((r) => r.messageKey),
      ...hillPresets.map((h) => h.nameKey!),
    ];
    for (const k of keys) {
      expect(uk[k], `uk ${k}`).toBeTruthy();
      expect(en[k], `en ${k}`).toBeTruthy();
    }
  });
});

describe("§24.2.15 locale completeness", () => {
  it("every key exists in uk and en", () => {
    expect(Object.keys(uk).filter((k) => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter((k) => !(k in uk))).toEqual([]);
  });
  it("every message parses as ICU", () => {
    for (const [loc, d] of [["uk-UA", uk], ["en-GB", en]] as const) for (const [k, v] of Object.entries(d)) expect(() => new IntlMessageFormat(v, loc), `${loc} ${k}`).not.toThrow();
  });
  it("every i18n key literal used in src exists", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(join(d, f.name));
        else if (/\.(ts|tsx)$/.test(f.name)) files.push(join(d, f.name));
      }
    };
    walk(root);
    const prefixes = "event|reason|hint|knot\\.msg|summary|injury|factor|action|validate|rule|ui|cmd|term|status|zone|outcome|group";
    const re = new RegExp(`["'\`]((?:${prefixes})\\.[a-z0-9_.]+)["'\`]`, "g");
    const missing = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(re)) if (!m[1].endsWith(".") && !(m[1] in uk) && !/type:\s*$/.test(src.slice(Math.max(0, m.index! - 8), m.index))) missing.add(`${m[1]}  (${f.replace(root, "src")})`);
    }
    expect([...missing]).toEqual([]);
  });
});
