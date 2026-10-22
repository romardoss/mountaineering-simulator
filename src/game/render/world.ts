// World mapping: engine metres → scene pixels.
// PX_PER_M = 12: a 30 px tall character is ≈ 2.5 m (pixel-art exaggeration), a
// 2 m adjacency radius is 24 px. y grows up in the engine and down on screen.
import { buildHillGeometry, segmentAt, toWorld, type HillGeometry } from "../../engine/geometry/hill";
import type { HillConfig, Season, Surface, Weather } from "../../engine/model/types";
import { mapSurface } from "../../engine/model/selectors";
import { data } from "../../app/store";

export const PX_PER_M = 12;
export const MARGIN_X = 160;
export const MARGIN_TOP = 170;
export const MARGIN_BOTTOM = 90;
/** Harness height above the feet, in px (sprite cell 32×32, pivot at the feet). */
export const HARNESS_DY = 12;
export const HANDS_DY = 14;

export interface WorldMap {
  geo: HillGeometry;
  width: number;
  height: number;
  /** Screen x/y of a path position s (on the terrain surface). */
  at(s: number): { x: number; y: number };
  /** Screen position of world metres. */
  px(xm: number, ym: number): { x: number; y: number };
  /** Path position s under a screen x (x grows with s), clamped to the route. */
  sAtX(x: number): number;
}

export function buildWorld(hill: HillConfig): WorldMap {
  const geo = buildHillGeometry(hill);
  const width = Math.ceil(MARGIN_X * 2 + geo.maxX * PX_PER_M);
  const height = Math.ceil(MARGIN_TOP + MARGIN_BOTTOM + (geo.maxY - geo.minY) * PX_PER_M);
  const px = (xm: number, ym: number) => ({ x: MARGIN_X + xm * PX_PER_M, y: MARGIN_TOP + (geo.maxY - ym) * PX_PER_M });
  return {
    geo,
    width,
    height,
    px,
    at(s: number) {
      const w = toWorld(geo, s);
      return px(w.x, w.y);
    },
    sAtX(x: number) {
      let lo = 0;
      let hi = geo.totalLength;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (px(toWorld(geo, mid).x, 0).x < x) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    },
  };
}

/** Surface of a geometry segment after season and weather (S§6.5); flat zones default to grass. */
export function displaySurface(geo: HillGeometry, index: number, season: Season, weather: Weather): Surface {
  return mapSurface(data, season, weather, geo.segments[index].surface ?? "grass");
}

export function angleAtS(geo: HillGeometry, s: number): number {
  return segmentAt(geo, s).angleDeg;
}

export function snap(v: number): number {
  return Math.round(v);
}
