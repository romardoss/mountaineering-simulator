// Screen router (§6.1). Every screen renders its own TopBar (UA/EN toggle always visible).
import { route } from "../app/store";
import { MainMenu } from "./screens/MainMenu";
import { ObstacleSelect } from "./screens/ObstacleSelect";
import { HillEditorScreen } from "./screens/HillEditor";
import { HillSelect, ObstacleLibrary } from "./screens/HillLibrary";
import { SeasonMode } from "./screens/SeasonMode";
import { TeamScreen } from "./screens/Team";
import { EquipmentScreen } from "./screens/Equipment";
import { Readiness } from "./screens/Readiness";
import { GameScreen } from "./screens/Game";
import { ResultsScreen } from "./screens/Results";
import { GlossaryScreen } from "./screens/Glossary";
import { KnotReference } from "./screens/KnotReference";
import { SettingsScreen } from "./screens/Settings";
import { ScenariosScreen } from "./screens/Scenarios";
import { locale } from "../i18n/i18n";

export function App() {
  void locale.value; // re-render everything on language switch (§19.2)
  switch (route.value.name) {
    case "menu":
      return <MainMenu />;
    case "obstacle":
      return <ObstacleSelect />;
    case "hill":
      return <HillSelect />;
    case "season":
      return <SeasonMode />;
    case "team":
      return <TeamScreen />;
    case "equipment":
      return <EquipmentScreen />;
    case "readiness":
      return <Readiness />;
    case "game":
      return <GameScreen />;
    case "results":
      return <ResultsScreen />;
    case "glossary":
      return <GlossaryScreen />;
    case "knots":
      return <KnotReference />;
    case "settings":
      return <SettingsScreen />;
    case "scenarios":
      return <ScenariosScreen />;
    case "library":
      return <ObstacleLibrary />;
    case "hill_editor":
      return <HillEditorScreen />;
  }
}
