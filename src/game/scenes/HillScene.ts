// The world (§18.2–18.4): terrain, trees, bases, ropes, members, camera.
import Phaser from "phaser";
import type { Session } from "../../app/store";
import type { Locale } from "../../i18n/i18n";
import type { GameState, HillConfig, Season, Weather } from "../../engine/model/types";
import { assetUrl, manifest } from "../assets";
import { Timeline } from "../anim/timeline";
import { drawRopes, drawStatic, hangPoint, resetSagAnimation } from "../render/dynamic";
import { createAnimations, MemberViews, SHEETS } from "../render/members";
import { buildTerrain, type TerrainView } from "../render/terrain";
import { ensurePlaceholderTextures, ensureTeamPlaceholder } from "../render/textures";
import { buildWorld, type WorldMap } from "../render/world";
import { basePointsOf } from "../../engine/geometry/hill";
import { BackgroundScene, VIEW_H, VIEW_W } from "./BackgroundScene";

export interface Bridge {
  getSession(): Session | null;
  getSelected(): string | null;
  setSelected(id: string): void;
  getSpeed(): number;
  getLocale(): Locale;
  setAnimating(v: boolean): void;
  labels(): { start: string; finish: string; summit: string };
  /** Right-click on the hill: send the selected member to path position s (CR-18). */
  moveTo(s: number): void;
  /** Station icon for a base spot next to the selected member (CR-20); null = nothing to show. */
  stationAt(basePointId: string): { label: string; enabled: boolean; reason?: string; plan(): void } | null;
  /** Hover command button (CR-35): open the command dialog for a member. */
  openCommand(memberId: string): void;
  /** Hover rope icon (CR-62): rope kind of the member's rope actions, null = no rope action. */
  ropeIconFor(memberId: string): "static" | "dynamic" | null;
  /** Hover rope icon (CR-62): open the action picker at the member's rope actions. */
  openRopeActions(memberId: string): void;
}

const STATIC_ASSETS = ["terrain_grass_fill", "terrain_grass_edge", "terrain_ground_fill", "terrain_ground_edge", "terrain_rock_fill", "terrain_rock_edge", "terrain_scree_fill", "terrain_scree_edge", "tree_conifer_small", "tree_conifer_large", "tree_deciduous_small", "tree_deciduous_large", "prop_rock_outcrop", "prop_bolt", "prop_base_marker"];

export class HillScene extends Phaser.Scene {
  private world: WorldMap | null = null;
  private terrain: TerrainView | null = null;
  private worldKey = "";
  private shownState: GameState | null = null;
  private shownEvents: unknown = null;
  private statics!: Phaser.GameObjects.Graphics;
  private goalMarks!: Phaser.GameObjects.Graphics;
  private goalLabels: Phaser.GameObjects.Text[] = [];
  private station: Phaser.GameObjects.GameObject[] = [];
  private cmdButton: Phaser.GameObjects.Image | null = null;
  private ropeButton: Phaser.GameObjects.Image | null = null;
  private ropeKind: "static" | "dynamic" | null = null;
  private cmdFor: string | null = null;
  private cmdHide: Phaser.Time.TimerEvent | null = null;
  private ropes!: Phaser.GameObjects.Graphics;
  private members!: MemberViews;
  private timeline!: Timeline;
  private follow = true;
  private lastSelected: string | null = null;
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  ready = false;

  constructor(private bridge: Bridge) {
    super({ key: "hill", active: true });
  }

  preload() {
    for (const id of [...STATIC_ASSETS, ...Object.keys(SHEETS)]) {
      const url = assetUrl(id);
      if (!url) continue;
      const e = manifest[id];
      if (e.frameWidth) this.load.spritesheet(id, url, { frameWidth: e.frameWidth, frameHeight: e.frameHeight ?? e.frameWidth });
      else this.load.image(id, url);
    }
    this.load.on("loaderror", (f: { key: string }) => console.warn(`[zgr] asset failed to load: ${f.key} — using a placeholder`));
  }

