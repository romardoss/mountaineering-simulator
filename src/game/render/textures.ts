// Programmatic textures for everything the art set does not have yet (§18.5.2).
// Sizes follow the asset contract in docs/ASSET_PROMPTS.md.
import Phaser from "phaser";
import { ROW_COLORS } from "../assets";

const OUT = 0x1a1c2c;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

const hex = (c: string) => parseInt(c.replace("#", ""), 16);

export function ensurePlaceholderTextures(scene: Phaser.Scene) {
  // deciduous trees (no art yet): round crown + trunk
  const deciduous = (key: string, w: number, h: number, crownR: number) =>
    make(scene, key, w, h, (g) => {
      const cx = Math.floor(w / 2);
      g.fillStyle(0x5a3a22).fillRect(cx - 2, h - Math.floor(h * 0.45), 4, Math.floor(h * 0.45));
      g.fillStyle(0x7e5530).fillRect(cx - 1, h - Math.floor(h * 0.45), 1, Math.floor(h * 0.45));
      const cy = crownR + 1;
      g.fillStyle(OUT).fillCircle(cx, cy, crownR + 1);
      g.fillStyle(0x2e6b45).fillCircle(cx, cy, crownR);
      g.fillStyle(0x3f8a4f).fillCircle(cx - 2, cy - 2, crownR - 3);
      g.fillStyle(0x77c25a).fillCircle(cx - 4, cy - 4, Math.max(2, crownR - 9));
    });
  // winter: bare branches with a little snow
  const bare = (key: string, w: number, h: number) =>
    make(scene, key, w, h, (g) => {
      const cx = Math.floor(w / 2);
      g.fillStyle(0x5a3a22).fillRect(cx - 2, Math.floor(h * 0.3), 4, h - Math.floor(h * 0.3));
      g.lineStyle(2, 0x5a3a22);
      for (let i = 0; i < 4; i++) {
        const y = Math.floor(h * (0.3 + i * 0.12));
        const len = Math.floor(w * (0.42 - i * 0.06));
        g.lineBetween(cx, y + 6, cx - len, y);
        g.lineBetween(cx, y + 8, cx + len, y + 2);
        g.fillStyle(0xffffff).fillRect(cx - len, y - 1, 3, 1).fillRect(cx + len - 3, y + 1, 3, 1);
      }
      g.lineBetween(cx, Math.floor(h * 0.3), cx, 2);
    });
  bare("tree_deciduous_small_winter", 24, 40);
  bare("tree_deciduous_large_winter", 48, 72);
  deciduous("tree_deciduous_small", 24, 40, 10);
  deciduous("tree_deciduous_large", 48, 72, 22);
  // conifer fallbacks (only used if the art failed to load)
  const conifer = (key: string, w: number, h: number) =>
    make(scene, key, w, h, (g) => {
      const cx = w / 2;
      g.fillStyle(0x5a3a22).fillRect(cx - 2, h - 8, 4, 8);
      g.fillStyle(OUT).fillTriangle(cx, 0, 0, h - 6, w, h - 6);
      g.fillStyle(0x2e6b45).fillTriangle(cx, 2, 2, h - 7, w - 2, h - 7);
      g.fillStyle(0x3f8a4f).fillTriangle(cx, 4, 4, h - 14, cx, h - 14);
    });
  conifer("tree_conifer_small", 24, 40);
  conifer("tree_conifer_large", 40, 72);
  make(scene, "prop_rock_outcrop", 32, 24, (g) => {
    g.fillStyle(OUT).fillRoundedRect(2, 4, 28, 20, 6);
    g.fillStyle(0x6e6e7a).fillRoundedRect(3, 5, 26, 18, 5);
    g.fillStyle(0x9a9aa6).fillRoundedRect(5, 6, 14, 8, 3);
    g.fillStyle(0xc8c8d0).fillRect(7, 7, 6, 2);
    g.fillStyle(0x4a4a55).fillRect(18, 15, 9, 6);
    g.fillStyle(0x4fa34a).fillRect(2, 21, 5, 3).fillRect(24, 21, 6, 3);
  });
  make(scene, "prop_bolt", 8, 8, (g) => {
    g.fillStyle(0x4a4a55).fillRect(0, 2, 3, 4);
    g.fillStyle(OUT).fillCircle(4, 4, 3);
    g.fillStyle(0xc8c8d0).fillCircle(4, 4, 2);
    g.fillStyle(0x6e6e7a).fillRect(3, 3, 2, 2);
  });
  make(scene, "prop_base_marker", 16, 16, (g) => {
    g.lineStyle(2, 0x5fa8f0).strokeEllipse(8, 11, 12, 7);
    g.fillStyle(OUT).fillRect(7, 9, 4, 6);
    g.fillStyle(0xc8c8d0).fillRect(8, 10, 2, 4);
    g.fillStyle(0xffd23f).fillRect(8, 12, 2, 1);
    g.fillStyle(0x5a3a22).fillRect(3, 1, 1, 10);
    g.fillStyle(0xf2a65a).fillTriangle(4, 1, 4, 6, 9, 3);
  });
  make(scene, "prop_base_point", 8, 8, (g) => {
    g.fillStyle(0xffffff, 0.9).fillRect(3, 0, 2, 2).fillRect(3, 6, 2, 2).fillRect(0, 3, 2, 2).fillRect(6, 3, 2, 2);
  });
  make(scene, "prop_stone", 6, 6, (g) => {
    g.fillStyle(OUT).fillCircle(3, 3, 3);
    g.fillStyle(0x6e6e7a).fillCircle(3, 3, 2);
    g.fillStyle(0x9a9aa6).fillRect(2, 2, 1, 1);
  });
  make(scene, "plan_icon", 6, 6, (g) => {
    g.fillStyle(OUT).fillRect(0, 0, 6, 6);
    g.fillStyle(0xffd23f).fillRect(1, 1, 4, 4);
  });
  make(scene, "item_ground", 6, 4, (g) => {
    g.fillStyle(OUT).fillRect(0, 0, 6, 4);
    g.fillStyle(0xf2a65a).fillRect(1, 1, 4, 2);
  });
  make(scene, "finish_flag", 12, 22, (g) => {
    g.fillStyle(0x5a3a22).fillRect(0, 0, 2, 22);
    g.fillStyle(OUT).fillRect(2, 0, 10, 8);
    g.fillStyle(0xffffff).fillRect(2, 1, 9, 6);
    g.fillStyle(0xd93636).fillRect(2, 1, 3, 3).fillRect(8, 1, 3, 3).fillRect(5, 4, 3, 3);
  });
  make(scene, "start_flag", 12, 22, (g) => {
    g.fillStyle(0x5a3a22).fillRect(0, 0, 2, 22);
    g.fillStyle(OUT).fillRect(2, 0, 10, 8);
    g.fillStyle(0x33a14a).fillRect(2, 1, 9, 6);
  });
}

/** Team-sheet fallback if a sheet failed to load: plain coloured figures, 32×32 cells, 7 rows. */
export function ensureTeamPlaceholder(scene: Phaser.Scene, key: string, frames: number) {
  if (scene.textures.exists(key)) return;
  make(scene, key, 32 * frames, 32 * 7, (g) => {
    for (let r = 0; r < 7; r++) {
      const c = ROW_COLORS[r];
      for (let f = 0; f < frames; f++) {
        const x = f * 32 + 10;
        const y = r * 32 + 2;
        g.fillStyle(OUT).fillRect(x - 1, y, 14, 30);
        g.fillStyle(hex(c.helmet)).fillRect(x + 1, y + 1, 10, 6);
        g.fillStyle(0xe8b48f).fillRect(x + 2, y + 7, 8, 5);
        g.fillStyle(hex(c.jacket)).fillRect(x, y + 12, 12, 9);
        g.fillStyle(0x33467a).fillRect(x + 1, y + 21, 10, 8);
      }
    }
  });
  const tex = scene.textures.get(key);
  for (let i = 0; i < frames * 7; i++) tex.add(i, 0, (i % frames) * 32, Math.floor(i / frames) * 32, 32, 32);
}
