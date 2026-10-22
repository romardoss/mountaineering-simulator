// Спорядження (§9.3): item pool, assignment to members, weight limits. Weights are read-only here (Settings, CR-7).
import { useState } from "preact/hooks";
import { t } from "../../i18n/i18n";
import { kits } from "../../data/load";
import { data, draft, updateDraft, withWeights } from "../../app/store";
import { buildKit, defaultWeight, isIndividual, makeItem } from "../../engine/scenario/kit";
import { memberLoadKg, validateEquipment } from "../../engine/scenario/validate";
import type { ItemConfig, ItemProps, ItemType, MemberConfig } from "../../engine/model/types";
import { Msg, TopBar, WeightBar } from "../components/common";
import { FlowNav, newId } from "./cfgShared";

const ICON_COLORS: Partial<Record<ItemType, string>> = {
  rope: "#d93636",
  cord: "#ffd23f",
  sling: "#5fa8f0",
  carabiner: "#c8c8d0",
  belay_device: "#4a4a55",
  ascender: "#3a6ea8",
  harness: "#f2a65a",
  helmet: "#e6eaf0",
  lanyard: "#e8574a",
  gloves: "#b08455",
  crampons: "#9a9aa6",
  ice_axe: "#6e6e7a",
  backpack: "#e07a2a",
};

// team gear only: individual equipment is the same for everybody and automatic (CR-14)
const CATALOG: ItemType[] = ["rope", "sling", "carabiner"];

function wearable(type: ItemType): boolean {
  return !!data.equipment.find((e) => e.type === type)?.wearable;
}

function itemLabel(it: ItemConfig): string {
  const p = it.props;
  const name = t(`item.${it.type}`);
  switch (it.type) {
    case "rope":
      return `${name} ${t("ui.cfg.eq.dims", { len: p.lengthM ?? 0, d: p.diameterMm ?? 0 })}`;
    case "cord":
      return `${name} ${t("ui.cfg.eq.dims", { len: p.lengthM ?? 0, d: p.diameterMm ?? 0 })}${p.loopKnot ? ` ${t("ui.cfg.eq.loop_mark")}` : ""}`;
    case "sling":
      return `${name} ${t("ui.cfg.eq.cm", { cm: p.lengthCm ?? 0 })}`;
    case "carabiner":
      return `${name} ${p.locking ? t("ui.cfg.eq.locking_short") : t("ui.cfg.eq.nonlocking_short")}`; // no shape / «HMS» in names (CR-15)
    case "belay_device":
      return `${name} ${p.model === "figure8" ? t("ui.cfg.eq.figure8") : "ATC"}`;
    case "lanyard":
      return `${name} (${p.arms ?? 1})`;
    default:
      return name;
  }
}

function Icon({ type }: { type: ItemType }) {
  return <span class="cfg-icon" style={{ background: ICON_COLORS[type] ?? "#999" }} aria-hidden="true" />;
}