  create() {
    ensurePlaceholderTextures(this);
    for (const [sheet, def] of Object.entries(SHEETS)) ensureTeamPlaceholder(this, sheet, manifest[sheet]?.frames ?? def.frames);
    createAnimations(this);
    this.cameras.main.setRoundPixels(true);
    this.statics = this.add.graphics().setDepth(20);
    this.ropes = this.add.graphics().setDepth(35);
    this.world = buildWorld(EMPTY_HILL);
    this.members = new MemberViews(this, this.world);
    this.members.placeAt = (id, s) => this.hangAt(id, s);
    this.members.onSelect = (id) => {
      this.follow = true;
      this.bridge.setSelected(id);
    };
    this.timeline = new Timeline(this, this.members, () => this.world!, () => this.bridge.getLocale());
    this.members.onHover = (id) => (id ? this.showCommandButton(id) : this.scheduleCommandHide());
    this.input.mouse?.disableContextMenu();
    this.goalMarks = this.add.graphics().setDepth(30);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        if (this.world) this.bridge.moveTo(this.world.sAtX(p.worldX));
        return;
      }
      this.drag = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY, moved: false };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return;
      this.drag.moved = true;
      this.follow = false;
      const z = this.cameras.main.zoom;
      this.cameras.main.setScroll(this.drag.sx - dx / z, this.drag.sy - dy / z);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.drag && !this.drag.moved && over.length === 0) {
        this.timeline.skip();
        this.clickBaseSpot(p.worldX);
      }
      this.drag = null;
    });
    this.ready = true;
    this.refresh();
  }

  // ---------------------------------------------------------------- store → scene

  refresh() {
    if (!this.ready) return;
    const s = this.bridge.getSession();
    const bg = this.scene.get("background") as BackgroundScene;
    if (!s) {
      this.goalMarks.clear();
      this.clearWorld();
      return;
    }
    const hill = s.state.scenario.route.obstacles[0];
    const weather = s.state.weather ?? "dry";
    const key = `${s.state.scenario.id}|${s.state.scenario.season}|${weather}|${JSON.stringify(hill)}`;
    if (key !== this.worldKey) {
      this.worldKey = key;
      this.timeline.skip();
      this.buildWorld(hill, s.state.scenario.season, weather);
      bg.setSeason(s.state.scenario.season, weather, hill.type);
      this.shownState = null;
      this.shownEvents = s.lastEvents;
      this.members.sync(s.state, s.plan, true);
      this.centerOnSelected(true);
    }
    // a new step, or a command shouted at once between steps (same step number, CR-72)
    const isNewStep = s.lastEvents !== this.shownEvents && s.prevState && s.state !== this.shownState && s.state.step >= (this.shownState?.step ?? -1);
    if (isNewStep && s.prevState) {
      this.shownEvents = s.lastEvents;
      this.shownState = s.state;
      this.members.sync(s.prevState, s.plan, true);
      drawStatic(this.statics, s.state, this.world!);
      this.follow = true;
      this.bridge.setAnimating(true);
      this.timeline.play(s.prevState, s.state, s.lastEvents, this.bridge.getSpeed(), () => {
        const cur = this.bridge.getSession();
        if (cur) this.members.sync(cur.state, cur.plan, true);
        this.bridge.setAnimating(false);
      });
      this.drawGoals(s);
      this.hideStation();
      return;
    }
    const stateChanged = s.state !== this.shownState;
    this.shownState = s.state;
    this.shownEvents = s.lastEvents;
    drawStatic(this.statics, s.state, this.world!);
    if (!this.timeline.running) this.members.sync(s.state, s.plan, stateChanged);
    const sel = this.bridge.getSelected();
    if (sel !== this.lastSelected) {
      this.lastSelected = sel;
      this.hideStation();
      this.follow = true;
    }
    this.members.selected = sel;
    this.drawGoals(s);
  }

  /**
   * Hover icons (CR-35, CR-62): «Подача команди» (speech bubble) and, when the member has rope
   * actions, a schematic static / dynamic rope icon that opens the picker at the rope actions.
   * Each icon is highlighted on hover; its hitbox is exactly its 16×16 image at whole pixels.
   */
  private showCommandButton(id: string) {
    const s = this.bridge.getSession();
    if (!s || s.state.outcome !== "in_progress" || this.timeline.running) return;
    const m = s.state.members[id];
    if (!m || m.status === "injured" || m.status === "finished") return;
    this.cmdHide?.remove();
    this.cmdHide = null;
    ensureHoverIconTextures(this);
    if (!this.cmdButton) {
      this.cmdButton = this.hoverIcon("icon_command", () => this.cmdFor && this.bridge.openCommand(this.cmdFor));
      this.ropeButton = this.hoverIcon("icon_rope_static", () => this.cmdFor && this.bridge.openRopeActions(this.cmdFor));
    }
    this.cmdFor = id;
    this.ropeKind = this.bridge.ropeIconFor(id);
    if (this.ropeKind) this.ropeButton!.setTexture(`icon_rope_${this.ropeKind}`);
    this.placeCommandButton();
  }

  private hoverIcon(key: string, onClick: () => void): Phaser.GameObjects.Image {
    const icon = this.add.image(0, 0, key).setOrigin(0.5).setDepth(45);
    icon.setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, HOVER_ICON, HOVER_ICON), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    icon.on("pointerover", () => {
      this.cmdHide?.remove();
      this.cmdHide = null;
      icon.setTexture(`${icon.texture.key.replace(/_hl$/, "")}_hl`);
    });
    icon.on("pointerout", () => {
      icon.setTexture(icon.texture.key.replace(/_hl$/, ""));
      this.scheduleCommandHide();
    });
    icon.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return;
      onClick();
      this.hideCommandButton();
    });
    return icon;
  }

  private placeCommandButton() {
    if (!this.cmdButton || !this.cmdFor) return;
    const f = this.members.feet(this.cmdFor);
    if (!f) return this.hideCommandButton();
    const x = Math.round(f.x);
    const y = Math.round(f.y) - 52;
    // side by side above the label; alone in the middle when there is no rope action
    this.cmdButton.setPosition(this.ropeKind ? x - 9 : x, y).setVisible(true);
    this.ropeButton?.setPosition(x + 9, y).setVisible(!!this.ropeKind);
  }

  private scheduleCommandHide() {
    this.cmdHide?.remove();
    this.cmdHide = this.time.delayedCall(600, () => this.hideCommandButton());
  }

  private hideCommandButton() {
    this.cmdHide?.remove();
    this.cmdHide = null;
    this.cmdFor = null;
    this.cmdButton?.setVisible(false).setTexture("icon_command");
    this.ropeButton?.setVisible(false);
  }

  /** Left-click near a base spot: station icon above it (CR-20). */
  private clickBaseSpot(worldX: number) {
    this.hideStation();
    const s = this.bridge.getSession();
    if (!this.world || !s) return;
    const at = this.world.sAtX(worldX);
    // the spot marker or its support: tree crown / rock outcrop (CR-38)
    const hill = s.state.scenario.route.obstacles[0];
    const reach = (b: { anchorType: string; treeId?: string }) => (b.anchorType === "rock_outcrop" ? 1.5 : b.anchorType === "tree" ? (hill.trees.find((t) => t.id === b.treeId)?.size === "large" ? 1.7 : 1) : 1);
    const bp = basePointsOf(hill)
      .filter((b) => Math.abs(b.s - at) <= reach(b))
      .sort((a, b) => Math.abs(a.s - at) - Math.abs(b.s - at))[0];
    const info = bp && this.bridge.stationAt(bp.id);
    if (!bp || !info) return;
    ensureStationTexture(this);
    const p = this.world.at(bp.s);
    const icon = this.add.image(Math.round(p.x), Math.round(p.y) - 52, "icon_station").setDepth(40).setInteractive({ useHandCursor: info.enabled });
    if (!info.enabled) icon.setTint(0x8a8a96);
    icon.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown()) return;
      if (info.enabled) info.plan();
      this.hideStation();
    });
    this.station.push(icon);
    // short label next to the icon (CR-27); the reason below it when the action is not possible
    const style = { fontFamily: "Tiny5", fontSize: "10px", color: info.enabled ? "#ffd23f" : "#ffffff", stroke: "#1a1c2c", strokeThickness: 2, resolution: 1 };
    const label = this.add.text(Math.round(p.x) + 9, Math.round(p.y) - 57, info.label, style).setDepth(40).setInteractive({ useHandCursor: info.enabled });
    label.on("pointerdown", (ptr: Phaser.Input.Pointer) => icon.emit("pointerdown", ptr));
    this.station.push(label);
    if (info.reason)
      this.station.push(
        this.add
          .text(Math.round(p.x) + 9, Math.round(p.y) - 45, info.reason, { ...style, color: "#ffffff", wordWrap: { width: 160 } })
          .setDepth(40),
      );
  }

  private hideStation() {
    this.station.forEach((o) => o.destroy());
    this.station = [];
  }

  /** Yellow cross + member number at every right-click goal (CR-18). */
  private drawGoals(s: Session) {
    this.goalMarks.clear();
    this.goalLabels.forEach((l) => l.destroy());
    this.goalLabels = [];
    if (!this.world) return;
    for (const [id, target] of Object.entries(s.goals ?? {})) {
      const p = this.world.at(target);
      const x = Math.round(p.x);
      const y = Math.round(p.y) - 3;
      this.goalMarks.lineStyle(3, 0x1a1c2c).lineBetween(x - 4, y - 4, x + 4, y + 4).lineBetween(x - 4, y + 4, x + 4, y - 4);
      this.goalMarks.lineStyle(1, 0xffd23f).lineBetween(x - 3, y - 3, x + 3, y + 3).lineBetween(x - 3, y + 3, x + 3, y - 3);
      const n = s.scenario.team.findIndex((m) => m.id === id) + 1;
      this.goalLabels.push(this.add.text(x + 5, y - 14, String(n), { fontFamily: "Tiny5", fontSize: "10px", color: "#ffd23f", stroke: "#1a1c2c", strokeThickness: 2, resolution: 1 }).setDepth(30));
    }
  }

  private buildWorld(hill: HillConfig, season: Season, weather: Weather) {
    this.terrain?.destroy();
    resetSagAnimation();
    this.world = buildWorld(hill);
    this.members.setWorld(this.world);
    this.terrain = buildTerrain(this, hill, this.world, season, weather, this.bridge.labels());
    this.cameras.main.setBounds(0, 0, Math.max(this.world.width, VIEW_W), Math.max(this.world.height, VIEW_H));
  }

  private clearWorld() {
    this.terrain?.destroy();
    this.terrain = null;
    this.worldKey = "";
    this.statics.clear();
    this.ropes.clear();
    this.members.destroy();
    this.members = new MemberViews(this, this.world!);
    this.members.placeAt = (id, s) => this.hangAt(id, s);
    this.members.onSelect = (id) => this.bridge.setSelected(id);
    this.timeline = new Timeline(this, this.members, () => this.world!, () => this.bridge.getLocale());
  }

  /** Members on ravine перила hang on the rope (CR-55); the state shown is the one animated towards. */
  private hangAt(id: string, s: number) {
    const st = this.timeline.running ? this.shownState : this.bridge.getSession()?.state;
    return st && this.world ? hangPoint(st, this.world, id, s) : null;
  }

  // ---------------------------------------------------------------- camera

  private centerOnSelected(instant: boolean) {
    const cam = this.cameras.main;
    const id = this.bridge.getSelected() ?? this.members.ids()[0];
    const f = id ? this.members.feet(id) : null;
    const s = this.bridge.getSession();
    let target = f;
    if (!target && s && this.world) {
      const m = s.state.members[id ?? ""];
      if (m) target = this.world.at(m.pos.s);
    }
    if (!target) return;
    const tx = target.x - cam.width / 2;
    const ty = target.y - 30 - cam.height / 2;
    if (instant) cam.setScroll(tx, ty);
    else cam.setScroll(cam.scrollX + (tx - cam.scrollX) * 0.12, cam.scrollY + (ty - cam.scrollY) * 0.12);
  }

  setZoom(z: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, 1, 2));
  }

  getZoom(): number {
    return this.cameras.main.zoom;
  }

  pan(dx: number, dy: number) {
    this.follow = false;
    const cam = this.cameras.main;
    cam.setScroll(cam.scrollX + dx / cam.zoom, cam.scrollY + dy / cam.zoom);
  }

  followSelected() {
    this.follow = true;
  }

  skipAnimation() {
    this.timeline.skip();
  }

  isAnimating(): boolean {
    return this.timeline.running;
  }

  override update(time: number) {
    if (!this.world) return;
    this.members.selected = this.bridge.getSelected();
    this.members.update(time);
    this.timeline.update();
    if (this.timeline.running) this.hideCommandButton();
    else this.placeCommandButton();
    const s = this.bridge.getSession();
    if (s) drawRopes(this.ropes, s.state, this.world, (id) => this.members.feet(id), (id) => this.members.lying(id));
    if (this.follow) this.centerOnSelected(false);
    const bg = this.scene.get("background") as BackgroundScene;
    bg.follow(this.cameras.main, this.world.height);
  }
}

