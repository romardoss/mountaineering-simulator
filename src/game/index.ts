// Phaser hill view (§18.4.1). Mounts into a DOM element and returns an unmount function.
// Internal resolution 480×270, integer-scaled (settings.pixelScale or auto, §18.1.2).
import Phaser from "phaser";
import { effect } from "@preact/signals";
import { animating, baseConfirm, commandDialogFor, engine, ropePickerFor, selectedMember, session } from "../app/store";
import { isRopeAction, ropeOfOption } from "../engine/actions/options";
import { harnessNodes } from "../engine/model/selectors";
import { settings } from "../app/settings";
import { baseMissing, planMoveTo, setPlannedAction } from "../app/controller";
import { locale, t } from "../i18n/i18n";
import { BackgroundScene, setViewSize, VIEW_H, VIEW_W } from "./scenes/BackgroundScene";
import { HillScene, type Bridge } from "./scenes/HillScene";
import "./view.css";

const MIN_W = 400;
const MIN_H = 200;

/** Integer zoom (§18.1.2): the largest that still shows at least MIN_W×MIN_H logical pixels. */
function autoZoom(container: HTMLElement): number {
  const w = container.clientWidth;
  const h = container.clientHeight;
  return Math.max(1, Math.floor(Math.min(w / MIN_W, h / MIN_H)));
}

function viewSize(container: HTMLElement, z: number): [number, number] {
  return [Math.max(160, Math.floor(container.clientWidth / z)), Math.max(90, Math.floor(container.clientHeight / z))];
}

