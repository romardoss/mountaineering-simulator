// Loads the bundled JSON rule data into a typed, frozen GameData (ARCHITECTURE §5).
import type { ContextDef, GameData } from "../engine/data/types";
import type { HillConfig, KnotContext } from "../engine/model/types";
import type { KitDef } from "../engine/scenario/kit";
import rules from "./rules.json";
import hazards from "./hazards.json";
import actions from "./actions.json";
import commands from "./commands.json";
import protocol from "./protocol.json";
import equipment from "./equipment.json";
import knots from "./knots.json";
import contexts from "./contexts.json";
import glossary from "./glossary.json";
import weights from "./weights.json";
import seasons from "./seasons.json";
import individual from "./individual.json";
import ravine from "./ravine.json";
import typicalKit from "./presets/kits/typical.json";
import rocky from "./presets/hills/skelno-osypnyi.json";
import overSummit from "./presets/hills/cherez-vershynu.json";
import osinniiLyst from "./presets/hills/osinnii-lyst-2026-2-2.json";
import skelnyiYar from "./presets/ravines/skelnyi-yar.json";

export const gameData: GameData = Object.freeze({
  rules,
  hazards,
  actions,
  commands,
  protocol,
  equipment,
  knots,
  contexts: contexts as unknown as Record<KnotContext, ContextDef>,
  glossary,
  weights,
  seasons,
  individual,
  ravine,
} as unknown as GameData);

/** Built-in hills, default first (§7.3.1.2); only these three are offered (CR-48). */
export const hillPresets: HillConfig[] = [rocky, overSummit, osinniiLyst] as unknown as HillConfig[];

/** Built-in ravines (CR-52): same HillConfig shape, `type: "ravine"`. */
export const ravinePresets: HillConfig[] = [skelnyiYar] as unknown as HillConfig[];

/** Every built-in obstacle (hills, then ravines). */
export const obstaclePresets: HillConfig[] = [...hillPresets, ...ravinePresets];

export const kits: KitDef[] = [typicalKit as unknown as KitDef];
