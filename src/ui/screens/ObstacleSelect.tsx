// Вибір перешкоди (§6.1.2). Only the hill is playable in MVP.
import { t } from "../../i18n/i18n";
import { go } from "../../app/store";
import { TopBar } from "../components/common";
import { FlowNav } from "./cfgShared";

type Kind = "hill" | "rock" | "ravine" | "river";

function Illustration({ kind }: { kind: Kind }) {
  const sky = <rect width="96" height="64" fill="#9fd3fa" />;
  switch (kind) {
    case "hill":
      return (
        <svg viewBox="0 0 96 64" shape-rendering="crispEdges">
          {sky}
          <polygon points="0,64 0,56 20,52 40,40 60,24 76,14 96,12 96,64" fill="#4fa34a" />
          <polygon points="0,64 0,60 20,56 40,44 60,28 76,18 96,16 96,64" fill="#3f8a4f" />
          <polyline points="20,50 40,38 60,22 76,12" fill="none" stroke="#d93636" stroke-width="2" />
          <rect x="18" y="40" width="4" height="12" fill="#5a3a22" />
          <polygon points="14,42 20,26 26,42" fill="#2e6b45" />
          <rect x="74" y="4" width="2" height="10" fill="#5a3a22" />
          <polygon points="76,4 84,7 76,10" fill="#f2a65a" />
        </svg>
      );
    case "rock":
      return (
        <svg viewBox="0 0 96 64" shape-rendering="crispEdges">
          {sky}
          <rect x="36" y="4" width="40" height="60" fill="#6e6e7a" />
          <rect x="44" y="10" width="8" height="10" fill="#9a9aa6" />
          <rect x="58" y="30" width="10" height="8" fill="#9a9aa6" />
          <line x1="56" y1="14" x2="30" y2="62" stroke="#d93636" stroke-width="2" />
          <rect x="0" y="58" width="96" height="6" fill="#3f8a4f" />
        </svg>
      );
    case "ravine":
      return (
        <svg viewBox="0 0 96 64" shape-rendering="crispEdges">
          {sky}
          <polygon points="0,20 34,20 30,64 0,64" fill="#6e6e7a" />
          <polygon points="62,20 96,20 96,64 66,64" fill="#6e6e7a" />
          <rect x="0" y="16" width="34" height="4" fill="#4fa34a" />
          <rect x="62" y="16" width="34" height="4" fill="#4fa34a" />
          <line x1="20" y1="14" x2="76" y2="14" stroke="#d93636" stroke-width="2" />
        </svg>
      );
    case "river":
      return (
        <svg viewBox="0 0 96 64" shape-rendering="crispEdges">
          {sky}
          <rect x="0" y="34" width="96" height="30" fill="#4fa34a" />
          <rect x="0" y="42" width="96" height="14" fill="#3b7dd8" />
          <rect x="10" y="46" width="12" height="2" fill="#e3f4ff" />
          <rect x="50" y="50" width="16" height="2" fill="#e3f4ff" />
          <line x1="8" y1="30" x2="88" y2="30" stroke="#d93636" stroke-width="2" />
          <rect x="6" y="22" width="4" height="14" fill="#5a3a22" />
          <rect x="86" y="22" width="4" height="14" fill="#5a3a22" />
        </svg>
      );
  }
}

export function ObstacleSelect() {
  const kinds: Kind[] = ["hill", "rock", "ravine", "river"];
  return (
    <div class="screen">
      <TopBar back="menu" />
      <div class="screen-body">
        <h1>{t("ui.cfg.obstacle.title")}</h1>
        <div class="cfg-cards">
          {kinds.map((k) => {
            const active = k === "hill";
            return (
              <button class="panel cfg-obstacle" disabled={!active} onClick={() => active && go("hill")} aria-label={t(`ui.cfg.obstacle.${k}`)}>
                <Illustration kind={k} />
                <h2>{t(`ui.cfg.obstacle.${k}`)}</h2>
                <p>{t(`ui.cfg.obstacle.${k}.desc`)}</p>
                {!active && <span class="badge locked">{t("ui.cfg.obstacle.soon")}</span>}
              </button>
            );
          })}
        </div>
        <div class="row">
          <button class="btn secondary" disabled title={t("ui.cfg.obstacle.chain_hint")}>
            + {t("ui.cfg.obstacle.add_chain")}
          </button>
          <small class="muted">{t("ui.cfg.obstacle.chain_hint")}</small>
        </div>
        <FlowNav current="obstacle" />
      </div>
    </div>
  );
}
