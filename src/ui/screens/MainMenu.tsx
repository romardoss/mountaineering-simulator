// Головне меню (§6.1.1).
import "../config.css";
import { t } from "../../i18n/i18n";
import { assetUrl } from "../../game/assets";
import { draft, defaultScenario, go } from "../../app/store";
import { continueGame, hasSavedGame } from "../../app/controller";
import { LangToggle } from "../components/common";

export function MainMenu() {
  const art = assetUrl("art_key_art");
  const saved = hasSavedGame();
  const newGame = () => {
    draft.value = defaultScenario();
    go("obstacle");
  };
  return (
    <div class="menu-screen">
      <div class="menu-art" style={art ? { backgroundImage: `url(${art})` } : { background: "linear-gradient(#3b7dd8,#9fd3fa)" }} />
      <div style={{ position: "absolute", top: 12, right: 16 }}>
        <LangToggle />
      </div>
      <nav class="menu-content panel" aria-label={t("ui.main_menu")}>
        <h1 class="game-title">{t("ui.title")}</h1>
        <p class="muted">{t("ui.cfg.menu.subtitle")}</p>
        <button class="btn big" onClick={newGame}>
          {t("ui.cfg.menu.new")}
        </button>
        {saved && (
          <button class="btn big secondary" onClick={() => continueGame()}>
            {t("ui.cfg.menu.continue")}
          </button>
        )}
        <button class="btn secondary" onClick={() => go("library", "menu")}>
          {t("ui.cfg.menu.constructor")}
        </button>
        <button class="btn secondary" onClick={() => go("scenarios", "menu")}>
          {t("ui.cfg.menu.scenarios")}
        </button>
        <button class="btn secondary" onClick={() => go("glossary", "menu")}>
          {t("ui.cfg.menu.glossary")}
        </button>
        <button class="btn secondary" onClick={() => go("knots", "menu")}>
          {t("ui.cfg.menu.knots")}
        </button>
        <button class="btn secondary" onClick={() => go("settings", "menu")}>
          {t("ui.cfg.menu.settings")}
        </button>
      </nav>
    </div>
  );
}
