// Static world: terrain polygons with surface textures, edge strips, trees,
// natural anchors and zone flags (§18.2.3–5). Rebuilt only when the hill, season or weather changes.
import Phaser from "phaser";
import type { HillConfig, Season, Surface, Weather } from "../../engine/model/types";
import { displaySurface, PX_PER_M, type WorldMap } from "./world";
import { basePointsOf } from "../../engine/geometry/hill";

const FILL: Record<Surface, { key: string; tint?: number; plain?: number }> = {
  grass: { key: "terrain_grass_fill" },
  ground: { key: "terrain_ground_fill" },
  rock: { key: "terrain_rock_fill" },
  scree: { key: "terrain_scree_fill" },
  snow: { key: "", plain: 0xe8eff7 },
  icy_rock: { key: "terrain_rock_fill", tint: 0xc9dcf0 },
  snow_scree: { key: "terrain_scree_fill", tint: 0xdbe6f2 },
  mud: { key: "terrain_ground_fill", tint: 0x8a6448 },
  wet_rock: { key: "terrain_rock_fill", tint: 0x9fb0c8 },
};

const EDGE: Partial<Record<Surface, { key: string; tint?: number }>> = {
  grass: { key: "terrain_grass_edge" },
  ground: { key: "terrain_ground_edge" },
  rock: { key: "terrain_rock_edge" },
  scree: { key: "terrain_scree_edge" },
  mud: { key: "terrain_ground_edge", tint: 0x8a6448 },
  wet_rock: { key: "terrain_rock_edge", tint: 0xa8b8d0 },
};

/** Season look (CR-11): grass and tree tints; spring flowers along grass edges. */
const SEASON_LOOK: Record<Season, { grass?: number; deciduous?: number; conifer?: number; flowers?: boolean }> = {
  spring: { deciduous: 0xd8ffc0, conifer: 0xe8ffd8, flowers: true },
  summer: {},
  autumn: { grass: 0xe8a848, deciduous: 0xf08a3a, conifer: 0xe8e0b0 },
  winter: {},
};
const FLOWERS = [0xffffff, 0xff9ec8, 0xffd23f];

const FALLBACK_FILL: Record<Surface, number> = {
  grass: 0x4fa34a,
  ground: 0x8c6440,
  rock: 0x6e6e7a,
  scree: 0x9a9aa6,
  snow: 0xe8eff7,
  icy_rock: 0xb8c8dc,
  snow_scree: 0xd6dfea,
  mud: 0x6b4a30,
  wet_rock: 0x5a5f70,
};

export interface TerrainView {
  objects: Phaser.GameObjects.GameObject[];
  destroy(): void;
}

