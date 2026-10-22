// Shout a command (§11.7, §12). Commands are always shown in Ukrainian.
import { useState } from "preact/hooks";
import { locale, t, tl } from "../../i18n/i18n";
import { data, session } from "../../app/store";
import { settings } from "../../app/settings";
import type { ActionParams, CommandKey } from "../../engine/model/types";
import { belaysAsBelayer } from "../../engine/model/selectors";
import { Modal } from "../components/common";
import "../game.css";

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function CommandDialog({ memberId, onConfirm, onCancel }: { memberId: string; onConfirm: (p: ActionParams) => void; onCancel: () => void }) {
  const s = session.value!;
  const [command, setCommand] = useState<CommandKey | null>(null);
  const [recipient, setRecipient] = useState<string>("all");
  const [phrase, setPhrase] = useState<string | null>(null);
  const practice = settings.value.phraseChoice;
  const def = command ? data.commands.find((c) => c.key === command)! : null;
  // «Страховка готова!» only once this member's belay exists — never while it is being set up (CR-34)
  const available = data.commands.filter((c) => c.key !== "belay_ready" || belaysAsBelayer(s.state, memberId).length > 0);
  const memberIdx = s.scenario.team.findIndex((m) => m.id === memberId);
  const phrases = def ? shuffle([def.textKey, ...def.wrongKeys], s.state.step * 31 + memberIdx * 7 + data.commands.indexOf(def)) : [];

  const confirm = () => {
    if (!command) return;
    const misunderstood = practice && phrase !== null && phrase !== def!.textKey;
    onConfirm({ kind: "command", command, recipient, ...(misunderstood ? { misunderstood: true } : {}) });
  };

  return (
    <Modal title={t("ui.game.command_title")} onClose={onCancel} wide>
      <div class="cmd-list">
        {available.map((c) => (
          <button class="cmd-btn" aria-pressed={command === c.key} onClick={() => { setCommand(c.key); setPhrase(null); }}>
            {practice ? t(c.hintKey) : `«${tl("uk", c.textKey)}»`}
            <small>{practice ? "" : locale.value === "en" ? tl("en", c.textKey) : t(c.hintKey)}</small>
          </button>
        ))}
      </div>
      {practice && def && (
        <fieldset style={{ marginTop: 10 }}>
          <legend>{t("ui.game.choose_phrase")}</legend>
          {phrases.map((k) => (
            <label style={{ display: "flex" }}>
              <input type="radio" name="phrase" checked={phrase === k} onChange={() => setPhrase(k)} />«{tl("uk", k)}»
            </label>
          ))}
        </fieldset>
      )}
      <div class="row" style={{ marginTop: 10 }}>
        <label>
          {t("ui.game.recipient")}
          <select value={recipient} onChange={(e) => setRecipient((e.target as HTMLSelectElement).value)}>
            <option value="all">{t("ui.everyone")}</option>
            {s.scenario.team
              .filter((m) => m.id !== memberId)
              .map((m) => (
                <option value={m.id}>{m.name}</option>
              ))}
          </select>
        </label>
        <span class="spacer" />
        <button class="btn secondary" onClick={onCancel}>
          {t("ui.cancel")}
        </button>
        <button class="btn" disabled={!command || (practice && !phrase)} onClick={confirm}>
          {t("ui.game.shout")}
        </button>
      </div>
    </Modal>
  );
}
