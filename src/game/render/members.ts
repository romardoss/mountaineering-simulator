// Team members (§18.3.1–2, §18.3.5): sprite rows from the team sheets, name +
// number label (colour is not the only distinction, §22.5), selection highlight,
// planned-action icon. There is no idle/walk sheet yet: idle = team_shout frame 0,
// walking = idle with a 1 px bob, climbing = idle leaning forward. Idle members in a
// safe zone stroll a little now and then (cosmetic only, CR-30).
import Phaser from "phaser";
import { manifest } from "../assets";
import { zoneAt } from "../../engine/geometry/hill";
import { attachmentsOf, belaysAsBelayer, belaysAsClimber, harnessNodes } from "../../engine/model/selectors";
import type { GameState, MemberState } from "../../engine/model/types";
import { angleAtS, snap, type WorldMap } from "./world";

export const SHEETS: Record<string, { frames: number; rate: number; loop: boolean }> = {
  team_shout: { frames: 4, rate: 6, loop: false },
  team_tie_knot: { frames: 6, rate: 6, loop: false },
  team_belay: { frames: 4, rate: 3, loop: true },
  team_celebrate: { frames: 6, rate: 8, loop: true },
  team_fall: { frames: 4, rate: 8, loop: false },
  team_slide: { frames: 3, rate: 8, loop: true },
  team_hang: { frames: 3, rate: 3, loop: true },
  team_injured: { frames: 2, rate: 2, loop: true },
};

export function framesOf(sheet: string): number {
  return manifest[sheet]?.frames ?? SHEETS[sheet]?.frames ?? 1;
}

export function animKey(sheet: string, row: number): string {
  return `${sheet}:${row}`;
}

export function createAnimations(scene: Phaser.Scene) {
  for (const [sheet, def] of Object.entries(SHEETS)) {
    if (!scene.textures.exists(sheet)) continue;
    const n = framesOf(sheet);
    for (let r = 0; r < 7; r++) {
      const key = animKey(sheet, r);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sheet, { start: r * n, end: r * n + n - 1 }), frameRate: def.rate, repeat: def.loop ? -1 : 0 });
    }
  }
}

interface View {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  plan: Phaser.GameObjects.Image;
  s: number;
  offsetM: number;
  /** Set by the animation timeline; while true `sync` leaves the pose alone. */
  posed: boolean;
  bob: boolean;
  lean: number;
  /** Cosmetic stroll (CR-30): current / target offset in metres, next start time (ms). */
  wander: { on: boolean; off: number; target: number; nextAt: number; min: number; max: number };
}

/** Idle stroll (CR-30): subtle and infrequent, one member at a time. */
const WANDER = { maxM: 1, minM: 0.3, pauseMs: [8000, 15000], speedMps: 0.35, clearM: 0.7 } as const;

function wanderDelay(): number {
  return WANDER.pauseMs[0] + Math.random() * (WANDER.pauseMs[1] - WANDER.pauseMs[0]);
}

export class MemberViews {
  private views = new Map<string, View>();
  private marker: Phaser.GameObjects.Graphics;
  selected: string | null = null;
  onSelect: (id: string) => void = () => {};
  /** Pointer over / out of a member sprite (hover command button, CR-35). */
  onHover: (id: string | null) => void = () => {};

  constructor(private scene: Phaser.Scene, private world: WorldMap) {
    this.marker = scene.add.graphics().setDepth(29);
  }

  setWorld(world: WorldMap) {
    this.world = world;
  }

  destroy() {
    for (const v of this.views.values()) {
      v.sprite.destroy();
      v.label.destroy();
      v.plan.destroy();
    }
    this.views.clear();
    this.marker.destroy();
  }

  ids(): string[] {
    return [...this.views.keys()];
  }

  /** Small horizontal spread so members at the same spot don't overlap. */
  static offsets(state: GameState): Map<string, number> {
    const out = new Map<string, number>();
    const order = state.scenario.team.map((t) => state.members[t.id]).filter(Boolean);
    const groups: MemberState[][] = [];
    for (const m of [...order].sort((a, b) => a.pos.s - b.pos.s)) {
      const g = groups.find((gr) => Math.abs(gr[gr.length - 1].pos.s - m.pos.s) < 0.9);
      if (g) g.push(m);
      else groups.push([m]);
    }
    for (const g of groups) {
      g.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      g.forEach((m, k) => out.set(m.id, g.length === 1 ? 0 : (k - (g.length - 1) / 2) * 1.25));
    }
    return out;
  }