function PropsEditor({ it, onChange }: { it: ItemConfig; onChange: (props: ItemProps) => void }) {
  const p = it.props;
  const num = (key: keyof ItemProps, min: number, max: number, step = 1, label = "") => (
    <label>
      {label}
      <input type="number" min={min} max={max} step={step} value={p[key] as number} onChange={(e) => {
        const v = Math.min(max, Math.max(min, Number((e.target as HTMLInputElement).value) || min));
        onChange({ ...p, [key]: v });
      }} />
    </label>
  );
  switch (it.type) {
    case "rope":
      return (
        <div class="cfg-props">
          {num("lengthM", 20, 60, 5, t("ui.cfg.eq.length_m"))}
          {/* main rope diameter is fixed at 10 mm (CR-16) */}
          <label>
            {t("ui.cfg.eq.kind")}
            <select value={p.kind} onChange={(e) => onChange({ ...p, kind: (e.target as HTMLSelectElement).value as "static" | "dynamic" })}>
              <option value="dynamic">{t("ui.cfg.eq.dynamic")}</option>
              <option value="static">{t("ui.cfg.eq.static")}</option>
            </select>
          </label>
          <input type="color" aria-label={t("ui.cfg.eq.color")} value={p.color ?? "#d93636"} onChange={(e) => onChange({ ...p, color: (e.target as HTMLInputElement).value })} />
        </div>
      );
    case "sling":
      return (
        <div class="cfg-props">
          <select value={p.lengthCm} aria-label={t("ui.cfg.eq.length_cm")} onChange={(e) => onChange({ ...p, lengthCm: Number((e.target as HTMLSelectElement).value) })}>
            {[60, 120, 240].map((x) => (
              <option value={x}>{t("ui.cfg.eq.cm", { cm: x })}</option>
            ))}
          </select>
        </div>
      );
    case "carabiner":
      return (
        <div class="cfg-props">
          <label>
            <input type="checkbox" checked={!!p.locking} onChange={(e) => onChange({ ...p, locking: (e.target as HTMLInputElement).checked })} />
            {t("ui.cfg.eq.locking")}
          </label>
          {/* no shape choice (CR-43): carabiners stay pear-shaped (HMS) internally */}
        </div>
      );
    case "lanyard":
      return (
        <div class="cfg-props">
          <select value={p.arms} aria-label={t("ui.cfg.eq.arms")} onChange={(e) => onChange({ ...p, arms: Number((e.target as HTMLSelectElement).value) })}>
            <option value={1}>{t("ui.cfg.eq.arms_n", { count: 1 })}</option>
            <option value={2}>{t("ui.cfg.eq.arms_n", { count: 2 })}</option>
          </select>
        </div>
      );
    default:
      return null;
  }
}

