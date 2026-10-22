// Animation timeline (ARCHITECTURE §7.2.5): turns one step's GameEvent[] into
// tweens between prevState and nextState. Skippable (Space / click) — then it
// jumps straight to the final state.
import Phaser from "phaser";
import type { GameEvent, GameState } from "../../engine/model/types";
import { tl, type Locale } from "../../i18n/i18n";
import type { MemberViews } from "../render/members";
import { snap, type WorldMap } from "../render/world";

const ACTION_POSE: Record<string, string> = {
  "knot.tied": "team_tie_knot",
  "rope.tied_in": "team_tie_knot",
  "rope.fixed": "team_tie_knot",
  "rope.clipped": "team_tie_knot",
  "base.built": "team_tie_knot",
  "member.attached": "team_tie_knot",
  "member.detached": "team_tie_knot",
  "item.passed": "team_tie_knot",
  "item.picked": "team_tie_knot",
  "item.dropped": "team_tie_knot",
  "item.worn": "team_tie_knot",
  "belay.set": "team_belay",
  "command.shouted": "team_shout",
  "command.misunderstood": "team_shout",
};

interface Bubble {
  memberId: string;
  box: Phaser.GameObjects.Container;
}

export class Timeline {
  running = false;
  private gen = 0;
  private tweens: Phaser.Tweens.Tween[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private bubbles: Bubble[] = [];
  private stones: Phaser.GameObjects.GameObject[] = [];
  private finishCb: (() => void) | null = null;

  constructor(
    private scene: Phaser.Scene,
    private members: MemberViews,
    private getWorld: () => WorldMap,
    private getLocale: () => Locale,
  ) {}

  /** Plays the step; `onDone` is called exactly once (also on skip). */
  play(prev: GameState, next: GameState, events: GameEvent[], speed: number, onDone: () => void) {
    this.skip();
    const gen = ++this.gen;
    this.running = true;
    this.finishCb = onDone;
    const k = 1 / Math.max(0.25, speed);
    const visual = events.filter((e) => e.type !== "step.done" && e.type !== "protocol.violation");
    if (visual.length === 0) return this.finish(gen);

    const after = (ms: number, fn: () => void) => {
      this.timers.push(this.scene.time.delayedCall(ms * k, () => gen === this.gen && fn()));
    };
    const tweenS = (id: string, from: number, to: number, ms: number) => {
      const obj = { s: from };
      this.members.setS(id, from);
      this.tweens.push(this.scene.tweens.add({ targets: obj, s: to, duration: ms * k, ease: "Linear", onUpdate: () => this.members.setS(id, obj.s) }));
    };

    // Phase A — what members did (parallel)
    const PHASE_A = 750;
    let phaseA = 0;
    const movedTo = new Map<string, number>();
    const geoS = (id: string) => prev.members[id]?.pos.s ?? next.members[id]?.pos.s ?? 0;
    for (const e of visual) {
      const id = String(e.params.member ?? "");
      if (!id || !next.members[id]) continue;
      if (e.type === "member.moved") {
        const from = Number(e.params.from);
        const to = Number(e.params.to);
        movedTo.set(id, to);
        const world = this.getWorld();
        const left = world.at(to).x < world.at(from).x;
        const up = world.at(to).y < world.at(from).y;
        this.members.pose(id, { sheet: "idle", bob: true, flipX: left, lean: (left ? -1 : 1) * this.members.leanFor(from, up) });
        tweenS(id, from, to, PHASE_A);
        after(PHASE_A, () => this.members.pose(id, { bob: false, lean: 0 }));
        phaseA = PHASE_A;
      } else if (ACTION_POSE[e.type]) {
        this.members.setS(id, geoS(id));
        this.members.pose(id, { sheet: ACTION_POSE[e.type] });
        phaseA = Math.max(phaseA, 600);
        if (e.type === "command.shouted") this.bubble(id, String(e.params.command));
        if (e.type === "command.misunderstood") this.bubble(id, String(e.params.command), true);
      }
    }

    // Phase B — hazards: falls, rocks
    let phaseB = 0;
    const fallen = new Set<string>();
    for (const e of visual) {
      const id = String(e.params.member ?? "");
      if (e.type === "fall.start" && next.members[id] && !fallen.has(id)) {
        fallen.add(id);
        const from = movedTo.get(id) ?? geoS(id);
        const to = next.members[id].pos.s;
        const caught = visual.some((x) => x.type === "fall.caught" && x.params.member === id);
        const injured = next.members[id].status === "injured";
        after(phaseA, () => this.members.pose(id, { sheet: "team_fall", bob: false, lean: 0 }));
        after(phaseA + 350, () => {
          if (Math.abs(to - from) > 0.2) {
            this.members.pose(id, { sheet: "team_slide" });
            tweenS(id, from, to, Math.min(900, 200 + Math.abs(to - from) * 40));
          }
        });
        const land = phaseA + 350 + (Math.abs(to - from) > 0.2 ? Math.min(900, 200 + Math.abs(to - from) * 40) : 0);
        after(land, () => this.members.pose(id, { sheet: injured ? "team_injured" : caught ? "team_hang" : "idle" }));
        phaseB = Math.max(phaseB, land + 500 - phaseA);
      }
      if (e.type === "rockfall.dislodged" && next.members[id]) {
        const threatened = (e.refs.members ?? []).filter((m) => m !== id);
        const fromS = movedTo.get(id) ?? geoS(id);
        const lowest = threatened.length ? Math.min(...threatened.map((m) => next.members[m]?.pos.s ?? fromS)) : fromS - 4;
        after(phaseA, () => this.stone(fromS, lowest, 800 * k));
        phaseB = Math.max(phaseB, 900);
      }
      if (e.type === "rockfall.hit" && next.members[id]) {
        after(phaseA + 700, () => {
          const f = this.members.feet(id);
          if (!f) return;
          const flash = this.scene.add.rectangle(f.x, f.y - 16, 18, 30, 0xff2020, 0.5).setDepth(45);
          this.stones.push(flash);
          this.tweens.push(this.scene.tweens.add({ targets: flash, alpha: 0, duration: 400 * k }));
        });
      }
    }

    // Phase C — celebration on a win
    let phaseC = 0;
    if (visual.some((e) => e.type === "game.won")) {
      after(phaseA + phaseB, () => {
        for (const id of Object.keys(next.members)) this.members.pose(id, { sheet: "team_celebrate", bob: false, lean: 0, flipX: false });
      });
      phaseC = 1400;
    }
    const total = Math.max(300, phaseA + phaseB + phaseC);
    const bubbleTail = this.bubbles.length ? 1400 : 0;
    after(Math.max(total, bubbleTail), () => this.finish(gen));
  }

  private bubble(memberId: string, command: string, misunderstood = false) {
    const uk = tl("uk", `cmd.${command}`);
    const lines: Phaser.GameObjects.Text[] = [];
    const main = this.scene.add.text(0, 0, misunderstood ? `${uk}?` : uk, { fontFamily: "Tiny5", fontSize: "10px", color: "#1a1c2c", resolution: 1 });
    lines.push(main);
    if (this.getLocale() === "en") {
      let en = tl("en", `cmd.${command}`);
      if (en === uk || en.startsWith("⟦")) en = tl("en", `cmd.${command}.hint`);
      lines.push(this.scene.add.text(0, 11, en, { fontFamily: "Tiny5", fontSize: "10px", color: "#5a5a6e", resolution: 1 }));
    }
    const w = Math.ceil(Math.max(...lines.map((l) => l.width))) + 8;
    const h = lines.length * 11 + 5;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1c2c).fillRect(-1, -1, w + 2, h + 2);
    bg.fillStyle(misunderstood ? 0xffe8e4 : 0xffffff).fillRect(0, 0, w, h);
    bg.fillStyle(0x1a1c2c).fillTriangle(6, h, 12, h, 6, h + 5);
    bg.fillStyle(misunderstood ? 0xffe8e4 : 0xffffff).fillTriangle(7, h - 1, 11, h - 1, 7, h + 3);
    for (const l of lines) l.setPosition(4, l.y + 2);
    const box = this.scene.add.container(0, 0, [bg, ...lines]).setDepth(50);
    box.setSize(w, h);
    this.bubbles.push({ memberId, box });
  }

