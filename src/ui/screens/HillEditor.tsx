// Конструктор перешкод — редактор схилу (§7.3, CR-1): edits a library hill with a live side-view preview.
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { data, editingHill, go, route } from "../../app/store";
import { saveUserHill } from "../../app/obstacles";
import { basePointsOf, buildHillGeometry, toWorld, type HillGeometry } from "../../engine/geometry/hill";
import { validateHill } from "../../engine/scenario/validate";
import type { AnchorType, ConfigSurface, HillConfig, RouteType, SectionConfig, Season, Surface } from "../../engine/model/types";
import { Msg, TopBar } from "../components/common";
import { newId, SEASON_PREVIEW, SEASONS, SURFACE_COLORS } from "./cfgShared";
import { mapSurface } from "../../engine/model/selectors";

const SURFACES: ConfigSurface[] = ["grass", "ground", "rock", "scree"];
const ROUTES: RouteType[] = ["ascent", "descent", "ascent_descent"];
const DEFAULT_DESCENT: SectionConfig[] = [
  { lengthM: 20, angleDeg: 35, surface: "grass" },
  { lengthM: 20, angleDeg: 25, surface: "grass" },
  { lengthM: 15, angleDeg: 15, surface: "grass" },
];

type ClickMode = "none" | "tree_large" | "tree_small" | "bp_tree" | "bp_rock_outcrop" | "bp_bolt";

function hill(): HillConfig {
  return editingHill.value!;
}

/** Always a new object: hill geometry is memoised by identity (S§5.3). */
function setHill(fn: (h: HillConfig) => void) {
  const h = structuredClone(editingHill.value!);
  fn(h);
  editingHill.value = h;
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

function effSurface(s: Surface | null, season: Season): Surface | null {
  return s ? mapSurface(data, season, "dry", s) : null;
}

/** s on the path whose world x is closest to `x` (x is monotonic in s). */
function sAtX(geo: HillGeometry, x: number): number {
  let lo = 0;
  let hi = geo.totalLength;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (toWorld(geo, mid).x < x) lo = mid;
    else hi = mid;
  }
  return round1((lo + hi) / 2);
}

