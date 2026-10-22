// Shared bits for the configuration flow (fork A).
import "../config.css";
import { t } from "../../i18n/i18n";
import { go, type RouteName } from "../../app/store";

const FLOW: RouteName[] = ["obstacle", "hill", "season", "team", "equipment", "readiness"];

export function FlowSteps({ current }: { current: RouteName }) {
  return (
    <div class="cfg-steps" aria-label={t("ui.cfg.flow")}>
      {FLOW.map((r, i) => (
        <span class={r === current ? "on" : ""}>
          {i + 1}. {t(`ui.cfg.step.${r}`)}
        </span>
      ))}
    </div>
  );
}

export function FlowNav({ current, nextDisabled, onNext, nextLabel }: { current: RouteName; nextDisabled?: boolean; onNext?: () => void; nextLabel?: string }) {
  const i = FLOW.indexOf(current);
  const prev: RouteName = i <= 0 ? "menu" : FLOW[i - 1];
  const next = FLOW[i + 1];
  return (
    // step list on the left, «Назад» and «Далі» together on the right (CR-46)
    <div class="cfg-nav">
      <FlowSteps current={current} />
      <span class="cfg-nav-buttons">
        <button class="btn secondary" onClick={() => go(prev)}>
          ← {t("ui.back")}
        </button>
        {(next || onNext) && (
          <button class="btn" disabled={nextDisabled} onClick={() => (onNext ? onNext() : go(next))}>
            {nextLabel ?? t("ui.next")} →
          </button>
        )}
      </span>
    </div>
  );
}

export const SURFACE_COLORS: Record<string, string> = {
  grass: "#4fa34a",
  ground: "#8c6440",
  rock: "#9a9aa6",
  scree: "#6e6e7a",
  snow: "#f2f7ff",
  icy_rock: "#b5c3e3",
  snow_scree: "#c8d4ea",
  mud: "#6b4a30",
  wet_rock: "#7f8aa0",
};

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/** Preview colours per season (CR-11): sky, flat zones, trees; autumn tints grass. */
export const SEASON_PREVIEW: Record<(typeof SEASONS)[number], { sky: string; zone: string; tree: string; grass?: string }> = {
  spring: { sky: "#bfe2fb", zone: "#8fd06a", tree: "#4f9a4a" },
  summer: { sky: "#9fd3fa", zone: "#77c25a", tree: "#2e6b45" },
  autumn: { sky: "#e8dcc0", zone: "#c8a24a", tree: "#d9782a", grass: "#b89a3a" },
  winter: { sky: "#dfe9f5", zone: "#f2f7ff", tree: "#cfe0d4" },
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
