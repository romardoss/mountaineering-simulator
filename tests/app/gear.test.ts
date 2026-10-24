// CR-59 rope colours and CR-49 / CR-51 legacy gear in configurations.
import { describe, expect, it } from "vitest";
import { freshRopeColor, normaliseGear, ROPE_COLORS, withDistinctRopeColors } from "../../src/app/gear";
import { makeItem, scenario } from "../engine/dsl";
import { data } from "../engine/dsl";

describe("rope colours (CR-59)", () => {
  it("a new rope never repeats another rope's colour", () => {
    const used = ROPE_COLORS.slice(0, 9);
    for (let i = 0; i < 20; i++) expect(freshRopeColor(used)).toBe(ROPE_COLORS[9]);
    const all = [...ROPE_COLORS];
    const c = freshRopeColor(all);
    expect(all).not.toContain(c);
  });
  it("kit ropes with the same colour are recoloured, others kept", () => {
    const ropes = [makeItem(data, "r1", "rope"), makeItem(data, "r2", "rope"), makeItem(data, "r3", "rope", { color: "#2563D9" })];
    const out = withDistinctRopeColors(ropes);
    expect(out[0].props.color).toBe(ropes[0].props.color);
    expect(out[2].props.color).toBe("#2563D9");
    expect(new Set(out.map((r) => r.props.color?.toUpperCase())).size).toBe(3);
  });
});

describe("legacy gear (CR-49, CR-51)", () => {
  it("60 cm slings become 120 cm and every carabiner is locking", () => {
    const sc = scenario({ items: () => [makeItem(data, "s", "sling", { lengthCm: 60 }), makeItem(data, "c", "carabiner", { locking: false }), makeItem(data, "s2", "sling", { lengthCm: 240 })] });
    const out = normaliseGear(sc).items;
    expect(out.map((i) => i.props.lengthCm ?? i.props.locking)).toEqual([120, true, 240]);
  });
});
