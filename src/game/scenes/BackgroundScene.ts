// Parallax background (§18.2.1–2). No background art exists yet, so sky and
// mountain layers are drawn programmatically (palette from docs/ASSET_PROMPTS.md).
// Runs in its own scene so the hill camera zoom does not scale the sky.
import Phaser from "phaser";
import type { Season, Weather } from "../../engine/model/types";

export let VIEW_W = 480;
export let VIEW_H = 270;

/** The view fills its container at an integer zoom; the internal size adapts (min 400×200 logical px). */
export function setViewSize(w: number, h: number) {
  VIEW_W = w;
  VIEW_H = h;
}
const LAYER_W = 960;
/** Layers are this much taller than the view, so the vertical parallax never shows a gap (CR-32). */
const PARALLAX_PAD = 64;

interface Palette {
  sky: number[];
  far: [number, number, number];
  mid: [number, number, number];
  near: [number, number, number];
}

const PALETTES: Record<Season, Palette> = {
  spring: {
    sky: [0x6aa8e8, 0x8ec4f2, 0xbfe2fb, 0xeef8ff],
    far: [0x7f92c4, 0xa3b2d8, 0xffffff],
    mid: [0x5f8aa0, 0x7fa8b8, 0x8fd06a],
    near: [0x3f7a3a, 0x5aa04a, 0x9fe07a],
  },
  summer: {
    sky: [0x3b7dd8, 0x5fa8f0, 0x9fd3fa, 0xe3f4ff],
    far: [0x6c7fb8, 0x8e9fcc, 0xffffff],
    mid: [0x4e6e8e, 0x6f8fa8, 0x3f8a4f],
    near: [0x1f4d3a, 0x2e6b45, 0x3f8a4f],
  },
  autumn: {
    sky: [0x6f8fb8, 0x9fb4cc, 0xd8d0b8, 0xf4e6c8],
    far: [0x7a7f9e, 0x9a9cb4, 0xf2efe6],
    mid: [0x6e6a6a, 0x8f8070, 0xc8862a],
    near: [0x6a4a22, 0x9a5a1e, 0xd9a03a],
  },
  winter: {
    sky: [0x8fa9c8, 0xb7cbe0, 0xd8e4f0, 0xf2f6fa],
    far: [0x9aa8c8, 0xc3cde3, 0xffffff],
    mid: [0x7f93ad, 0xa9b8cc, 0xe8eef6],
    near: [0x3d5a55, 0x5f7f78, 0xf2f6fa],
  },
};

/** Rain (CR-11): grey sky; mountain layers are darkened. */
const RAIN_SKY = [0x5d6878, 0x737f8f, 0x8c97a6, 0xa9b2be];

