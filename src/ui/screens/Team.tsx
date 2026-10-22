// Команда (§8): size and names. No roles (CR-3); looks are random and distinct (CR-4); base weight is a setting (CR-7).
import { t } from "../../i18n/i18n";
import { data, DEFAULT_NAMES, draft, randomFreeRow, SPRITE_ROWS, updateDraft } from "../../app/store";
import { validateTeam } from "../../engine/scenario/validate";
import type { MemberConfig, Scenario } from "../../engine/model/types";
import { Msg, Sprite, TopBar } from "../components/common";
import { FlowNav } from "./cfgShared";

function resize(d: Scenario, n: number): Scenario {
  const team = d.team.slice(0, n);
  const used = new Set(team.map((m) => m.id));
  for (let i = team.length; i < n; i++) {
    let k = 1;
    while (used.has(`m${k}`)) k++;
    const id = `m${k}`;
    used.add(id);
    const names = DEFAULT_NAMES.filter((x) => !team.some((m) => m.name === x));
    team.push({ id, name: names[0] ?? `#${k}`, appearance: { row: randomFreeRow(team.map((m) => m.appearance.row)) } });
  }
  const ids = new Set(team.map((m) => m.id));
  const items = d.items.map((i) => (i.assignedTo && !ids.has(i.assignedTo.memberId) ? { ...i, assignedTo: null } : i));
  return { ...d, team, items };
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function TeamScreen() {
  const d = draft.value;
  const team = d.team;
  const issues = validateTeam(data, team);
  const errors = issues.filter((i) => i.level === "error");
  const r = data.rules.team;

  const edit = (i: number, patch: Partial<MemberConfig>) =>
    updateDraft((x) => {
      x.team[i] = { ...x.team[i], ...patch };
      return x;
    });

  const randomise = () =>
    updateDraft((x) => {
      const rows = shuffle(Array.from({ length: SPRITE_ROWS }, (_, r) => r));
      const names = shuffle(DEFAULT_NAMES);
      x.team = x.team.map((m, i) => ({ ...m, name: names[i % names.length], appearance: { ...m.appearance, row: rows[i % SPRITE_ROWS] } }));
      return x;
    });

  return (
    <div class="screen">
      <TopBar back="season" />
      <div class="screen-body">
        <h1>{t("ui.cfg.team.title")}</h1>
        <div class="row">
          <label>
            {t("ui.cfg.team.size")}
            <select value={team.length} onChange={(e) => updateDraft((x) => resize(x, Number((e.target as HTMLSelectElement).value)))}>
              {Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i).map((n) => (
                <option value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button class="btn secondary" onClick={randomise}>
            🎲 {t("ui.cfg.team.randomise")}
          </button>
          <small class="muted">{t("ui.cfg.team.equal_abilities")}</small>
        </div>
        {issues.map((i) => (
          <Msg level={i.level}>{t(i.key, i.params)}</Msg>
        ))}
        <div class="cfg-team">
          {team.map((m, i) => (
            <div class="panel cfg-member">
              <span class="kbd num" aria-label={t("ui.cfg.team.number", { n: i + 1 })}>
                #{i + 1}
              </span>
              <div class="row">
                <Sprite row={m.appearance.row} scale={3} />
                <div class="col grow">
                  <label class="col" style={{ alignItems: "stretch" }}>
                    {t("ui.cfg.team.name")}
                    <input type="text" value={m.name} maxLength={20} onInput={(e) => edit(i, { name: (e.target as HTMLInputElement).value })} />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
        <FlowNav current="team" nextDisabled={errors.length > 0} />
      </div>
    </div>
  );
}