  /** Brings sprites in line with `state` (positions, poses unless posed by an animation). */
  sync(state: GameState, plan: Record<string, unknown>, full: boolean) {
    const offsets = MemberViews.offsets(state);
    const ids = state.scenario.team.map((t) => t.id);
    for (const [id, v] of this.views) if (!ids.includes(id)) {
      v.sprite.destroy();
      v.label.destroy();
      v.plan.destroy();
      this.views.delete(id);
    }
    ids.forEach((id, idx) => {
      const m = state.members[id];
      if (!m) return;
      let v = this.views.get(id);
      if (!v) {
        const sprite = this.scene.add.sprite(0, 0, "team_shout", this.idleFrame(m.appearance.row)).setOrigin(0.5, 31 / 32).setDepth(30);
        sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
        sprite.on("pointerup", (p: Phaser.Input.Pointer) => {
          if (p.getDistance() < 4) this.onSelect(id);
        });
        sprite.on("pointerover", () => this.onHover(id));
        sprite.on("pointerout", () => this.onHover(null));
        const label = this.scene.add
          .text(0, 0, "", { fontFamily: "Tiny5", fontSize: "10px", color: "#ffffff", stroke: "#1a1c2c", strokeThickness: 2, resolution: 1 })
          .setOrigin(0.5, 1)
          .setDepth(40);
        const planIcon = this.scene.add.image(0, 0, "plan_icon").setDepth(41).setOrigin(0, 1);
        v = { sprite, label, plan: planIcon, s: m.pos.s, offsetM: 0, posed: false, bob: false, lean: 0, wander: { on: false, off: 0, target: 0, nextAt: 0, min: 0, max: 0 } };
        this.views.set(id, v);
      }
      this.rows.set(id, m.appearance.row % 7);
      v.label.setData("short", `${idx + 1}`);
      v.label.setData("full", `${idx + 1}. ${m.name}`);
      v.offsetM = offsets.get(id) ?? 0;
      if (full) {
        v.s = m.pos.s;
        v.posed = false;
      }
      v.plan.setVisible(plan[id] !== undefined && m.status !== "injured" && state.outcome === "in_progress");
      if (!v.posed) this.restPose(state, m, v);
      this.syncWander(state, m, v, plan[id] !== undefined, full);
    });
  }

  /** Only free members with no task, standing in a safe zone; anything else stops the stroll at once. */
  private syncWander(state: GameState, m: MemberState, v: View, planned: boolean, full: boolean) {
    const geo = this.world.geo;
    const zone = zoneAt(geo, m.pos.s);
    const tied = harnessNodes(state, m.id).length > 0 || attachmentsOf(state, m.id).length > 0 || belaysAsBelayer(state, m.id).length > 0 || belaysAsClimber(state, m.id).length > 0;
    const on = state.outcome === "in_progress" && m.status === "ok" && !planned && !tied && zone !== "slope";
    const w = v.wander;
    if (!on || full) {
      w.off = 0;
      w.target = 0;
    }
    if (on && !w.on) w.nextAt = 0; // schedule on the next frame
    w.on = on;
    // stay inside the same flat zone
    const here = m.pos.s + v.offsetM;
    let lo = here;
    let hi = here;
    while (lo - here > -WANDER.maxM && lo - 0.05 >= 0 && zoneAt(geo, lo - 0.05) === zone) lo -= 0.05;
    while (hi - here < WANDER.maxM && zoneAt(geo, hi + 0.05) === zone && hi + 0.05 <= geo.totalLength) hi += 0.05;
    w.min = lo - here;
    w.max = hi - here;
  }

  /** Per-frame stroll: pick a new short target now and then, walk slowly with a bob. */
  private stepWander(time: number, dt: number) {
    const anyMoving = [...this.views.values()].some((x) => x.wander.off !== x.wander.target);
    for (const v of this.views.values()) {
      const w = v.wander;
      if (!w.on || v.posed) continue;
      if (w.nextAt === 0) w.nextAt = time + wanderDelay();
      if (!anyMoving && time >= w.nextAt && w.off === w.target) {
        // back towards the spot, or a short step sideways / back
        const step = WANDER.minM + Math.random() * (WANDER.maxM - WANDER.minM);
        const side = Math.random() < 0.5 ? -1 : 1;
        const tries = w.off !== 0 && Math.random() < 0.6 ? [0] : [side * step, -side * step, 0];
        // never walk into a teammate: members stay readable (§22.5)
        const free = (off: number) => [...this.views.values()].every((o) => o === v || Math.abs(o.s + o.offsetM + o.wander.off - (v.s + v.offsetM + off)) >= WANDER.clearM);
        const want = tries.map((x) => Math.max(w.min, Math.min(w.max, x))).find(free);
        if (want !== undefined) w.target = want;
        w.nextAt = time + wanderDelay();
      }
      if (w.off !== w.target) {
        const d = w.target - w.off;
        const stepM = Math.min(Math.abs(d), (WANDER.speedMps * dt) / 1000);
        w.off += Math.sign(d) * stepM;
        if (Math.abs(w.target - w.off) < 1e-3) w.off = w.target;
        v.sprite.setFlipX(d < 0);
      } else if (!v.bob) v.sprite.setFlipX(false);
    }
  }

