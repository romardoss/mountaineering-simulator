// Налаштування (§6.1.1). The only place where weights are set (CR-7).
import { t } from "../../i18n/i18n";
import { go, route } from "../../app/store";
import { DEFAULT_WEIGHTS, settings, updateSettings, type Settings } from "../../app/settings";
import type { EquipmentWeights } from "../../engine/data/types";
import { TopBar } from "../components/common";
import "../game.css";

function Radio<T extends string | number | boolean | null>({ name, value, options, onChange }: { name: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="row">
      {options.map((o) => (
        <label>
          <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

type NumKey = { [K in keyof EquipmentWeights]: EquipmentWeights[K] extends number ? K : never }[keyof EquipmentWeights];
type SubKey = Exclude<keyof EquipmentWeights, NumKey>;

function Kg({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label class="set-weight">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number((e.target as HTMLInputElement).value) || min)))} />
    </label>
  );
}

function Weights() {
  const w = settings.value.weights;
  const set = (k: NumKey, v: number) => updateSettings({ weights: { ...w, [k]: v } });
  const setSub = <K extends SubKey>(k: K, sub: keyof EquipmentWeights[K], v: number) => updateSettings({ weights: { ...w, [k]: { ...w[k], [sub]: v } } });
  const item = (k: NumKey, type: string) => <Kg label={t("ui.set.kg_item", { item: t(`item.${type}`) })} value={w[k]} min={0} max={5} step={0.01} onChange={(v) => set(k, v)} />;
  const variant = <K extends SubKey>(k: K, sub: keyof EquipmentWeights[K], type: string, v: string) => (
    <Kg label={t("ui.set.kg_variant", { item: t(`item.${type}`), variant: v })} value={w[k][sub] as number} min={0} max={5} step={0.01} onChange={(x) => setSub(k, sub, x)} />
  );
  return (
    <fieldset>
      <legend>{t("ui.set.weights")}</legend>
      <small>{t("ui.set.weights_help")}</small>
      <div class="set-weights">
        <Kg label={t("ui.set.backpack")} value={w.backpackBaseKg} min={10} max={25} step={0.5} onChange={(v) => set("backpackBaseKg", v)} />
        <Kg label={t("ui.set.rope_per_m", { item: t("item.rope") })} value={w.ropePerMeterKg} min={0.01} max={0.2} step={0.005} onChange={(v) => set("ropePerMeterKg", v)} />
        <Kg label={t("ui.set.per_m", { item: t("item.cord") })} value={w.cordPerMeterKg} min={0.01} max={0.2} step={0.005} onChange={(v) => set("cordPerMeterKg", v)} />
        {(["60", "120", "240"] as const).map((cm) => variant("slingKg", cm, "sling", t("ui.cfg.eq.cm", { cm })))}
        {variant("carabinerKg", "locking", "carabiner", t("ui.cfg.eq.locking_short"))}
        {variant("carabinerKg", "nonLocking", "carabiner", t("ui.cfg.eq.nonlocking_short"))}
        {variant("belayDeviceKg", "atc", "belay_device", "ATC")}
        {variant("belayDeviceKg", "figure8", "belay_device", t("ui.cfg.eq.figure8"))}
        {item("harnessKg", "harness")}
        {item("helmetKg", "helmet")}
        {item("lanyardKg", "lanyard")}
        {item("glovesKg", "gloves")}
        {item("cramponsKg", "crampons")}
        {item("iceAxeKg", "ice_axe")}
        {item("ascenderKg", "ascender")}
      </div>
      <button class="btn small secondary" onClick={() => updateSettings({ weights: structuredClone(DEFAULT_WEIGHTS) })}>
        {t("ui.set.weights_reset")}
      </button>
    </fieldset>
  );
}

export function SettingsScreen() {
  const s = settings.value;
  const back = route.value.back ?? "menu";
  return (
    <div class="screen">
      <TopBar back={back} />
      <div class="screen-body" style={{ maxWidth: 800 }}>
        <h1>{t("ui.set.title")}</h1>
        <section class="panel col">
          <fieldset>
            <legend>{t("ui.language")}</legend>
            <Radio name="lang" value={s.locale} options={[{ v: "uk", label: "Українська" }, { v: "en", label: "English" }]} onChange={(v) => updateSettings({ locale: v as Settings["locale"] })} />
          </fieldset>
          <fieldset>
            <legend>{t("ui.set.term_hints")}</legend>
            <Radio name="hints" value={s.termHints} options={[{ v: null, label: t("ui.set.auto") }, { v: true, label: t("ui.set.on") }, { v: false, label: t("ui.set.off") }]} onChange={(v) => updateSettings({ termHints: v })} />
            <small>{t("ui.set.term_hints_help")}</small>
          </fieldset>
          <fieldset>
            <legend>{t("ui.set.phrase_choice")}</legend>
            <label>
              <input type="checkbox" checked={s.phraseChoice} onChange={(e) => updateSettings({ phraseChoice: (e.target as HTMLInputElement).checked })} />
              {t("ui.set.phrase_choice_help")}
            </label>
          </fieldset>
          <fieldset>
            <legend>{t("ui.set.pixel_scale")}</legend>
            <Radio name="scale" value={s.pixelScale} options={[{ v: 0, label: t("ui.set.auto") }, { v: 2, label: "2×" }, { v: 3, label: "3×" }, { v: 4, label: "4×" }]} onChange={(v) => updateSettings({ pixelScale: v as Settings["pixelScale"] })} />
          </fieldset>
          <fieldset>
            <legend>{t("ui.set.animation_speed")}</legend>
            <Radio name="speed" value={s.animationSpeed} options={[{ v: 1, label: "1×" }, { v: 2, label: "2×" }, { v: 4, label: "4×" }]} onChange={(v) => updateSettings({ animationSpeed: v as Settings["animationSpeed"] })} />
          </fieldset>
          <fieldset>
            <legend>{t("ui.set.sound")}</legend>
            <label>
              <input type="checkbox" checked={s.sound} disabled onChange={() => {}} />
              {t("ui.set.sound_mvp")}
            </label>
          </fieldset>
          <Weights />
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
