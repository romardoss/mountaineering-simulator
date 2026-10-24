// Team gear helpers for the configuration screens: distinct rope colours and the
// current gear options (no 60 cm sling, CR-49; locking carabiners only, CR-51).
import type { ItemConfig, Scenario } from "../engine/model/types";

/** Well distinguishable rope colours on the hill view. */
export const ROPE_COLORS = ["#D93636", "#2563D9", "#E6B800", "#33A14A", "#E07A2A", "#7A3AD9", "#1FA8A8", "#E04A9A", "#8B5A2B", "#F2F2F2"];

const norm = (c: string | undefined) => (c ?? "").toUpperCase();

/** A random colour no rope in `used` has; a random new colour when the palette is used up. */
export function freshRopeColor(used: Iterable<string | undefined>, rand: () => number = Math.random): string {
  const taken = new Set([...used].map(norm));
  const free = ROPE_COLORS.filter((c) => !taken.has(c));
  if (free.length) return free[Math.floor(rand() * free.length)];
  for (;;) {
    const c = `#${Math.floor(rand() * 0x1000000).toString(16).padStart(6, "0")}`.toUpperCase();
    if (!taken.has(c)) return c;
  }
}

/**
 * Every rope gets its own colour (CR-59): the first rope with each colour keeps it; ropes repeating
 * a colour get a fresh one that no rope has — also none of the ropes later in the list.
 */
export function withDistinctRopeColors(items: ItemConfig[], rand: () => number = Math.random): ItemConfig[] {
  const keep = new Set<string>();
  const kept = items.map((it) => {
    if (it.type !== "rope" || !it.props.color || keep.has(norm(it.props.color))) return false;
    keep.add(norm(it.props.color));
    return true;
  });
  const used = [...keep];
  return items.map((it, i) => {
    if (it.type !== "rope" || kept[i]) return it;
    const color = freshRopeColor(used, rand);
    used.push(color);
    return { ...it, props: { ...it.props, color } };
  });
}

/** Old configurations: 60 cm slings become 120 cm, every carabiner is locking. */
export function normaliseGear(sc: Scenario): Scenario {
  const items = sc.items.map((it): ItemConfig => {
    if (it.type === "sling" && it.props.lengthCm === 60) return { ...it, props: { ...it.props, lengthCm: 120 } };
    if (it.type === "carabiner" && !it.props.locking) return { ...it, props: { ...it.props, locking: true } };
    return it;
  });
  return { ...sc, items };
}