function darken(c: number, k = 0.72): number {
  return (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
}

export interface ScrollSource {
  scrollX: number;
  scrollY: number;
  worldHeight: number;
}

/** Deterministic pseudo-random for silhouettes. */
function rnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Ridge heights along x, seamless left-right (sum of sines with integer periods). */
function ridge(seed: number, base: number, amp: number, peaks: number): (x: number) => number {
  const r = rnd(seed);
  const waves = Array.from({ length: 4 }, (_, i) => ({ k: peaks * (i + 1), a: amp / (i + 1.4), p: r() * Math.PI * 2 }));
  return (x: number) => base - waves.reduce((sum, w) => sum + w.a * Math.abs(Math.sin((x / LAYER_W) * Math.PI * w.k + w.p)), 0);
}

export class BackgroundScene extends Phaser.Scene {
  private season: Season = "summer";
  private weather: Weather = "dry";
  private layers: { sprite: Phaser.GameObjects.TileSprite; factor: number; baseY: number }[] = [];
  private flakes: { o: Phaser.GameObjects.Rectangle; vx: number; vy: number }[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  source: ScrollSource = { scrollX: 0, scrollY: 0, worldHeight: VIEW_H };

  constructor() {
    super({ key: "background", active: true });
  }

  create() {
    this.build(this.season, this.weather);
  }

  setSeason(season: Season, weather: Weather = "dry") {
    if (season === this.season && weather === this.weather && this.layers.length) return;
    this.season = season;
    this.weather = weather;
    if (this.sys.isActive()) this.build(season, weather);
  }

  private build(season: Season, weather: Weather) {
    this.children.removeAll(true);
    this.layers = [];
    this.flakes = [];
    this.clouds = [];
    const rain = weather === "rain";
    const base = PALETTES[season];
    const dk = (t: [number, number, number]): [number, number, number] => (rain ? [darken(t[0]), darken(t[1]), darken(t[2])] : t);
    const pal: Palette = { sky: rain ? RAIN_SKY : base.sky, far: dk(base.far), mid: dk(base.mid), near: dk(base.near) };
    const tag = `${season}${rain ? "_rain" : ""}`;
    // sky: ordered-dither bands (no smooth gradients, §18.1)
    const sky = this.add.graphics();
    const bands = pal.sky.length - 1;
    const bandH = VIEW_H / bands;
    for (let b = 0; b < bands; b++) {
      const y0 = Math.round(b * bandH);
      const y1 = Math.round((b + 1) * bandH);
      sky.fillStyle(pal.sky[b], 1).fillRect(0, y0, VIEW_W, y1 - y0);
      // dither the lower quarter of each band into the next colour
      sky.fillStyle(pal.sky[b + 1], 1);
      for (let y = y1 - 8; y < y1; y++) {
        const step = y - (y1 - 8);
        for (let x = (y % 2) * 1; x < VIEW_W; x += step < 4 ? 4 : 2) sky.fillRect(x, y, 1, 1);
      }
    }
    sky.setScrollFactor(0);
    if (season !== "winter") {
      if (!rain && season !== "autumn") {
        this.ensureSun();
        this.add.image(400, 44, "bg_sun").setScrollFactor(0);
      }
      this.ensureCloud();
      const n = rain ? 6 : season === "autumn" ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const c = this.add.image(60 + i * (520 / n), 26 + (i % 2) * 20, "bg_cloud").setScrollFactor(0);
        if (rain) c.setTint(0x8a96a8);
        else if (season === "autumn") c.setTint(0xf2e8d8);
        this.clouds.push(c);
      }
    }
    // keyed by view height too: after a resize the old, shorter textures must not be reused (CR-32)
    this.layers.push(this.layer(`bg_far_${tag}_${VIEW_H}`, pal.far, 11, 160, 48, 3, true, 0.1));
    this.layers.push(this.layer(`bg_mid_${tag}_${VIEW_H}`, pal.mid, 23, 195, 30, 5, false, 0.3));
    this.layers.push(this.layer(`bg_near_${tag}_${VIEW_H}`, pal.near, 37, 228, 18, 9, false, 0.6));
    this.applyScroll();
    if (rain) {
      const r = rnd(9);
      for (let i = 0; i < 110; i++) {
        const o = this.add.rectangle(Math.floor(r() * VIEW_W), Math.floor(r() * VIEW_H), 1, 3, 0xb7cbe0).setOrigin(0).setAlpha(0.8);
        this.flakes.push({ o, vx: -0.4, vy: 2.6 + r() * 1.2 });
      }
    }
    if (season === "winter") {
      const r = rnd(5);
      for (let i = 0; i < 70; i++) {
        const o = this.add.rectangle(Math.floor(r() * VIEW_W), Math.floor(r() * VIEW_H), 1, 1, 0xffffff).setOrigin(0);
        this.flakes.push({ o, vx: -0.08 - r() * 0.12, vy: 0.18 + r() * 0.25 });
      }
    }
  }

  private ensureSun() {
    if (this.textures.exists("bg_sun")) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffd23f).fillRect(10, 2, 4, 20).fillRect(2, 10, 20, 4).fillRect(5, 5, 14, 14);
    g.fillStyle(0xfff04f).fillRect(7, 7, 10, 10);
    g.fillStyle(0xffffff).fillRect(9, 9, 4, 4);
    g.generateTexture("bg_sun", 24, 24);
    g.destroy();
  }

  private ensureCloud() {
    if (this.textures.exists("bg_cloud")) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(0x9fd3fa).fillRect(4, 14, 56, 6);
    g.fillStyle(0xffffff).fillRect(6, 10, 50, 8).fillRect(14, 4, 18, 8).fillRect(30, 2, 16, 10).fillRect(44, 7, 10, 6);
    g.fillStyle(0xe3f4ff).fillRect(8, 16, 48, 3);
    g.generateTexture("bg_cloud", 64, 24);
    g.destroy();
  }

  private layer(key: string, cols: [number, number, number], seed: number, base: number, amp: number, peaks: number, snowTops: boolean, factor: number) {
    if (!this.textures.exists(key)) {
      const h = VIEW_H + PARALLAX_PAD;
      const top = ridge(seed, base + PARALLAX_PAD / 2, amp, peaks); // centred: the sprite rests at y = −PAD/2
      const g = this.make.graphics({}, false);
      for (let x = 0; x < LAYER_W; x++) {
        const ty = Math.round(top(x));
        g.fillStyle(cols[0]).fillRect(x, ty, 1, h - ty);
        // lit side: lighter colour on rising slopes
        if (top(x + 1) < top(x - 1)) g.fillStyle(cols[1]).fillRect(x, ty, 1, Math.max(2, Math.round((h - ty) * 0.1)));
        if (snowTops && ty < base - amp * 1.05) g.fillStyle(cols[2]).fillRect(x, ty, 1, 5);
        if (!snowTops && x % 7 === 0) g.fillStyle(cols[2]).fillRect(x, ty + 2, 1, 2);
      }
      g.generateTexture(key, LAYER_W, h);
      g.destroy();
    }
    const sprite = this.add.tileSprite(0, 0, VIEW_W, VIEW_H + PARALLAX_PAD, key).setOrigin(0).setScrollFactor(0);
    return { sprite, factor, baseY: 0 };
  }

  /** Called by the hill scene every frame with its camera, so the parallax is never a frame behind (CR-32). */
  follow(cam: Phaser.Cameras.Scene2D.Camera, worldHeight: number) {
    // the camera's view centre, independent of zoom
    const viewH = cam.height / cam.zoom;
    this.source = { scrollX: cam.midPoint.x - cam.width / cam.zoom / 2, scrollY: cam.midPoint.y - viewH / 2, worldHeight: Math.max(worldHeight, viewH) };
    this.applyScroll(viewH);
  }

  private applyScroll(viewH = VIEW_H) {
    const { scrollX, scrollY, worldHeight } = this.source;
    const rangeY = Math.max(1, worldHeight - viewH);
    const vy = Phaser.Math.Clamp(scrollY / rangeY, 0, 1); // 0 = top of world, 1 = bottom
    for (const l of this.layers) {
      l.sprite.tilePositionX = Math.round(scrollX * l.factor);
      // shift within [-PAD, 0] so the padded bottom always covers the view
      l.sprite.y = Math.round(Phaser.Math.Clamp((0.5 - vy) * 60 * l.factor - PARALLAX_PAD / 2, -PARALLAX_PAD, 0));
    }
  }

  override update() {
    for (const c of this.clouds) {
      c.x -= 0.03;
      if (c.x < -40) c.x = VIEW_W + 40;
    }
    for (const f of this.flakes) {
      f.o.x += f.vx;
      f.o.y += f.vy;
      if (f.o.y > VIEW_H) f.o.y = 0;
      if (f.o.x < 0) f.o.x = VIEW_W - 1;
      f.o.setPosition(f.o.x, f.o.y);
    }
  }
}