export function mountHillView(container: HTMLElement): () => void {
  let disposed = false;
  let game: Phaser.Game | null = null;
  let hill: HillScene | null = null;
  const disposers: (() => void)[] = [];

  const host = document.createElement("div");
  host.className = "hill-view-host";
  container.appendChild(host);

  const controls = document.createElement("div");
  controls.className = "hill-view-controls";
  const mkBtn = (onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hv-btn";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    controls.appendChild(b);
    return b;
  };
  const zoom1 = mkBtn(() => hill?.setZoom(1));
  const zoom2 = mkBtn(() => hill?.setZoom(2));
  const followBtn = mkBtn(() => hill?.followSelected());
  const skipBtn = mkBtn(() => hill?.skipAnimation());
  container.appendChild(controls);

  disposers.push(
    effect(() => {
      void locale.value;
      zoom1.textContent = t("ui.view.zoom1");
      zoom2.textContent = t("ui.view.zoom2");
      followBtn.textContent = t("ui.view.follow");
      skipBtn.textContent = t("ui.view.skip");
      skipBtn.title = t("ui.view.skip_hint");
      host.title = t("ui.view.canvas_hint");
    }),
  );
  disposers.push(
    effect(() => {
      skipBtn.hidden = !animating.value;
    }),
  );

  const bridge: Bridge = {
    getSession: () => session.peek(),
    getSelected: () => selectedMember.peek(),
    setSelected: (id) => {
      selectedMember.value = id;
    },
    getSpeed: () => settings.peek().animationSpeed,
    getLocale: () => locale.peek(),
    setAnimating: (v) => {
      animating.value = v;
    },
    labels: () => ({ start: t("ui.view.start"), finish: t("ui.view.finish"), summit: t("ui.view.summit") }),
    moveTo: (s) => {
      const id = selectedMember.peek();
      if (id) planMoveTo(id, s);
    },
    stationAt: (basePointId) => {
      const s = session.peek();
      const id = selectedMember.peek();
      if (!s || !id || s.state.outcome !== "in_progress" || animating.peek()) return null;
      // empty spot → make_base (sling before direct); built base → clip the rope through it (CR-27)
      const all = engine.getActionOptions(s.state, id);
      const base = Object.values(s.state.bases).find((b) => b.basePointId === basePointId);
      const opts = base
        ? all.filter((o) => o.params.kind === "clip" && o.params.baseId === base.id)
        : all.filter((o) => o.params.kind === "make_base" && o.params.basePointId === basePointId);
      if (!opts.length) return null;
      const ok = opts.find((o) => o.enabled);
      // a base on a sling + carabiner by default; a direct base only after a warning (CR-39)
      const direct = ok?.params.kind === "make_base" && ok.params.construction === "direct";
      return {
        label: t(base ? "ui.view.station.intermediate" : "ui.view.station.base"),
        enabled: !!ok,
        reason: ok ? undefined : t(opts[0].reasonKey ?? "", opts[0].reasonParams),
        plan: () => {
          if (!ok) return;
          if (direct) baseConfirm.value = { memberId: id, params: ok.params, missing: baseMissing(s.state, id) };
          else setPlannedAction(id, ok.params);
        },
      };
    },
    openCommand: (id) => {
      const s = session.peek();
      if (!s || s.state.outcome !== "in_progress" || animating.peek()) return;
      const m = s.state.members[id];
      if (!m || m.status === "injured" || m.status === "finished") return;
      selectedMember.value = id;
      commandDialogFor.value = id;
    },
    ropeIconFor: (id) => {
      const s = session.peek();
      if (!s || s.state.outcome !== "in_progress") return null;
      const m = s.state.members[id];
      if (!m || m.status === "injured" || m.status === "finished") return null;
      // the member's own rope first (tied in, held, carried), else the first rope they can act on
      const opts = engine.getActionOptions(s.state, id).filter(isRopeAction);
      if (!opts.length) return null;
      // a belay works with the climber's rope (CR-70)
      const climberRope = (o: (typeof opts)[number]) => (o.params.kind === "belay" ? harnessNodes(s.state, o.params.climberId)[0]?.rope.ropeId ?? null : null);
      const ropes = opts.map((o) => ropeOfOption(o) ?? climberRope(o)).filter((r): r is string => !!r);
      if (!ropes.length) ropes.push(...Object.keys(s.state.ropes)); // self-belay at a base only: any rope in play
      const own = ropes.find((r) => {
        const it = s.state.items[r];
        return (it?.location.kind === "carried" && it.location.memberId === id) || s.state.ropes[r]?.nodes.some((n) => "memberId" in n.attach && n.attach.memberId === id);
      });
      return s.state.items[own ?? ropes[0]]?.props.kind === "dynamic" ? "dynamic" : "static";
    },
    openRopeActions: (id) => {
      const s = session.peek();
      if (!s || s.state.outcome !== "in_progress" || animating.peek()) return;
      selectedMember.value = id;
      ropePickerFor.value = id;
    },
  };

  const applyZoom = () => {
    if (!game) return;
    const fixed = settings.peek().pixelScale;
    const z = fixed && fixed > 0 ? fixed : autoZoom(container);
    const [w, h] = viewSize(container, z);
    if (w !== VIEW_W || h !== VIEW_H) {
      setViewSize(w, h);
      game.scale.resize(w, h);
      game.scene.getScenes(true).forEach((sc) => sc instanceof BackgroundScene && sc.scene.restart());
    }
    if (game.scale.zoom !== z) game.scale.setZoom(z);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!hill) return;
    const step = 24;
    switch (e.key) {
      case "+":
      case "=":
        hill.setZoom(2);
        break;
      case "-":
      case "_":
        hill.setZoom(1);
        break;
      case "ArrowLeft":
        hill.pan(-step, 0);
        break;
      case "ArrowRight":
        hill.pan(step, 0);
        break;
      case "ArrowUp":
        hill.pan(0, -step);
        break;
      case "ArrowDown":
        hill.pan(0, step);
        break;
      case " ":
        hill.skipAnimation();
        break;
      case "f":
      case "F":
        hill.followSelected();
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const start = () => {
    if (disposed) return;
    hill = new HillScene(bridge);
    const bg = new BackgroundScene();
    {
      const fixed = settings.peek().pixelScale;
      const z0 = fixed && fixed > 0 ? fixed : autoZoom(container);
      setViewSize(...viewSize(container, z0));
    }
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: VIEW_W,
      height: VIEW_H,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: "#9fd3fa",
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false },
      scale: { mode: Phaser.Scale.NONE, zoom: autoZoom(container) },
      scene: [bg, hill],
    });
    if (import.meta.env?.DEV) (window as unknown as { __zgrGame?: Phaser.Game }).__zgrGame = game;
    game.events.once(Phaser.Core.Events.READY, () => {
      const canvas = game?.canvas;
      if (canvas) {
        canvas.tabIndex = 0;
        canvas.setAttribute("aria-label", t("ui.view.canvas_label"));
        canvas.addEventListener("keydown", onKey);
      }
      applyZoom();
    });
    disposers.push(
      effect(() => {
        // any store change → redraw (plan icons, selection, new step animation)
        void session.value;
        void selectedMember.value;
        void locale.value;
        hill?.refresh();
      }),
    );
    disposers.push(
      effect(() => {
        void settings.value.pixelScale;
        applyZoom();
      }),
    );
    const ro = new ResizeObserver(() => applyZoom());
    ro.observe(container);
    disposers.push(() => ro.disconnect());
  };

  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts) {
    Promise.all([fonts.load('10px "Tiny5"'), fonts.load('8px "Press Start 2P"')])
      .catch(() => undefined)
      .then(() => fonts.ready)
      .then(start, start);
  } else start();

  return () => {
    disposed = true;
    for (const d of disposers) d();
    game?.canvas?.removeEventListener("keydown", onKey);
    game?.destroy(true);
    game = null;
    hill = null;
    host.remove();
    controls.remove();
    animating.value = false;
  };
}
