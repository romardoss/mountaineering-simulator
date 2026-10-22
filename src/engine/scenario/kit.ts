// Building items from the catalog and the «Типовий набір» kit (§9.3.5).
import type { EquipmentWeights, GameData, IndividualEntry } from "../data/types";
import type { ItemConfig, ItemProps, ItemType, MemberConfig, Season } from "../model/types";

export interface KitEntry {
  type: ItemType;
  as?: "worn" | "carried";
  count?: number;
  props?: ItemProps;
  assign?: "first" | "last" | "spread_heavy";
}

export interface KitDef {
  id: string;
  nameKey: string;
  perMember: KitEntry[];
  winterPerMember: KitEntry[];
  team: KitEntry[];
}

/** The same personal equipment for every member, never configured (CR-14); createGame adds it. */
export function individualKit(data: GameData, season: Season): IndividualEntry[] {
  return season === "winter" ? [...data.individual.always, ...data.individual.winter] : data.individual.always;
}

/** Types that only exist as individual equipment: never in the pool; configured ones are ignored. */
export function isIndividual(data: GameData, type: ItemType): boolean {
  return [...data.individual.always, ...data.individual.winter].some((e) => e.type === type);
}

/** Weight of one member's individual equipment. */
export function individualKg(data: GameData, weights: EquipmentWeights, season: Season): number {
  return individualKit(data, season).reduce((s, e) => s + (e.count ?? 1) * defaultWeight(weights, e.type, makeItem(data, "", e.type, e.props).props), 0);
}

/** Standard weight of an item (§9.1, CR-7): the only source of item weights. */
export function defaultWeight(w: EquipmentWeights, type: ItemType, props: ItemProps): number {
  switch (type) {
    case "rope":
      return round2((props.lengthM ?? 0) * w.ropePerMeterKg * Math.pow((props.diameterMm ?? 10) / 10, 2));
    case "cord":
      return round2((props.lengthM ?? 0) * w.cordPerMeterKg);
    case "sling":
      return props.lengthCm === 60 ? w.slingKg["60"] : props.lengthCm === 240 ? w.slingKg["240"] : w.slingKg["120"];
    case "carabiner":
      return props.locking ? w.carabinerKg.locking : w.carabinerKg.nonLocking;
    case "belay_device":
      return props.model === "figure8" ? w.belayDeviceKg.figure8 : w.belayDeviceKg.atc;
    case "harness":
      return w.harnessKg;
    case "helmet":
      return w.helmetKg;
    case "lanyard":
      return w.lanyardKg;
    case "gloves":
      return w.glovesKg;
    case "crampons":
      return w.cramponsKg;
    case "ice_axe":
      return w.iceAxeKg;
    case "ascender":
      return w.ascenderKg;
    case "backpack":
      return w.backpackBaseKg;
  }
}

export function makeItem(data: GameData, id: string, type: ItemType, props: ItemProps = {}, assignedTo: ItemConfig["assignedTo"] = null): ItemConfig {
  const def = data.equipment.find((e) => e.type === type);
  return { id, type, props: { ...(def?.defaults ?? {}), ...props }, assignedTo };
}

export function buildKit(data: GameData, kit: KitDef, team: MemberConfig[], season: Season): ItemConfig[] {
  const items: ItemConfig[] = [];
  let n = 0;
  const nextId = (t: string) => `${t}_${++n}`;
  const per = season === "winter" ? [...kit.perMember, ...kit.winterPerMember] : kit.perMember;
  for (const m of team) {
    for (const e of per) {
      for (let i = 0; i < (e.count ?? 1); i++) items.push(makeItem(data, nextId(e.type), e.type, e.props, { memberId: m.id, as: e.as ?? "carried" }));
    }
  }
  // team order: first and last member (no roles, CR-3)
  const first = team[0];
  const last = team[team.length - 1];
  const others = team.filter((m) => m !== first && m !== last);
  let spread = 0;
  for (const e of kit.team) {
    for (let i = 0; i < (e.count ?? 1); i++) {
      let who = first;
      if (e.assign === "last") who = last;
      else if (e.assign === "spread_heavy") who = (others.length ? others : team)[spread++ % (others.length || team.length)];
      items.push(makeItem(data, nextId(e.type), e.type, e.props, { memberId: who.id, as: "carried" }));
    }
  }
  return items;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
