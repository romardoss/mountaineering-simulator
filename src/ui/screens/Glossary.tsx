// Словник (§4): terms in Ukrainian with English hint and meaning; command list.
import { t, tl } from "../../i18n/i18n";
import { data, go, route } from "../../app/store";
import { TopBar } from "../components/common";
import "../game.css";

export function GlossaryScreen() {
  const back = route.value.back ?? "menu";
  return (
    <div class="screen">
      <TopBar back={back} />
      <div class="screen-body">
        <h1>{t("ui.ref.glossary_title")}</h1>
        <section class="panel">
          <table>
            <thead>
              <tr>
                <th>{t("ui.ref.uk")}</th>
                <th>{t("ui.ref.en")}</th>
                <th>{t("ui.ref.meaning")}</th>
              </tr>
            </thead>
            <tbody>
              {data.glossary.map((k) => (
                <tr>
                  <td>
                    <b>{tl("uk", k)}</b>
                  </td>
                  <td>{tl("en", k)}</td>
                  <td>{t(`${k}.meaning`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section class="panel">
          <h2>{t("ui.ref.commands_title")}</h2>
          <table>
            <thead>
              <tr>
                <th>{t("ui.ref.uk")}</th>
                <th>{t("ui.ref.en")}</th>
                <th>{t("ui.ref.when")}</th>
              </tr>
            </thead>
            <tbody>
              {data.commands.map((c) => (
                <tr>
                  <td>
                    <b>«{tl("uk", c.textKey)}»</b>
                  </td>
                  <td>{tl("en", c.textKey)}</td>
                  <td>{t(c.hintKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div>
          <button class="btn secondary" onClick={() => go(back)}>
            ← {t("ui.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
