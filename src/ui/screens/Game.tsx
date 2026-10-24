// Game screen (§18.4): hill view, journal, member cards, step controls.
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { animating, baseConfirm, commandDialogFor, engine, go, ropePickerFor, selectedMember, session } from "../../app/store";
import { executeStep, finishLevel, giveUp, planList, setPlannedAction } from "../../app/controller";
import { crossingsOf, tensionQuality } from "../../engine/model/selectors";
import { mountHillView } from "../../game";
import { TopBar } from "../components/common";
import { Journal } from "../panels/Journal";
import { MemberCards } from "../panels/MemberCards";
import { ActionPicker } from "../dialogs/ActionPicker";
import { CommandDialog } from "../dialogs/CommandDialog";
import { Modal } from "../components/common";
import { formatDuration } from "../format";
import "../game.css";

export function GameScreen() {
  const s = session.value;
  const viewRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  useEffect(() => {
    if (!s) go("menu");
  }, [s]);

  useEffect(() => {
    if (!viewRef.current) return;
    return mountHillView(viewRef.current);
  }, []);

  useEffect(() => {
    if (s && s.state.outcome !== "in_progress" && !animating.value) go("results");
  }, [s?.state.outcome, animating.value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picker || confirmGiveUp || commandDialogFor.value || ropePickerFor.value || baseConfirm.value) return;
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const cur = session.value;
      if (!cur) return;
      if (e.key === "Enter" && !(target?.getAttribute("role") === "button")) {
        e.preventDefault();
        executeStep();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const m = cur.scenario.team[Number(e.key) - 1];
        if (m) {
          selectedMember.value = m.id;
          e.preventDefault();
        }
      }
      if ((e.key === "a" || e.key === "ф") && selectedMember.value) {
        e.preventDefault();
        setPicker(selectedMember.value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picker, confirmGiveUp]);

  if (!s) return null;
  const hill = s.scenario.route.obstacles[0];
  const v = engine.validatePlan(s.state, planList(s));
  const plannedS = Math.max(engine.data.rules.minStepSeconds, ...Object.values(v.members).map((m) => m.durationS), 0);
  const over = s.state.outcome !== "in_progress";
  const canFinish = engine.canFinishLevel(s.state);
  const crossings = Object.values(crossingsOf(s.state));

  return (
    <div class="game-screen">
      <TopBar>
        <span class="chip">{hill.nameKey ? t(hill.nameKey) : hill.name || t("ui.game.hill")}</span>
        <span class="chip">{t(`season.${s.scenario.season}`)}</span>
        <span class="chip" title={t("ui.game.weather")}>{t(`weather.${s.state.weather ?? "dry"}`)}</span>
        <span class="chip">{t(`mode.${s.scenario.mode}`)}</span>
        {crossings.map((c) => (
          <span class="chip" title={t("ui.game.perila_hint")}>
            {t("ui.game.perila", { ratio: c.ratio ?? 3, tension: c.tension, quality: t(`tension.${tensionQuality(engine.data, c)}`), secured: c.secured ? "yes" : "no" })}
          </span>
        ))}
        <button class="btn small secondary" onClick={() => go("glossary", "game")}>
          {t("ui.game.glossary")}
        </button>
        <button class="btn small secondary" onClick={() => go("knots", "game")}>
          {t("ui.game.knots")}
        </button>
        <button class="btn small danger" disabled={over} onClick={() => setConfirmGiveUp(true)}>
          {t("ui.game.give_up")}
        </button>
      </TopBar>
      <div class="game-view" ref={viewRef} aria-label={t("ui.game.view_label")} />
      <Journal />
      <div class="member-cards">
        <MemberCards onOpen={(id) => setPicker(id)} />
        <div class="step-controls">
          <div class="step-info">
            {t("ui.game.step_n", { n: s.state.step + 1 })}
            <br />
            {t("ui.game.sim_time", { time: formatDuration(s.state.simTimeS) })}
            <br />
            {t("ui.game.step_duration", { s: plannedS })}
          </div>
          <button class="btn big" disabled={animating.value || over} onClick={() => executeStep()}>
            {t("ui.game.execute")} <span class="kbd">Enter</span>
          </button>
          {canFinish && (
            <button class="btn" disabled={animating.value} title={t("ui.game.finish_level_hint")} onClick={() => finishLevel()}>
              {t("ui.game.finish_level")}
            </button>
          )}
          <span class="step-info">{t("ui.game.keys_help")}</span>
          <span class="step-info">{t("ui.game.right_click_hint")}</span>
        </div>
      </div>
      {picker && <ActionPicker memberId={picker} onClose={() => setPicker(null)} />}
      {ropePickerFor.value && <ActionPicker memberId={ropePickerFor.value} ropeOnly onClose={() => (ropePickerFor.value = null)} />}
      {commandDialogFor.value && (
        <CommandDialog
          memberId={commandDialogFor.value}
          onConfirm={(p) => {
            setPlannedAction(commandDialogFor.value!, p);
            commandDialogFor.value = null;
          }}
          onCancel={() => (commandDialogFor.value = null)}
        />
      )}
      {baseConfirm.value && <DirectBaseWarning />}
      {confirmGiveUp && (
        <Modal title={t("ui.game.give_up")} onClose={() => setConfirmGiveUp(false)}>
          <p>{t("ui.game.give_up_confirm")}</p>
          <div class="row" style={{ justifyContent: "flex-end" }}>
            <button class="btn secondary" onClick={() => setConfirmGiveUp(false)}>
              {t("ui.cancel")}
            </button>
            <button
              class="btn danger"
              onClick={() => {
                setConfirmGiveUp(false);
                giveUp();
                go("results");
              }}
            >
              {t("ui.game.give_up")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** CR-39: no sling or locking carabiner → confirm a base tied directly to the support. */
function DirectBaseWarning() {
  const c = baseConfirm.value!;
  const close = () => (baseConfirm.value = null);
  return (
    <Modal title={t("ui.game.base_direct_title")} onClose={close}>
      <p>{t("ui.game.base_direct_warning", { missing: c.missing.map((x) => t(`ui.game.missing.${x}`)).join(", ") })}</p>
      <div class="row" style={{ justifyContent: "flex-end" }}>
        <button class="btn secondary" onClick={close}>
          {t("ui.cancel")}
        </button>
        <button
          class="btn"
          onClick={() => {
            setPlannedAction(c.memberId, c.params);
            close();
          }}
        >
          {t("ui.game.base_direct_confirm")}
        </button>
      </div>
    </Modal>
  );
}