export function Preview({ geo, season, mode = "none", onClickS, compact }: { geo: HillGeometry; season: Season; mode?: ClickMode; onClickS?: (s: number) => void; compact?: boolean }) {
  const W = 900;
  const H = compact ? 320 : 280;
  const pad = 16;
  const span = Math.max(geo.maxY - geo.minY, 1);
  const k = Math.min((W - pad * 2) / Math.max(geo.maxX, 1), (H - pad * 2 - 30) / span);
  const X = (x: number) => pad + x * k;
  const Y = (y: number) => H - pad - (y - geo.minY) * k;
  const bottom = H;
  const look = SEASON_PREVIEW[season];
  const zoneFill = look.zone;
  const polys = geo.segments.map((g) => {
    const a = toWorld(geo, g.s0);
    const b = toWorld(geo, g.s1 - 1e-6);
    const surf = effSurface(g.surface, season);
    const fill = surf ? (surf === "grass" && look.grass) || SURFACE_COLORS[surf] : zoneFill;
    return (
      <g>
        <polygon points={`${X(a.x)},${Y(a.y)} ${X(b.x)},${Y(b.y)} ${X(b.x)},${bottom} ${X(a.x)},${bottom}`} fill={fill} stroke="#1a1c2c" stroke-width="1" />
        {!compact && g.zone !== "slope" && (
          <text x={(X(a.x) + X(b.x)) / 2} y={Math.min(Y(a.y), Y(b.y)) + 16} font-size="10" text-anchor="middle" fill="#1a1c2c">
            {t(`ui.cfg.hill.zone.${g.zone}`)}
          </text>
        )}
        {!compact && g.zone === "slope" && (
          <text x={(X(a.x) + X(b.x)) / 2} y={(Y(a.y) + Y(b.y)) / 2 + 22} font-size="10" text-anchor="middle" fill="#1a1c2c">
            {g.angleDeg}°
          </text>
        )}
      </g>
    );
  });
  const h = geo.obstacle;
  const onClick = (e: MouseEvent) => {
    if (mode === "none" || !onClickS) return;
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    onClickS(sAtX(geo, (px - pad) / k));
  };
  return (
    <svg class="cfg-preview" viewBox={`0 0 ${W} ${H}`} onClick={onClick as never} role="img" aria-label={t("ui.cfg.hill.preview")} style={{ cursor: mode === "none" ? "default" : "crosshair", background: look.sky }}>
      {polys}
      {h.trees.map((tr) => {
        const p = toWorld(geo, tr.s);
        const sz = tr.size === "large" ? 22 : 13;
        return (
          <g>
            <rect x={X(p.x) - 1.5} y={Y(p.y) - sz * 0.35} width="3" height={sz * 0.35} fill="#5a3a22" />
            <polygon points={`${X(p.x) - sz / 3},${Y(p.y) - sz * 0.3} ${X(p.x)},${Y(p.y) - sz * 1.3} ${X(p.x) + sz / 3},${Y(p.y) - sz * 0.3}`} fill={look.tree} stroke="#1a1c2c" stroke-width="1" />
          </g>
        );
      })}
      {basePointsOf(h).map((bp) => {
        const p = toWorld(geo, bp.s);
        const c = bp.anchorType === "bolt" ? "#c8c8d0" : bp.anchorType === "rock_outcrop" ? "#6e6e7a" : "#f2a65a";
        // large trees are base spots automatically (CR-31): drawn fainter
        return (
          <g opacity={bp.id.startsWith("bp@") ? 0.55 : 1}>
            <line x1={X(p.x)} y1={Y(p.y)} x2={X(p.x)} y2={Y(p.y) - 14} stroke="#1a1c2c" stroke-width="2" />
            <polygon points={`${X(p.x)},${Y(p.y) - 14} ${X(p.x) + 9},${Y(p.y) - 11} ${X(p.x)},${Y(p.y) - 8}`} fill={c} stroke="#1a1c2c" stroke-width="1" />
            {!compact && (
              <text x={X(p.x) + 3} y={Y(p.y) + 12} font-size="9" fill="#1a1c2c">
                {bp.id}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SectionList({ field, title }: { field: "sections" | "descentSections"; title: string }) {
  const h = hill();
  const list = h[field] ?? [];
  const r = data.rules.hill;
  const edit = (i: number, patch: Partial<SectionConfig>) => setHill((x) => Object.assign(x[field]![i], patch));
  const move = (i: number, d: number) =>
    setHill((x) => {
      const l = x[field]!;
      const j = i + d;
      if (j < 0 || j >= l.length) return;
      [l[i], l[j]] = [l[j], l[i]];
    });
  return (
    <fieldset>
      <legend>{title}</legend>
      {list.map((s, i) => (
        <div class="cfg-section">
          <span>{i + 1}.</span>
          <label>
            <span>{t("ui.cfg.hill.angle", { deg: s.angleDeg })}</span>
            <input type="range" min={r.angleDeg[0]} max={r.angleDeg[1]} value={s.angleDeg} aria-label={t("ui.cfg.hill.angle_label", { n: i + 1 })} onInput={(e) => edit(i, { angleDeg: Number((e.target as HTMLInputElement).value) })} />
          </label>
          <label>
            <span>{t("ui.cfg.hill.length", { m: s.lengthM })}</span>
            <input type="range" min={r.sectionLengthM[0]} max={r.sectionLengthM[1]} value={s.lengthM} aria-label={t("ui.cfg.hill.length_label", { n: i + 1 })} onInput={(e) => edit(i, { lengthM: Number((e.target as HTMLInputElement).value) })} />
          </label>
          <select value={s.surface} aria-label={t("ui.cfg.hill.surface")} onChange={(e) => edit(i, { surface: (e.target as HTMLSelectElement).value as ConfigSurface })}>
            {SURFACES.map((x) => (
              <option value={x}>{t(`surface.${x}`)}</option>
            ))}
          </select>
          <span class="row" style={{ gap: 2 }}>
            <button class="btn small secondary" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("ui.cfg.hill.up")}>
              ↑
            </button>
            <button class="btn small secondary" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={t("ui.cfg.hill.down")}>
              ↓
            </button>
            <button class="btn small danger" disabled={list.length <= 1} onClick={() => setHill((x) => x[field]!.splice(i, 1))} aria-label={t("ui.cfg.hill.remove")}>
              ✕
            </button>
          </span>
        </div>
      ))}
      <button class="btn small" style={{ marginTop: 6 }} onClick={() => setHill((x) => (x[field] = [...(x[field] ?? []), { lengthM: 15, angleDeg: 20, surface: "grass" }]))}>
        + {t("ui.cfg.hill.add_section")}
      </button>
    </fieldset>
  );
}

function TreesAndBases({ total }: { total: number }) {
  const h = hill();
  return (
    <div class="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <fieldset>
        <legend>{t("ui.cfg.hill.trees")}</legend>
        <div class="cfg-list">
          {h.trees.map((tr, i) => (
            <div class="cfg-list-row">
              <span>{tr.id}</span>
              <label>
                s
                <input type="number" min={0} max={total} step={0.5} value={tr.s} onChange={(e) => setHill((x) => (x.trees[i].s = Number((e.target as HTMLInputElement).value)))} />
              </label>
              <select value={tr.size} aria-label={t("ui.cfg.hill.tree_size")} onChange={(e) => setHill((x) => (x.trees[i].size = (e.target as HTMLSelectElement).value as "small" | "large"))}>
                <option value="large">{t("treeSize.large")}</option>
                <option value="small">{t("treeSize.small")}</option>
              </select>
              <select value={tr.kind ?? "conifer"} aria-label={t("ui.cfg.hill.tree_kind")} onChange={(e) => setHill((x) => (x.trees[i].kind = (e.target as HTMLSelectElement).value as "conifer" | "deciduous"))}>
                <option value="conifer">{t("ui.cfg.hill.conifer")}</option>
                <option value="deciduous">{t("ui.cfg.hill.deciduous")}</option>
              </select>
              <button class="btn small danger" aria-label={t("ui.cfg.hill.remove")} onClick={() => setHill((x) => x.trees.splice(i, 1))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button class="btn small" onClick={() => setHill((x) => x.trees.push({ id: newId("t"), s: round1(total / 2), size: "large", kind: "conifer" }))}>
          + {t("ui.cfg.hill.add_tree")}
        </button>
      </fieldset>
      <fieldset>
        <legend>{t("ui.cfg.hill.base_spots")}</legend>
        <div class="cfg-list">
          {h.basePoints.map((bp, i) => (
            <div class="cfg-list-row">
              <span>{bp.id}</span>
              <label>
                s
                <input type="number" min={0} max={total} step={0.5} value={bp.s} onChange={(e) => setHill((x) => (x.basePoints[i].s = Number((e.target as HTMLInputElement).value)))} />
              </label>
              <select value={bp.anchorType} aria-label={t("ui.cfg.hill.anchor_type")} onChange={(e) => setHill((x) => {
                const v = (e.target as HTMLSelectElement).value as AnchorType;
                x.basePoints[i].anchorType = v;
                if (v === "tree" && !x.basePoints[i].treeId) x.basePoints[i].treeId = x.trees[0]?.id;
                if (v !== "tree") delete x.basePoints[i].treeId;
              })}>
                {(["tree", "rock_outcrop", "bolt"] as const).map((a) => (
                  <option value={a}>{t(`anchorType.${a}`)}</option>
                ))}
              </select>
              {bp.anchorType === "tree" && (
                <select value={bp.treeId ?? ""} aria-label={t("ui.cfg.hill.tree_link")} onChange={(e) => setHill((x) => (x.basePoints[i].treeId = (e.target as HTMLSelectElement).value))}>
                  {h.trees.map((tr) => (
                    <option value={tr.id}>
                      {tr.id} ({t(`treeSize.${tr.size}`)})
                    </option>
                  ))}
                </select>
              )}
              <button class="btn small danger" aria-label={t("ui.cfg.hill.remove")} onClick={() => setHill((x) => x.basePoints.splice(i, 1))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button class="btn small" onClick={() => setHill((x) => x.basePoints.push({ id: newId("bp"), s: round1(total / 2), anchorType: "bolt" }))}>
          + {t("ui.cfg.hill.add_base")}
        </button>
        <small class="muted">{t("ui.cfg.hill.auto_tree_spots")}</small>
      </fieldset>
    </div>
  );
}

export function HillEditorScreen() {
  const [mode, setMode] = useState<ClickMode>("none");
  const [season, setSeason] = useState<Season>("summer");
  if (!editingHill.value) {
    go("library", route.value.back);
    return null;
  }
  const h = hill();
  const issues = validateHill(data, h);
  if (!h.name?.trim()) issues.unshift({ level: "error", key: "ui.cfg.lib.err_no_name" });
  const errors = issues.filter((i) => i.level === "error");
  let geo: HillGeometry | null = null;
  try {
    geo = h.sections.length ? buildHillGeometry(h) : null;
  } catch {
    geo = null;
  }
  const all = [...h.sections, ...(h.routeType === "ascent_descent" ? h.descentSections ?? [] : [])];
  const total = all.reduce((s, x) => s + x.lengthM, 0);
  const steepest = all.reduce((m, x) => Math.max(m, x.angleDeg), 0);
  const close = () => {
    editingHill.value = null;
    go("library", route.value.back);
  };
  const saveAndClose = () => {
    if (errors.length || !saveUserHill(h)) return;
    close();
  };

  const setRoute = (rt: RouteType) =>
    setHill((x) => {
      x.routeType = rt;
      if (rt === "ascent_descent") {
        x.descentSections = x.descentSections?.length ? x.descentSections : structuredClone(DEFAULT_DESCENT);
        x.summitZoneM = x.summitZoneM ?? 6;
      } else {
        delete x.descentSections;
        delete x.summitZoneM;
      }
    });

  const onClickS = (s: number) =>
    setHill((x) => {
      if (mode === "tree_large" || mode === "tree_small") x.trees.push({ id: newId("t"), s, size: mode === "tree_large" ? "large" : "small", kind: "conifer" });
      else if (mode === "bp_tree") {
        let tree = x.trees.find((tr) => Math.abs(tr.s - s) <= 1);
        if (!tree) {
          tree = { id: newId("t"), s, size: "large", kind: "conifer" };
          x.trees.push(tree);
        }
        x.basePoints.push({ id: newId("bp"), s: tree.s, anchorType: "tree", treeId: tree.id });
      } else if (mode === "bp_rock_outcrop") x.basePoints.push({ id: newId("bp"), s, anchorType: "rock_outcrop" });
      else if (mode === "bp_bolt") x.basePoints.push({ id: newId("bp"), s, anchorType: "bolt" });
    });

  return (
    <div class="screen">
      <TopBar />
      <div class="screen-body">
        <h1>{t("ui.cfg.lib.editor_title")}</h1>
        <div class="row">
          <label>
            {t("ui.cfg.lib.name")}
            <input type="text" value={h.name ?? ""} maxLength={40} onInput={(e) => setHill((x) => (x.name = (e.target as HTMLInputElement).value))} />
          </label>
          <fieldset class="row" style={{ padding: "4px 10px" }}>
            <legend>{t("ui.cfg.lib.preview_season")}</legend>
            {SEASONS.map((se) => (
              <label>
                <input type="radio" name="pseason" checked={season === se} onChange={() => setSeason(se)} />
                {t(`season.${se}`)}
              </label>
            ))}
          </fieldset>
          <fieldset class="row" style={{ padding: "4px 10px" }}>
            <legend>{t("ui.cfg.hill.route_type")}</legend>
            {ROUTES.map((rt) => (
              <label>
                <input type="radio" name="route" checked={h.routeType === rt} onChange={() => setRoute(rt)} />
                {t(`route.${rt}`)}
              </label>
            ))}
          </fieldset>
        </div>
        <div class="panel col">
          {geo && <Preview geo={geo} season={season} mode={mode} onClickS={onClickS} />}
          <div class="row">
            <span>{t("ui.cfg.hill.click_mode")}</span>
            {(["none", "tree_large", "tree_small", "bp_tree", "bp_rock_outcrop", "bp_bolt"] as const).map((m) => (
              <label>
                <input type="radio" name="clickmode" checked={mode === m} onChange={() => setMode(m)} />
                {t(`ui.cfg.hill.click.${m}`)}
              </label>
            ))}
          </div>
          <div class="cfg-info">
            <span>{t("ui.cfg.hill.total", { m: round1(total) })}</span>
            <span>{t("ui.cfg.hill.gain", { m: geo ? round1(geo.heightGain) : 0 })}</span>
            <span>{t("ui.cfg.hill.steepest", { deg: steepest })}</span>
          </div>
        </div>
        {issues.map((i) => (
          <Msg level={i.level}>{t(i.key, i.params)}</Msg>
        ))}
        <div class="cfg-two">
          <div class="col">
            <SectionList field="sections" title={h.routeType === "ascent_descent" ? t("ui.cfg.hill.ascent_side") : t("ui.cfg.hill.sections")} />
            {h.routeType === "ascent_descent" && (
              <>
                <label>
                  {t("ui.cfg.hill.summit_zone")}
                  <input type="number" min={3} max={20} value={h.summitZoneM ?? 6} onChange={(e) => setHill((x) => (x.summitZoneM = Number((e.target as HTMLInputElement).value)))} />
                </label>
                <SectionList field="descentSections" title={t("ui.cfg.hill.descent_side")} />
              </>
            )}
            <div class="row">
              <label>
                {t("ui.cfg.hill.start_zone")}
                <input type="number" min={3} max={20} value={h.startZoneM} onChange={(e) => setHill((x) => (x.startZoneM = Number((e.target as HTMLInputElement).value)))} />
              </label>
              <label>
                {t("ui.cfg.hill.finish_zone")}
                <input type="number" min={3} max={20} value={h.finishZoneM} onChange={(e) => setHill((x) => (x.finishZoneM = Number((e.target as HTMLInputElement).value)))} />
              </label>
            </div>
          </div>
          <TreesAndBases total={geo?.totalLength ?? total} />
        </div>
        <div class="cfg-nav">
          <button class="btn secondary" onClick={close}>
            {t("ui.cfg.lib.cancel")}
          </button>
          <button class="btn" disabled={errors.length > 0} onClick={saveAndClose}>
            {t("ui.cfg.lib.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
