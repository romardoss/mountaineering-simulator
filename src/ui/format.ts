// Turns engine events / hints (i18n keys + raw params) into localized text.
// The engine never formats text (ARCHITECTURE §4.10); ids are resolved here.
import { t, tl, type Locale } from "../i18n/i18n";
import type { GameEvent, GameState, HillConfig } from "../engine/model/types";

/** Display name of a hill (presets have a nameKey, user hills a name). */
export function hillTitle(hill: HillConfig | undefined): string {
  if (!hill) return t("ui.cfg.hill.custom");
  return hill.nameKey ? t(hill.nameKey) : hill.name || t("ui.cfg.hill.custom");
}

const MEMBER_PARAMS = ["member", "climber", "belayer", "to"];

export function memberName(state: GameState | null, id: unknown): string {
  if (typeof id !== "string") return String(id ?? "");
  return state?.members[id]?.name ?? id;
}

export function knotName(id: string, loc?: Locale): string {
  return loc ? tl(loc, `knot.${id}.name`) : t(`knot.${id}.name`);
}

/** Maps raw ids in params to readable, localized strings. */
export function localizeParams(state: GameState | null, params: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = { ...params };
  for (const k of MEMBER_PARAMS) if (k in out) out[k] = memberName(state, out[k]);
  if (typeof out.knot === "string") out.knot = knotName(out.knot);
  if (typeof out.command === "string") out.command = tl("uk", `cmd.${out.command}`);
  if (typeof out.reason === "string") out.reason = t(out.reason);
  if (typeof out.rating === "string") out.rating = t(`rating.${out.rating}`);
  if (typeof out.item === "string") out.item = t(`item.${out.item}`);
  if (typeof out.element === "string") out.element = t(out.element);
  if (typeof out.cause === "string") out.cause = t(out.cause);
  if (typeof out.context === "string") out.context = t(`context.${String(out.context).toLowerCase()}`);
  if (typeof out.action === "string") out.action = t(`actionkind.${out.action}`);
  if (typeof out.anchor === "string") out.anchor = t(`anchor.${out.anchor}`);
  if (typeof out.quality === "string") out.quality = t(`tension.${out.quality}`);
  if (out.recipient === "all") out.recipient = t("ui.everyone");
  else if (typeof out.recipient === "string") out.recipient = memberName(state, out.recipient);
  if (typeof out.target === "string" && (out.target === "segment" || out.target === "base")) out.target = t(`target.${out.target}`);
  // fall-chance factors "factor.x=1.3"
  const factors = Object.keys(out).filter((k) => /^f\d+$/.test(k));
  if (factors.length) {
    out.factors = factors
      .map((k) => {
        const [key, v] = String(out[k]).split("=");
        return `${t(key)} ×${v}`;
      })
      .join(", ");
  }
  return out;
}

export function formatEvent(state: GameState | null, e: Pick<GameEvent, "messageKey" | "params">): string {
  return t(e.messageKey, localizeParams(state, e.params));
}

export function formatKey(state: GameState | null, key: string, params?: Record<string, unknown>): string {
  return t(key, localizeParams(state, params));
}

export function formatDuration(totalS: number): string {
  const s = Math.round(totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
}
