// Runtime validation of imported user scenarios (§6.2.1, ARCHITECTURE §5.2).
import Ajv from "ajv";
import schema from "../../data/schemas/scenario.schema.json";
import type { ItemConfig, Scenario } from "../../engine/model/types";
import { withWeights } from "../store";
import { normaliseGear } from "../gear";
import { isIndividual } from "../../engine/scenario/kit";
import { gameData } from "../../data/load";

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile<Scenario>(schema);

export interface ImportResult {
  ok: boolean;
  scenario?: Scenario;
  errors: string[];
}

export function validateScenarioJson(x: unknown): ImportResult {
  if (validate(x)) {
    // legacy member.role (CR-3) and weights (CR-7) are accepted and dropped; weights come from Settings
    // individual equipment is automatic (CR-14)
    const items = x.items.filter((i) => !isIndividual(gameData, i.type)).map(({ id, type, props, assignedTo }): ItemConfig => {
      const { baseWeightKg: _legacy, ...rest } = props as typeof props & { baseWeightKg?: number };
      return { id, type, props: rest, assignedTo };
    });
    // no 60 cm slings, locking carabiners only (CR-49, CR-51)
    const scenario = normaliseGear(withWeights({ ...x, team: x.team.map(({ id, name, appearance }) => ({ id, name, appearance })), items }));
    return { ok: true, scenario, errors: [] };
  }
  const errors = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim());
  return { ok: false, errors };
}
