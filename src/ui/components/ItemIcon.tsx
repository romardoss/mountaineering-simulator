// Small pixel icons for equipment (CR-40): 16×16 SVG, crisp edges, tooltip = item name.
import type { ItemProps, ItemType } from "../../engine/model/types";

const INK = "#1a1c2c";

function shape(type: ItemType | "individual", p: ItemProps) {
  switch (type) {
    case "rope":
    case "cord": {
      const c = p.color ?? (type === "rope" ? "#d93636" : "#ffd23f");
      const r = type === "rope" ? 6 : 4;
      return (
        <>
          <circle cx="8" cy="8" r={r} fill="none" stroke={INK} stroke-width="3" />
          <circle cx="8" cy="8" r={r} fill="none" stroke={c} stroke-width="1.6" />
          <circle cx="8" cy="8" r={r - 2.5} fill="none" stroke={c} stroke-width="1.2" />
        </>
      );
    }
    case "sling":
      return (
        <>
          <rect x="2" y="4" width="12" height="8" rx="4" fill="none" stroke={INK} stroke-width="3" />
          <rect x="2" y="4" width="12" height="8" rx="4" fill="none" stroke={p.color ?? "#5fa8f0"} stroke-width="1.6" />
        </>
      );
    case "carabiner":
      return (
        <>
          <path d="M5 2 h4 q4 0 4 6 q0 6 -4 6 h-4 q-2 0 -2 -3 v-6 q0 -3 2 -3 z" fill="none" stroke={INK} stroke-width="3" />
          <path d="M5 2 h4 q4 0 4 6 q0 6 -4 6 h-4 q-2 0 -2 -3 v-6 q0 -3 2 -3 z" fill="none" stroke="#c8c8d0" stroke-width="1.4" />
          {p.locking && <rect x="2" y="7" width="3" height="4" fill="#f2a65a" stroke={INK} stroke-width="0.8" />}
        </>
      );
    case "belay_device":
      return (
        <>
          <rect x="3" y="3" width="10" height="10" rx="2" fill="#4a4a55" stroke={INK} stroke-width="1" />
          <rect x="5" y="5" width="2" height="5" fill="#e6eaf0" />
          <rect x="9" y="5" width="2" height="5" fill="#e6eaf0" />
        </>
      );
    case "ascender":
      return (
        <>
          <rect x="6" y="1" width="4" height="9" fill="#3a6ea8" stroke={INK} stroke-width="1" />
          <path d="M6 10 h4 v3 q-2 3 -4 0 z" fill="#d93636" stroke={INK} stroke-width="1" />
        </>
      );
    case "lanyard":
      return (
        <path d="M8 15 v-6 M8 9 l-5 -6 M8 9 l5 -6" stroke="#e8574a" stroke-width="2.4" fill="none" stroke-linecap="square" />
      );
    case "harness":
      return (
        <>
          <rect x="2" y="3" width="12" height="4" fill="#f2a65a" stroke={INK} stroke-width="1" />
          <circle cx="5" cy="11" r="3" fill="none" stroke="#f2a65a" stroke-width="2" />
          <circle cx="11" cy="11" r="3" fill="none" stroke="#f2a65a" stroke-width="2" />
        </>
      );
    case "helmet":
      return <path d="M2 12 q0 -9 6 -9 q6 0 6 9 z" fill={p.color ?? "#e6eaf0"} stroke={INK} stroke-width="1" />;
    case "gloves":
      return <path d="M4 14 v-8 h2 v-3 h2 v3 h2 v-2 h2 v10 z" fill="#b08455" stroke={INK} stroke-width="1" />;
    case "crampons":
      return (
        <>
          <rect x="2" y="5" width="12" height="3" fill="#9a9aa6" stroke={INK} stroke-width="1" />
          <path d="M3 8 l1 5 l1 -5 M7 8 l1 5 l1 -5 M11 8 l1 5 l1 -5" fill="#9a9aa6" stroke={INK} stroke-width="0.8" />
        </>
      );
    case "ice_axe":
      return (
        <>
          <rect x="7" y="3" width="2" height="12" fill="#6e6e7a" stroke={INK} stroke-width="0.8" />
          <path d="M2 4 h12 l-2 2 h-10 z" fill="#c8c8d0" stroke={INK} stroke-width="0.8" />
        </>
      );
    case "backpack":
    case "individual":
      return (
        <>
          <rect x="3" y="4" width="10" height="11" rx="2" fill="#e07a2a" stroke={INK} stroke-width="1" />
          <rect x="5" y="2" width="6" height="3" rx="1" fill="none" stroke={INK} stroke-width="1" />
          <rect x="5" y="9" width="6" height="3" fill="#f2a65a" stroke={INK} stroke-width="0.8" />
        </>
      );
  }
}

export function ItemIcon({ type, props = {}, title, size = 16 }: { type: ItemType | "individual"; props?: ItemProps; title: string; size?: number }) {
  return (
    <svg class="item-icon" width={size} height={size} viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label={title}>
      <title>{title}</title>
      {shape(type, props)}
    </svg>
  );
}