  idleFrame(row: number): number {
    return (row % 7) * framesOf("team_shout");
  }

  private restPose(state: GameState, m: MemberState, v: View) {
    const row = m.appearance.row % 7;
    v.bob = false;
    v.lean = 0;
    v.sprite.setFlipX(false);
    let sheet: string | null = null;
    if (m.status === "injured") sheet = "team_injured";
    else if (m.status === "fallen_caught") sheet = "team_hang";
    else if (state.outcome === "won" || m.status === "finished") sheet = "team_celebrate";
    else if (belaysAsBelayer(state, m.id).length > 0) sheet = "team_belay";
    if (sheet && this.scene.anims.exists(animKey(sheet, row))) {
      if (v.sprite.anims.currentAnim?.key !== animKey(sheet, row) || !v.sprite.anims.isPlaying) v.sprite.play(animKey(sheet, row));
    } else {
      v.sprite.anims.stop();
      v.sprite.setTexture("team_shout", this.idleFrame(row));
    }
  }

  // ---------------------------------------------------------------- animation hooks

  setS(id: string, s: number) {
    const v = this.views.get(id);
    if (v) v.s = s;
  }

  getS(id: string): number | null {
    return this.views.get(id)?.s ?? null;
  }

  pose(id: string, opts: { sheet?: string; once?: boolean; bob?: boolean; lean?: number; flipX?: boolean }) {
    const v = this.views.get(id);
    if (!v) return;
    v.posed = true;
    if (opts.bob !== undefined) v.bob = opts.bob;
    if (opts.lean !== undefined) v.lean = opts.lean;
    if (opts.flipX !== undefined) v.sprite.setFlipX(opts.flipX);
    const row = Number(this.rowOf(id));
    if (opts.sheet && this.scene.anims.exists(animKey(opts.sheet, row))) v.sprite.play(animKey(opts.sheet, row));
    else if (opts.sheet === "idle") {
      v.sprite.anims.stop();
      v.sprite.setTexture("team_shout", this.idleFrame(row));
    }
  }

  private rows = new Map<string, number>();
  rowOf(id: string): number {
    return this.rows.get(id) ?? 0;
  }
  setRows(state: GameState) {
    for (const m of Object.values(state.members)) this.rows.set(m.id, m.appearance.row % 7);
  }

  release(id: string) {
    const v = this.views.get(id);
    if (v) v.posed = false;
  }

  /** Feet position on screen as drawn right now. */
  feet(id: string): { x: number; y: number } | null {
    const v = this.views.get(id);
    return v ? { x: v.sprite.x, y: v.sprite.y } : null;
  }

  private lastTime = 0;

  /** Per-frame placement. */
  update(time: number) {
    this.marker.clear();
    this.stepWander(time, this.lastTime ? Math.min(100, time - this.lastTime) : 0);
    this.lastTime = time;
    for (const [id, v] of this.views) {
      const strolling = !v.posed && v.wander.off !== v.wander.target;
      const p = this.world.at(v.s + v.offsetM + (v.posed ? 0 : v.wander.off));
      const bob = v.bob || strolling ? (Math.floor(time / 160) % 2 === 0 ? -1 : 0) : 0;
      v.sprite.setPosition(snap(p.x), snap(p.y) + bob);
      v.sprite.setRotation(v.lean);
      v.label.setPosition(snap(p.x), snap(p.y) - 31);
      v.plan.setPosition(snap(p.x + v.label.width / 2 + 2), snap(p.y) - 32);
      if (id === this.selected) {
        const x = snap(p.x);
        const y = snap(p.y) - 43;
        this.marker.fillStyle(0x1a1c2c).fillTriangle(x - 4, y - 1, x + 4, y - 1, x, y + 4);
        this.marker.fillStyle(0xffd23f).fillTriangle(x - 3, y, x + 3, y, x, y + 3);
        this.marker.lineStyle(1, 0xffd23f, 1).strokeEllipse(x, snap(p.y), 18, 5);
        v.label.setColor("#ffd23f").setText(v.label.getData("full") ?? "").setDepth(42);
      } else {
        // crowded teams: number only (name on the member card); colour is never the only cue
        const crowded = v.offsetM !== 0;
        v.label.setColor("#ffffff").setText((crowded ? v.label.getData("short") : v.label.getData("full")) ?? "").setDepth(40);
      }
    }
  }

  /** Lean forward on steep ground while moving (rad). */
  leanFor(s: number, up: boolean): number {
    const a = angleAtS(this.world.geo, s);
    return a >= 25 && up ? 0.12 : 0;
  }
}
