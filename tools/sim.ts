// Headless runner (ARCHITECTURE §8.3): prints the journal of a scenario + history.
//   npm run sim -- scenario.json history.json [uk|en]
import { readFileSync } from "node:fs";
import { gameData } from "../src/data/load";
import { createEngine } from "../src/engine";
import { locale, tl, type Locale } from "../src/i18n/i18n";
import { localizeParams } from "../src/ui/format";
import type { PlannedAction, Scenario } from "../src/engine/model/types";

const [scPath, histPath, loc = "uk"] = process.argv.slice(2);
if (!scPath) {
  console.error("usage: npm run sim -- scenario.json [history.json] [uk|en]");
  process.exit(1);
}
locale.value = loc as Locale;
const engine = createEngine(gameData);
const scenario = JSON.parse(readFileSync(scPath, "utf8")) as Scenario;
const history = histPath ? (JSON.parse(readFileSync(histPath, "utf8")) as PlannedAction[][]) : [];
const state = engine.replay(scenario, history);
for (const e of state.log) {
  const params = localizeParams(state, e.params) as Record<string, unknown>;
  console.log(`${String(e.step).padStart(3)} ${e.severity.padEnd(7)} ${tl(loc as Locale, e.messageKey, params)}`);
}
console.log(`\noutcome: ${state.outcome}, steps: ${state.step}, simulated time: ${state.simTimeS} s`);
