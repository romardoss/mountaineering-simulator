// Results (§16): team totals, per-member stats, learning summary, knot reveal, attempts history.
import { t } from "../../i18n/i18n";
import { engine, go, lastResult, session, type ResultRecord } from "../../app/store";
import { editScenario, replaySameScenario, resultsHistory } from "../../app/controller";
import { downloadJson } from "../../app/persistence/storage";
import type { GameState } from "../../engine/model/types";
import { TopBar } from "../components/common";
import { formatDuration, formatKey, knotName, memberName } from "../format";
import "../game.css";

function Kv({ k, v }: { k: string; v: string | number }) {
  return (
    <div class="kv">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

export function ResultsScreen() {
  const s = session.value;
  const rec: ResultRecord | null =
    lastResult.value ??
    (s
      ? { id: "tmp", scenarioId: s.scenario.id, scenarioName: s.scenario.name, finishedAt: Date.now(), outcome: s.state.outcome, stats: engine.getStats(s.state), realTimeMs: s.realTimeMs, mode: s.scenario.mode, season: s.scenario.season }
      : null);
  if (!rec) {
    return (
      <div class="screen">
        <TopBar />
        <div class="screen-body">
          <p>{t("ui.res.none")}</p>
          <button class="btn" onClick={() => go("menu")}>
            {t("ui.main_menu")}
          </button>
        </div>
      </div>
    );
  }
  const st = rec.stats;
  const state: GameState | null = s?.state ?? null;
  const name = (id: string | null) => (id ? memberName(state, id) : t("ui.res.pre_tied"));
  const previous = resultsHistory().filter((r) => r.scenarioId === rec.scenarioId && r.id !== rec.id).slice(0, 4);
  const violations = Object.entries(st.commands.violations);

  return (
    <div class="screen">
      <TopBar />
      <div class="screen-body">
        <div class={`outcome-banner ${rec.outcome}`}>{t(`outcome.${rec.outcome}`)}</div>
        <div class="row">
          <button class="btn" onClick={replaySameScenario} disabled={!s}>
            {t("ui.res.replay")}
          </button>
          <button class="btn secondary" onClick={editScenario}>
            {t("ui.res.edit")}
          </button>
          <button class="btn secondary" onClick={() => go("menu")}>
            {t("ui.main_menu")}
          </button>
          <button class="btn secondary" onClick={() => downloadJson(`results-${rec.id}.json`, rec)}>
            {t("ui.res.export")}
          </button>
        </div>

        <div class="stats-grid">
          <section class="panel">
            <h2>{t("ui.res.totals")}</h2>
            <Kv k={t("ui.res.steps")} v={st.steps} />
            <Kv k={t("ui.res.sim_time")} v={formatDuration(st.simTimeS)} />
            <Kv k={t("ui.res.real_time")} v={formatDuration(rec.realTimeMs / 1000)} />
          </section>
          <section class="panel">
            <h2>{t("ui.res.falls")}</h2>
            <Kv k={t("ui.res.total")} v={st.falls.total} />
            <Kv k={t("ui.res.falls_self")} v={st.falls.selfBelay} />
            <Kv k={t("ui.res.falls_belay")} v={st.falls.belay} />
            <Kv k={t("ui.res.falls_unprotected")} v={st.falls.unprotected} />
            <h3 style={{ marginTop: 8 }}>{t("ui.res.injuries")}</h3>
            {st.injuries.length === 0 ? <p class="muted">{t("ui.res.no_injuries")}</p> : st.injuries.map((i) => <p>{name(i.memberId)}: {formatKey(state, i.causeKey, i.params)}</p>)}
          </section>
          <section class="panel">
            <h2>{t("ui.res.knots")}</h2>
            <Kv k={t("ui.res.total")} v={st.knots.total} />
            {(["correct", "acceptable", "wrong", "dangerous"] as const).map((r) => (
              <Kv k={t(`rating.${r}`)} v={st.knots[r]} />
            ))}
            <Kv k={t("ui.res.missing_control")} v={st.knots.missingControl} />
            <Kv k={t("ui.res.pre_tied")} v={st.knots.preTied} />
          </section>
          <section class="panel">
            <h2>{t("ui.res.commands")}</h2>
            <Kv k={t("ui.res.issued")} v={st.commands.issued} />
            {violations.length === 0 && <p class="muted">{t("ui.res.no_violations")}</p>}
            {violations.map(([id, n]) => (
              <Kv k={`${id}: ${t(`ui.res.rule_name.${id}`)}`} v={n} />
            ))}
          </section>
          <section class="panel">
            <h2>{t("ui.res.rockfall")}</h2>
            <Kv k={t("ui.res.total")} v={st.rockfall.total} />
            <Kv k={t("ui.res.warned")} v={st.rockfall.warned} />
            <Kv k={t("ui.res.hits")} v={st.rockfall.hits} />
          </section>
          <section class="panel">
            <h2>{t("ui.res.items_left")}</h2>
            {st.itemsLeft.length === 0 ? <p class="muted">{t("ui.res.nothing_left")}</p> : st.itemsLeft.map((i) => <p>{t(`item.${i.type}`)} — {t("ui.m", { m: i.s })}</p>)}
          </section>
        </div>

        <section class="panel">
          <h2>{t("ui.res.per_member")}</h2>
          <table>
            <thead>
              <tr>
                <th>{t("ui.res.member")}</th>
                <th>{t("ui.res.active")}</th>
                <th>{t("ui.res.skipped")}</th>
                <th>{t("ui.res.forced")}</th>
                <th>{t("ui.res.up")}</th>
                <th>{t("ui.res.down")}</th>
                <th>{t("ui.res.falls")}</th>
                <th>{t("ui.res.knots")}</th>
                <th>{t("ui.res.commands")}</th>
                <th>{t("ui.res.max_weight")}</th>
                <th>{t("ui.res.overloaded")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(st.members).map(([id, m]) => (
                <tr>
                  <td>{name(id)}</td>
                  <td>{m.activeSteps}</td>
                  <td>{m.skippedSteps}</td>
                  <td>{m.forcedSkips}</td>
                  <td>{t("ui.m", { m: Math.round(m.distanceUpM * 10) / 10 })}</td>
                  <td>{t("ui.m", { m: Math.round(m.distanceDownM * 10) / 10 })}</td>
                  <td>{m.falls}</td>
                  <td>
                    {m.knots.correct}/{m.knots.acceptable}/{m.knots.wrong}/{m.knots.dangerous}
                  </td>
                  <td>{m.commands}</td>
                  <td>{t("ui.kg", { kg: m.maxWeightKg })}</td>
                  <td>{m.overloadedSteps}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="muted">{t("ui.res.knots_legend")}</p>
        </section>

        <section class="panel">
          <h2>{t("ui.res.learning")}</h2>
          {st.mistakes.length === 0 && <p class="muted">{t("ui.res.no_mistakes")}</p>}
          {st.mistakes.map((m) => (
            <div class="msg warning">
              <b>{t("ui.game.step_n", { n: m.step })}:</b> {formatKey(state, m.key, m.params)}{" "}
              {m.ref?.startsWith("knot:") && (
                <button class="btn-ghost" onClick={() => go("knots", "results")}>
                  {t("ui.res.see_knots")}
                </button>
              )}
              {m.ref?.startsWith("rule:") && (
                <button class="btn-ghost" onClick={() => go("glossary", "results")}>
                  {t("ui.res.see_glossary")}
                </button>
              )}
            </div>
          ))}
        </section>

        <section class="panel">
          <h2>{rec.mode === "exam" ? t("ui.res.knots_revealed") : t("ui.res.knot_list")}</h2>
          {st.knotHistory.length === 0 && <p class="muted">{t("ui.res.no_knots")}</p>}
          <table>
            <tbody>
              {st.knotHistory.map((k) => (
                <tr>
                  <td>{k.step}</td>
                  <td>{name(k.tiedBy)}</td>
                  <td>{knotName(k.knotId)}</td>
                  <td>{t(`context.${k.context.toLowerCase()}`)}</td>
                  <td>
                    <span class={`badge ${k.rating}`}>{t(`rating.${k.rating}`)}</span>
                  </td>
                  <td class="muted">{k.messages.slice(1).map((x) => formatKey(state, x, { knot: k.knotId, context: k.context })).join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {previous.length > 0 && (
          <section class="panel">
            <h2>{t("ui.res.previous")}</h2>
            <table>
              <thead>
                <tr>
                  <th>{t("ui.res.date")}</th>
                  <th>{t("ui.res.outcome")}</th>
                  <th>{t("ui.res.steps")}</th>
                  <th>{t("ui.res.sim_time")}</th>
                  <th>{t("ui.res.falls")}</th>
                  <th>{t("ui.res.knots_bad")}</th>
                  <th>{t("ui.res.violations")}</th>
                </tr>
              </thead>
              <tbody>
                {[rec, ...previous].map((r) => (
                  <tr>
                    <td>{new Date(r.finishedAt).toLocaleString()}</td>
                    <td>{t(`outcome.${r.outcome}`)}</td>
                    <td>{r.stats.steps}</td>
                    <td>{formatDuration(r.stats.simTimeS)}</td>
                    <td>{r.stats.falls.total}</td>
                    <td>{r.stats.knots.wrong + r.stats.knots.dangerous}</td>
                    <td>{Object.values(r.stats.commands.violations).reduce((a, b) => a + b, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
