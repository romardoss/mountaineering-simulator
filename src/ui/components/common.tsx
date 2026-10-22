// Pixel-styled UI primitives shared by all screens.
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { locale, t, tl } from "../../i18n/i18n";
import { bilingualHints, updateSettings } from "../../app/settings";
import { go, type RouteName } from "../../app/store";
import { assetUrl, manifest, ROW_COLORS } from "../../game/assets";
import { weightBand } from "../../engine/model/selectors";
import { data } from "../../app/store";

export function LangToggle() {
  const cur = locale.value;
  return (
    <span class="lang-toggle" role="group" aria-label={t("ui.language")}>
      {(["uk", "en"] as const).map((l) => (
        <button aria-pressed={cur === l} onClick={() => updateSettings({ locale: l })}>
          {l === "uk" ? "UA" : "EN"}
        </button>
      ))}
    </span>
  );
}

export function TopBar({ children, back }: { children?: ComponentChildren; back?: RouteName }) {
  return (
    <header class="topbar">
      <span class="brand" onClick={() => go("menu")} title={t("ui.main_menu")}>
        {t("ui.title")}
      </span>
      {back && (
        <button class="btn small secondary" onClick={() => go(back)}>
          ← {t("ui.back")}
        </button>
      )}
      <span class="spacer" />
      {children}
      <LangToggle />
    </header>
  );
}

/** Domain term with bilingual hint (§19.3): EN shows "Fixed rope (перила)", UK shows the English on hover. */
export function Term({ k, cap }: { k: string; cap?: boolean }) {
  const loc = locale.value;
  const main = t(k);
  const text = cap ? main.charAt(0).toUpperCase() + main.slice(1) : main;
  if (loc === "en") {
    return bilingualHints() ? (
      <span class="term" title={tl("uk", k)}>
        {text} <span class="term-uk">({tl("uk", k)})</span>
      </span>
    ) : (
      <span class="term" title={tl("uk", k)}>{text}</span>
    );
  }
  return (
    <span class="term" title={tl("en", k)}>
      {text}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: ComponentChildren; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []).filter((x) => !x.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el?.addEventListener("keydown", onKey);
    return () => {
      el?.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <div class="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal panel" role="dialog" aria-modal="true" ref={ref} style={wide ? { width: "min(1100px, 96vw)" } : undefined}>
        <div class="modal-head">
          <h2>{title}</h2>
          <button class="btn small secondary" onClick={onClose} aria-label={t("ui.close")}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function WeightBar({ baseKg, gearKg }: { baseKg: number; gearKg: number }) {
  const max = data.rules.weight.maxKg;
  const total = baseKg + gearKg;
  const band = weightBand(data, total);
  const pct = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  return (
    <span class="weight" title={t("ui.weight_tooltip", { base: baseKg.toFixed(1), gear: gearKg.toFixed(1), max })}>
      <span class="weight-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={total}>
        <span class={`gear ${band}`} style={{ width: pct(total) }} />
        <span class="base" style={{ width: pct(baseKg) }} />
        <span class="tick" style={{ left: pct(data.rules.weight.comfortKg) }} />
        <span class="tick" style={{ left: pct(data.rules.weight.heavyKg) }} />
      </span>
      <span>{t("ui.kg", { kg: total.toFixed(1) })}</span>
    </span>
  );
}

/** One frame of a team sheet (portrait), scaled with nearest-neighbour. */
export function Sprite({ row, sheet = "team_shout", frame = 0, scale = 2 }: { row: number; sheet?: string; frame?: number; scale?: number }) {
  const url = assetUrl(sheet);
  const e = manifest[sheet];
  if (!url || !e?.frameWidth) {
    const c = ROW_COLORS[row % 7];
    return <span class="sprite" style={{ width: 16 * scale, height: 32 * scale, background: c.jacket, border: "2px solid #1a1c2c" }} />;
  }
  const fw = e.frameWidth;
  const fh = e.frameHeight ?? fw;
  return (
    <span
      class="sprite"
      aria-hidden="true"
      style={{
        width: fw * scale,
        height: fh * scale,
        backgroundImage: `url(${url})`,
        backgroundSize: `${e.width * scale}px ${e.height * scale}px`,
        backgroundPosition: `-${frame * fw * scale}px -${(row % 7) * fh * scale}px`,
      }}
    />
  );
}

export function Msg({ level, children }: { level: "error" | "warning" | "hint" | "info" | "ok" | "danger"; children: ComponentChildren }) {
  return <div class={`msg ${level}`}>{children}</div>;
}

export function ScreenTitle({ children }: { children: ComponentChildren }) {
  return <h1>{children}</h1>;
}