const EMPTY_HILL: HillConfig = {
  id: "empty",
  type: "hill",
  routeType: "ascent",
  startZoneM: 6,
  finishZoneM: 8,
  sections: [{ lengthM: 10, angleDeg: 10, surface: "grass" }],
  trees: [],
  basePoints: [],
};

/** Station icon (CR-20): flag on a pole with a carabiner ring, 14×16 px. */
function ensureStationTexture(scene: Phaser.Scene) {
  if (scene.textures.exists("icon_station")) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0x1a1c2c).fillRect(0, 0, 14, 16);
  g.fillStyle(0xfff6e0).fillRect(1, 1, 12, 14);
  g.fillStyle(0x5a3a22).fillRect(3, 3, 2, 11);
  g.fillStyle(0xd93636).fillRect(5, 3, 6, 2).fillRect(5, 5, 4, 2);
  g.fillStyle(0xc8c8d0).fillRect(7, 9, 4, 1).fillRect(7, 12, 4, 1).fillRect(6, 10, 1, 2).fillRect(11, 10, 1, 2);
  g.generateTexture("icon_station", 14, 16);
  g.destroy();
}

const HOVER_ICON = 16;

/**
 * Hover icons (CR-35, CR-62), 16×16 each with a `_hl` variant (yellow frame) shown on hover:
 * `icon_command` speech bubble with «!»; `icon_rope_static` a straight rope with even braid ticks;
 * `icon_rope_dynamic` a zigzag (stretchy) rope.
 */
function ensureHoverIconTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("icon_command_hl")) return;
  const frame = (g: Phaser.GameObjects.Graphics, hl: boolean) => {
    g.fillStyle(hl ? 0xffd23f : 0x1a1c2c).fillRect(0, 0, 16, 16);
    g.fillStyle(hl ? 0xfff3c0 : 0xfff6e0).fillRect(1, 1, 14, 14);
  };
  const draw: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
    icon_command: (g) => {
      g.fillStyle(0x1a1c2c).fillRect(3, 3, 10, 7).fillRect(5, 10, 2, 2);
      g.fillStyle(0xffffff).fillRect(4, 4, 8, 5);
      g.fillStyle(0xd93636).fillRect(7, 4, 2, 3).fillRect(7, 8, 2, 1);
    },
    icon_rope_static: (g) => {
      g.fillStyle(0x2563d9).fillRect(2, 7, 12, 3);
      g.fillStyle(0xffffff);
      for (let x = 3; x < 14; x += 3) g.fillRect(x, 8, 1, 1);
      g.fillStyle(0x1a1c2c).fillRect(2, 6, 1, 5).fillRect(13, 6, 1, 5);
    },
    icon_rope_dynamic: (g) => {
      g.fillStyle(0xd93636);
      const ys = [9, 7, 5, 7, 9, 11, 9, 7, 5, 7, 9, 11];
      ys.forEach((y, i) => g.fillRect(2 + i, y - 1, 1, 3));
    },
  };
  for (const [key, fn] of Object.entries(draw)) {
    for (const hl of [false, true]) {
      const g = scene.make.graphics({}, false);
      frame(g, hl);
      fn(g);
      g.generateTexture(hl ? `${key}_hl` : key, HOVER_ICON, HOVER_ICON);
      g.destroy();
    }
  }
}
