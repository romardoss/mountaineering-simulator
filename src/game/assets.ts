// Asset registry: assets/manifest.json + bundled URLs (Vite). Missing art falls back
// to programmatic placeholders in the renderers (§18.5.2).
import manifestJson from "../../assets/manifest.json";

export interface AssetEntry {
  file: string;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
  rows?: number;
}

const urls = import.meta.glob("../../assets/{art,characters,terrain,trees,props,decor,backgrounds,icons,ui}/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const manifest: Record<string, AssetEntry> = Object.fromEntries(
  Object.entries(manifestJson as Record<string, unknown>).filter(([k]) => !k.startsWith("_")),
) as Record<string, AssetEntry>;

export function assetUrl(id: string): string | null {
  const e = manifest[id];
  if (!e) return null;
  return urls[`../../assets/${e.file}`] ?? null;
}

export function hasAsset(id: string): boolean {
  return assetUrl(id) !== null;
}

/** Team sheet animations available in the art set, with the idle fallback chain. */
export const TEAM_SHEETS = ["team_shout", "team_tie_knot", "team_belay", "team_celebrate", "team_fall", "team_slide", "team_hang", "team_injured"] as const;

/** Jacket colours per sprite row (docs/ASSET_PROMPTS.md §2), for UI accents and placeholders. */
export const ROW_COLORS = [
  { jacket: "#D93636", helmet: "#E6EAF0", name: "red" },
  { jacket: "#2563D9", helmet: "#E07A2A", name: "blue" },
  { jacket: "#E6B800", helmet: "#D93636", name: "yellow" },
  { jacket: "#33A14A", helmet: "#E6B800", name: "green" },
  { jacket: "#E07A2A", helmet: "#2563D9", name: "orange" },
  { jacket: "#7A3AD9", helmet: "#33A14A", name: "purple" },
  { jacket: "#1FA8A8", helmet: "#7A3AD9", name: "turquoise" },
];