  private stone(fromS: number, toS: number, ms: number) {
    const world = this.getWorld();
    const a = world.at(fromS);
    const b = world.at(Math.min(fromS, toS));
    const img = this.scene.add.image(snap(a.x), snap(a.y - 8), "prop_stone").setDepth(44);
    this.stones.push(img);
    this.tweens.push(this.scene.tweens.add({ targets: img, x: snap(b.x), y: snap(b.y - 3), angle: 720, duration: ms, ease: "Quad.easeIn" }));
  }

  /** Called every frame by the scene: bubbles follow their member. */
  update() {
    for (const b of this.bubbles) {
      const f = this.members.feet(b.memberId);
      if (f) b.box.setPosition(snap(f.x - 6), snap(f.y - 50 - b.box.height));
    }
  }

  /** Jump to the end (Space / click). */
  skip() {
    if (!this.running) return;
    this.finish(this.gen);
  }

  private finish(gen: number) {
    if (gen !== this.gen && this.running === false) return;
    this.gen++;
    for (const t of this.tweens) t.remove();
    for (const t of this.timers) t.remove(false);
    for (const b of this.bubbles) b.box.destroy();
    for (const s of this.stones) s.destroy();
    this.tweens = [];
    this.timers = [];
    this.bubbles = [];
    this.stones = [];
    this.running = false;
    const cb = this.finishCb;
    this.finishCb = null;
    cb?.();
  }
}