/** JSON with sorted keys, so equal props give equal strings. */
function canonical(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

function groupKey(it: ItemConfig): string {
  return `${it.type}|${canonical(it.props)}`;
}

/** Identical items (type + props) shown as one row with a count (CR-6). Presentation only. */
interface ItemGroup {
  key: string;
  first: ItemConfig;
  items: ItemConfig[];
}

function groupItems(items: ItemConfig[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const it of items) {
    const k = groupKey(it);
    const g = map.get(k);
    if (g) g.items.push(it);
    else map.set(k, { key: k, first: it, items: [it] });
  }
  return [...map.values()];
}

const MAX_GROUP = 50;

export function EquipmentScreen() {
  const d = withWeights(draft.value);
  const [error, setError] = useState<string | null>(null);
  const [addType, setAddType] = useState<ItemType>("carabiner");
  const [addCount, setAddCount] = useState(1);
  const maxKg = data.rules.weight.maxKg;
  const issues = validateEquipment(data, d);
  const visible = d.items.filter((i) => !isIndividual(data, i.type));
  const groups = groupItems(visible);

  const memberById = (id: string) => d.team.find((m) => m.id === id);
  const freeOf = (g: ItemGroup) => g.items.filter((i) => !i.assignedTo);

  const weightOf = (it: ItemConfig) => defaultWeight(d.weights, it.type, it.props);

  /** Load of a member if item `it` were assigned to them. */
  const wouldExceed = (m: MemberConfig, it: ItemConfig) => {
    const others = d.items.filter((x) => x.id !== it.id);
    return memberLoadKg(data, { ...d, items: others }, m.id) + weightOf(it) > maxKg + 1e-9;
  };

  const assign = (id: string, to: ItemConfig["assignedTo"]) => {
    const it = d.items.find((x) => x.id === id);
    if (!it) return;
    if (to) {
      const m = memberById(to.memberId);
      if (!m) return;
      if (to.as === "worn" && !wearable(it.type)) return setError(t("ui.cfg.eq.err_not_wearable", { item: t(`item.${it.type}`) }));
      if (wouldExceed(m, it)) return setError(t("ui.cfg.eq.err_over_max", { member: m.name, max: maxKg }));
    }
    setError(null);
    updateDraft((x) => ((x.items = x.items.map((i) => (i.id === id ? { ...i, assignedTo: to } : i))), x));
  };

  /** Applies props to every item of a group; refused if a member would exceed maxKg. */
  const editGroup = (g: ItemGroup, props: ItemProps) => {
    const ids = new Set(g.items.map((i) => i.id));
    const next = d.items.map((i) => (ids.has(i.id) ? { ...i, props: structuredClone(props) } : i));
    const over = d.team.find((m) => memberLoadKg(data, { ...d, items: next }, m.id) > maxKg + 1e-9);
    if (over) return setError(t("ui.cfg.eq.err_over_max", { member: over.name, max: maxKg }));
    setError(null);
    updateDraft((x) => ((x.items = next), x));
  };

  /** More copies are added unassigned; fewer removes unassigned copies first, then from the last member. */
  const setCount = (g: ItemGroup, n: number) => {
    const target = Math.max(1, Math.min(MAX_GROUP, Math.round(n) || 1));
    const have = g.items.length;
    if (target === have) return;
    setError(null);
    if (target > have) {
      const extra: ItemConfig[] = Array.from({ length: target - have }, () => ({ ...structuredClone(g.first), id: newId(g.first.type), assignedTo: null }));
      return updateDraft((x) => ((x.items = [...x.items, ...extra]), x));
    }
    const order = (i: ItemConfig) => (i.assignedTo ? d.team.findIndex((m) => m.id === i.assignedTo!.memberId) : d.team.length);
    const drop = new Set(
      [...g.items]
        .reverse()
        .sort((a, b) => order(b) - order(a))
        .slice(0, have - target)
        .map((i) => i.id),
    );
    updateDraft((x) => ((x.items = x.items.filter((i) => !drop.has(i.id))), x));
  };

  const add = () => {
    const items: ItemConfig[] = [];
    for (let i = 0; i < Math.max(1, Math.min(MAX_GROUP, addCount)); i++) items.push(makeItem(data, newId(addType), addType));
    updateDraft((x) => ((x.items = [...x.items, ...items]), x));
  };

  const removeGroup = (g: ItemGroup) => {
    const ids = new Set(g.items.map((i) => i.id));
    updateDraft((x) => ((x.items = x.items.filter((i) => !ids.has(i.id))), x));
  };


  /** One more piece of group `mine` for member `m` (CR-9): a free piece of the group, else a new copy. */
  const more = (m: MemberConfig, mine: ItemGroup) => {
    const free = groups.find((x) => x.key === mine.key)?.items.find((i) => !i.assignedTo);
    if (free) return assign(free.id, { memberId: m.id, as: "carried" });
    const copy: ItemConfig = { ...structuredClone(mine.first), id: newId(mine.first.type), assignedTo: { memberId: m.id, as: "carried" } };
    if (wouldExceed(m, copy)) return setError(t("ui.cfg.eq.err_over_max", { member: m.name, max: maxKg }));
    setError(null);
    updateDraft((x) => ((x.items = [...x.items, copy]), x));
  };

  /** Carried team items of one member, grouped like the pool, with − n + (CR-9). Worn items are not shown (CR-13). */
  const memberGroups = (m: MemberConfig) =>
    groupItems(visible.filter((i) => i.assignedTo?.memberId === m.id)).map((g) => {
      const label = itemLabel(g.first);
      const less = (e: Event) => (e.stopPropagation(), assign(g.items[g.items.length - 1].id, null));
      return (
        <span class="cfg-item">
          <Icon type={g.first.type} /> <span class="grow">{label}</span>
          <span class="cfg-qty">
            <button class="btn small secondary" aria-label={t("ui.cfg.eq.less", { item: label })} title={t("ui.cfg.eq.less", { item: label })} onClick={less}>
              −
            </button>
            <span class="qty" aria-label={t("ui.cfg.eq.count")}>{g.items.length}</span>
            <button class="btn small secondary" aria-label={t("ui.cfg.eq.more", { item: label })} title={t("ui.cfg.eq.more", { item: label })} onClick={(e) => (e.stopPropagation(), more(m, g))}>
              +
            </button>
          </span>
        </span>
      );
    });

  return (
    <div class="screen">
      <TopBar back="team" />
      <div class="screen-body">
        <h1>{t("ui.cfg.eq.title")}</h1>
        {error && <Msg level="error">{error}</Msg>}
        <div class="cfg-equip">
          <div class="panel col">
            <h2>{t("ui.cfg.eq.pool")}</h2>
            <div class="row">
              <select value={addType} aria-label={t("ui.cfg.eq.catalog")} onChange={(e) => setAddType((e.target as HTMLSelectElement).value as ItemType)}>
                {CATALOG.map((ty) => (
                  <option value={ty}>{t(`item.${ty}`)}</option>
                ))}
              </select>
              <label>
                ×
                <input type="number" min={1} max={MAX_GROUP} value={addCount} onChange={(e) => setAddCount(Number((e.target as HTMLInputElement).value) || 1)} />
              </label>
              <button class="btn small" onClick={add}>
                + {t("ui.cfg.eq.add")}
              </button>
              {d.mode === "learning" && (
                <button class="btn small secondary" onClick={() => updateDraft((x) => ((x.items = buildKit(data, kits[0], x.team, x.season)), x))}>
                  {t("kit.typical")}
                </button>
              )}
            </div>
            <small class="muted">{t("ui.cfg.eq.stock_hint")}</small>
            <div class="cfg-scroll">
              {groups.map((g) => {
                const it = g.first;
                const free = freeOf(g).length;
                const perMember = d.team.map((m) => ({ m, n: g.items.filter((i) => i.assignedTo?.memberId === m.id).length })).filter((x) => x.n > 0);
                return (
                  <div class="cfg-pool-item">
                    <div class="col" style={{ gap: 4 }}>
                      <strong>
                        <Icon type={it.type} /> {itemLabel(it)}
                      </strong>
                      <PropsEditor it={it} onChange={(props) => editGroup(g, props)} />
                      <span class="cfg-dist">
                        <span>{t("ui.cfg.eq.free_n", { count: free })}</span>
                        {perMember.map(({ m, n }) => (
                          <span>
                            · {m.name} ×{n}
                          </span>
                        ))}
                      </span>
                    </div>
                    <div class="col" style={{ alignItems: "flex-end", gap: 4 }}>
                      <label>
                        {t("ui.cfg.eq.count")}
                        <input type="number" min={1} max={MAX_GROUP} value={g.items.length} aria-label={t("ui.cfg.eq.count")} onChange={(e) => setCount(g, Number((e.target as HTMLInputElement).value))} />
                      </label>
                      <small class="muted" title={t("ui.cfg.eq.weight_from_settings")}>
                        {t("ui.cfg.eq.weight_each", { kg: weightOf(it) })}
                      </small>
                      <button class="btn small danger" onClick={() => removeGroup(g)} aria-label={t("ui.cfg.eq.remove")} title={t("ui.cfg.eq.remove")}>
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div class="col">
            <div class="cfg-members">
              {d.team.map((m) => {
                const gear = memberLoadKg(data, d, m.id) - d.weights.backpackBaseKg;
                return (
                  <div class="panel cfg-col">
                    <h3>{m.name}</h3>
                    <WeightBar baseKg={d.weights.backpackBaseKg} gearKg={gear} />
                    <small>{t("ui.cfg.eq.carried")}</small>
                    {memberGroups(m)}
                    {/* team gear is handed out here, not in the stock panel (CR-42) */}
                    {groups.length > 0 && (
                      <select class="cfg-take" value="" aria-label={t("ui.cfg.eq.take", { member: m.name })} onChange={(e) => {
                        const g = groups.find((x) => x.key === (e.target as HTMLSelectElement).value);
                        if (g) more(m, g);
                      }}>
                        <option value="">+ {t("ui.cfg.eq.take_one")}</option>
                        {groups.map((g) => (
                          <option value={g.key}>
                            {itemLabel(g.first)} ({t("ui.cfg.eq.free_n", { count: freeOf(g).length })})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            {issues.map((i) => (
              <Msg level={i.level}>{t(i.key, i.params)}</Msg>
            ))}
          </div>
        </div>
        <FlowNav current="equipment" />
      </div>
    </div>
  );
}
