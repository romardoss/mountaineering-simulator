// Obstacle library (CR-1): the play flow picks a predefined hill (HillSelect);
// the constructor (ObstacleLibrary) creates, copies and deletes user hills.
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { hillPresets } from "../../data/load";
import { draft, editingHill, go, route, updateDraft } from "../../app/store";
import { deleteUserHill, isPreset, libraryHills, saveUserHill } from "../../app/obstacles";
import { basePointsOf, buildHillGeometry, normaliseSections, type HillGeometry } from "../../engine/geometry/hill";
import type { HillConfig, Season } from "../../engine/model/types";
import { TopBar } from "../components/common";
import { hillTitle } from "../format";
import { FlowNav, newId } from "./cfgShared";
import { Preview } from "./HillEditor";

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

function HillCard({ hill, season, badge, selected, onClick, children }: { hill: HillConfig; season: Season; badge: string; selected?: boolean; onClick?: () => void; children?: ComponentChildren }) {
  let geo: HillGeometry | null = null;
  try {
    geo = buildHillGeometry(hill);
  } catch {
    geo = null;
  }
  const sections = normaliseSections(hill);
  const total = sections.reduce((s, x) => s + x.lengthM, 0);
  const steepest = sections.reduce((m, x) => Math.max(m, x.angleDeg), 0);
  const body = (
    <>
      {geo && <Preview geo={geo} season={season} compact />}
      <h2>{hillTitle(hill)}</h2>
      <span class="row" style={{ gap: 6 }}>
        <span class={`badge ${badge === "preset" ? "" : "locked"}`}>{t(`ui.cfg.lib.badge.${badge}`)}</span>
        <small>{t(`route.${hill.routeType}`)}</small>
      </span>
      <small class="cfg-info">
        <span>{t("ui.cfg.hill.total", { m: round1(total) })}</span>
        <span>{t(hill.type === "ravine" ? "ui.cfg.hill.depth" : "ui.cfg.hill.gain", { m: geo ? round1(geo.heightGain) : 0 })}</span>
        <span>{t("ui.cfg.hill.steepest", { deg: steepest })}</span>
        <span>{t("ui.cfg.lib.base_spots", { count: basePointsOf(hill).length })}</span>
      </small>
    </>
  );
  if (onClick)
    return (
      <button class={`panel cfg-obstacle cfg-hill ${selected ? "sel" : ""}`} aria-pressed={selected} onClick={onClick}>
        {body}
      </button>
    );
  return (
    <div class="panel cfg-obstacle cfg-hill" style={{ cursor: "default" }}>
      {body}
      {children}
    </div>
  );
}

/** Play flow step «Схил» / «Яр»: choose one predefined obstacle of the chosen kind; no editing here. */
export function HillSelect() {
  const d = draft.value;
  const current = d.route.obstacles[0];
  const kind = current?.type ?? "hill";
  const hills = libraryHills(kind);
  // a loaded scenario may carry a hill that is no longer in the library
  const orphan = current && !hills.some((h) => h.id === current.id) ? current : null;
  const pick = (h: HillConfig) => updateDraft((x) => ((x.route.obstacles[0] = structuredClone(h)), x));
  return (
    <div class="screen">
      <TopBar back="obstacle" />
      <div class="screen-body">
        <h1>{t(kind === "ravine" ? "ui.cfg.lib.select_title_ravine" : "ui.cfg.lib.select_title")}</h1>
        <div class="row">
          <small class="muted">{t(kind === "ravine" ? "ui.cfg.lib.select_hint_ravine" : "ui.cfg.lib.select_hint")}</small>
          {/* the constructor makes hills only (CR-52) */}
          {kind === "hill" && (
            <button class="btn small secondary" onClick={() => go("library", "hill")}>
              {t("ui.cfg.lib.open_constructor")}
            </button>
          )}
        </div>
        <div class="cfg-hills">
          {orphan && <HillCard hill={orphan} season={d.season} badge="scenario" selected onClick={() => undefined} />}
          {hills.map((h) => (
            <HillCard hill={h} season={d.season} badge={isPreset(h.id) ? "preset" : "mine"} selected={current?.id === h.id} onClick={() => pick(h)} />
          ))}
        </div>
        <FlowNav current="hill" nextDisabled={!current} />
      </div>
    </div>
  );
}

/** Main menu → «Конструктор перешкод». */
export function ObstacleLibrary() {
  const [, refresh] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const back = route.value.back ?? "menu";
  const hills = libraryHills();
  const edit = (h: HillConfig) => {
    editingHill.value = structuredClone(h);
    go("hill_editor", back);
  };
  const copyOf = (h: HillConfig): HillConfig => {
    const c = structuredClone(h);
    c.id = newId("hill");
    c.name = t("ui.cfg.lib.copy_name", { name: hillTitle(h) });
    delete c.nameKey;
    return c;
  };
  return (
    <div class="screen">
      <TopBar back={back} />
      <div class="screen-body">
        <h1>{t("ui.cfg.lib.title")}</h1>
        <div class="row">
          <small class="muted">{t("ui.cfg.lib.hint")}</small>
          <button class="btn" onClick={() => edit({ ...copyOf(hillPresets[0]), name: t("ui.cfg.lib.new_name") })}>
            + {t("ui.cfg.lib.new")}
          </button>
        </div>
        <div class="cfg-hills">
          {hills.map((h) => {
            const preset = isPreset(h.id);
            return (
              <HillCard hill={h} season="summer" badge={preset ? "preset" : "mine"}>
                <span class="row" style={{ gap: 4 }}>
                  {preset ? (
                    <button class="btn small" onClick={() => edit(copyOf(h))}>
                      {t("ui.cfg.lib.copy_edit")}
                    </button>
                  ) : (
                    <>
                      <button class="btn small" onClick={() => edit(h)}>
                        {t("ui.cfg.lib.edit")}
                      </button>
                      <button class="btn small secondary" onClick={() => (saveUserHill(copyOf(h)), refresh((n) => n + 1))}>
                        {t("ui.cfg.lib.duplicate")}
                      </button>
                      {confirmDelete === h.id ? (
                        <button class="btn small danger" onClick={() => (deleteUserHill(h.id), setConfirmDelete(null))}>
                          {t("ui.cfg.lib.confirm_delete")}
                        </button>
                      ) : (
                        <button class="btn small danger" onClick={() => setConfirmDelete(h.id)}>
                          {t("ui.cfg.lib.delete")}
                        </button>
                      )}
                    </>
                  )}
                </span>
              </HillCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