export function buildTerrain(scene: Phaser.Scene, hill: HillConfig, world: WorldMap, season: Season, weather: Weather, labels: { start: string; finish: string; summit: string }): TerrainView {
  const look = SEASON_LOOK[season];
  const objects: Phaser.GameObjects.GameObject[] = [];
  const masks: Phaser.GameObjects.Graphics[] = [];
  const geo = world.geo;
  const bottom = world.height + 4;
  // surface polyline incl. flat extensions to the world edges
  const segs = geo.segments.map((g, i) => {
    const a = world.at(g.s0);
    const b = world.at(g.s1 - 1e-6);
    return { a, b, surface: displaySurface(geo, i, season, weather), angle: g.angleDeg, sign: g.sign, i };
  });
  const first = segs[0];
  const last = segs[segs.length - 1];
  segs.unshift({ ...first, a: { x: -4, y: first.a.y }, b: first.a, i: -1 });
  segs.push({ ...last, a: last.b, b: { x: world.width + 4, y: last.b.y }, i: -2 });
  let pathPx = 0;
  for (const s of segs) {
    const x0 = Math.floor(Math.min(s.a.x, s.b.x));
    const x1 = Math.ceil(Math.max(s.a.x, s.b.x));
    const top = Math.floor(Math.min(s.a.y, s.b.y));
    const w = Math.max(1, x1 - x0 + 1);
    const h = Math.max(1, bottom - top);
    const poly = [s.a.x, s.a.y, s.b.x + 0.5, s.b.y, s.b.x + 0.5, bottom, s.a.x, bottom];
    const fill = FILL[s.surface];
    if (fill.key && scene.textures.exists(fill.key)) {
      const ts = scene.add.tileSprite(x0, top, w, h, fill.key).setOrigin(0).setDepth(10);
      ts.tilePositionX = x0;
      ts.tilePositionY = top;
      const tint = fill.tint ?? (s.surface === "grass" ? look.grass : undefined);
      if (tint) ts.setTint(tint);
      const mg = scene.make.graphics({}, false);
      mg.fillStyle(0xffffff).fillPoints(toPoints(poly), true);
      ts.setMask(mg.createGeometryMask());
      masks.push(mg);
      objects.push(ts);
    } else {
      const g = scene.add.graphics().setDepth(10);
      g.fillStyle(fill.plain ?? FALLBACK_FILL[s.surface]).fillPoints(toPoints(poly), true);
      if (s.surface === "snow") {
        // a little blue-grey dither so snow is not a flat white slab
        g.fillStyle(0xc9d8ea);
        for (let x = x0; x < x1; x += 4) for (let y = Math.ceil(Math.max(s.a.y, s.b.y)) + 6; y < bottom; y += 9) g.fillRect(x + ((y / 9) % 2) * 2, y, 1, 1);
      }
      objects.push(g);
    }
    // edge strip along the surface line
    const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    const edge = EDGE[s.surface];
    const rot = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
    if (edge && scene.textures.exists(edge.key)) {
      const e = scene.add.tileSprite(s.a.x, s.a.y, Math.ceil(len) + 2, 32, edge.key).setOrigin(0, 0.62).setRotation(rot).setDepth(12);
      e.tilePositionX = Math.round(pathPx);
      const tint = edge.tint ?? (s.surface === "grass" ? look.grass : undefined);
      if (tint) e.setTint(tint);
      objects.push(e);
      // mud puddles / spring flowers: a few deterministic pixels along the surface line
      if (s.surface === "mud" || (s.surface === "grass" && look.flowers)) {
        const d = scene.add.graphics().setDepth(13);
        for (let k = 5; k < len - 2; k += 9) {
          const p = { x: s.a.x + ((s.b.x - s.a.x) * k) / len, y: s.a.y + ((s.b.y - s.a.y) * k) / len };
          const n = Math.round(pathPx + k);
          if (s.surface === "mud") d.fillStyle(0x4a3020).fillRect(Math.round(p.x) - 1, Math.round(p.y) + 1, 3, 1);
          else if (n % 3 !== 0) d.fillStyle(FLOWERS[n % FLOWERS.length]).fillRect(Math.round(p.x), Math.round(p.y) - 2, 1, 1);
        }
        objects.push(d);
      }
    } else {
      // winter surfaces: snow band on top (+ icy highlights)
      const g = scene.add.graphics().setDepth(12);
      g.lineStyle(4, 0xffffff).lineBetween(s.a.x, s.a.y - 1, s.b.x, s.b.y - 1);
      g.lineStyle(1, 0xb7cbe0).lineBetween(s.a.x, s.a.y + 2, s.b.x, s.b.y + 2);
      objects.push(g);
    }
    pathPx += len;
  }
  // natural anchors
  const anchorAt = new Set<string>();
  for (const bp of basePointsOf(hill)) {
    const p = world.at(bp.s);
    if (bp.anchorType === "rock_outcrop") objects.push(scene.add.image(Math.round(p.x), Math.round(p.y + 4), "prop_rock_outcrop").setOrigin(0.5, 1).setDepth(14).setTint(season === "winter" ? 0xdde8f2 : 0xffffff));
    if (bp.anchorType === "bolt") objects.push(scene.add.image(Math.round(p.x + 6), Math.round(p.y - 8), "prop_bolt").setDepth(14));
    anchorAt.add(bp.id);
  }
  // trees
  for (const t of hill.trees) {
    const p = world.at(t.s);
    let key = `tree_${t.kind ?? "conifer"}_${t.size}`;
    if (season === "winter" && scene.textures.exists(`${key}_winter`)) key = `${key}_winter`;
    const img = scene.add.image(Math.round(p.x), Math.round(p.y + 2), scene.textures.exists(key) ? key : `tree_conifer_${t.size}`).setOrigin(0.5, 1).setDepth(15);
    if (season === "winter" && !key.endsWith("_winter")) img.setTint(0xd8e6ee);
    const treeTint = (t.kind ?? "conifer") === "deciduous" ? look.deciduous : look.conifer;
    if (treeTint) img.setTint(treeTint);
    objects.push(img);
  }
  // base points (available anchor spots): small marker
  for (const bp of basePointsOf(hill)) {
    const p = world.at(bp.s);
    objects.push(scene.add.image(Math.round(p.x), Math.round(p.y - 2), "prop_base_point").setDepth(16).setAlpha(0.8));
  }
  // zone flags + labels
  const flag = (s: number, key: string, text: string) => {
    const p = world.at(s);
    objects.push(scene.add.image(Math.round(p.x), Math.round(p.y + 1), key).setOrigin(0, 1).setDepth(16));
    objects.push(
      scene.add
        .text(Math.round(p.x) + 3, Math.round(p.y) - 34, text, { fontFamily: "Tiny5", fontSize: "10px", color: "#ffffff", stroke: "#1a1c2c", strokeThickness: 2, resolution: 1 })
        .setDepth(16)
        .setOrigin(0, 0),
    );
  };
  flag(Math.max(0.5, geo.startZoneEnd - 5.5), "start_flag", labels.start);
  flag(geo.finishStart + 1, "finish_flag", labels.finish);
  if (geo.summit) flag(geo.summit.s0 + 0.5, "finish_flag", labels.summit);
  void PX_PER_M;
  return {
    objects,
    destroy() {
      for (const o of objects) o.destroy();
      for (const m of masks) m.destroy();
    },
  };
}

function toPoints(flat: number[]): Phaser.Math.Vector2[] {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(new Phaser.Math.Vector2(flat[i], flat[i + 1]));
  return out;
}
