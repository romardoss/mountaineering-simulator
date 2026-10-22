// getActionOptions (§18.4.2): every action a member could take, enabled or
// disabled with a reason. The UI fills the open parameters (knot, command, items).
import { basePointsOf, isAdjacent } from "../geometry/hill";
import { anchorContext } from "../knots/instance";
import {
  attachmentsOf,
  baseAt,
  belayableSegments,
  belaysAsBelayer,
  carried,
  elevationOfS,
  geoOf,
  harnessNodes,
} from "../model/selectors";
import type { ActionParams, ItemId, KnotChoice, KnotContext, MemberId } from "../model/types";
import type { ReadCtx } from "../resolution/tx";
import { belayMode, moveReach, validateAction, type Hint } from "./defs";

export type OptionGroup = "move" | "attach" | "tie" | "base" | "belay" | "command" | "detach" | "items" | "skip";

export interface ActionOption {
  id: string;
  group: OptionGroup;
  labelKey: string;
  labelParams: Record<string, string | number>;
  params: ActionParams;
  needs?: {
    knot?: { context: KnotContext };
    command?: true;
    items?: { choices: ItemId[]; max: number };
  };
  enabled: boolean;
  reasonKey?: string;
  reasonParams?: Record<string, string | number>;
  hints?: Hint[];
}

const PLACEHOLDER_KNOT: KnotChoice = { knotId: "providnyk_visimka_odnym", control: "none", turns: null };

export function getActionOptions(ctx: ReadCtx, m: MemberId): ActionOption[] {
  const st = ctx.state;
  const mem = st.members[m];
  const out: ActionOption[] = [];
  const near = (s: number) => isAdjacent(mem.pos, { obstacleIndex: 0, s }, ctx.data.rules.adjacencyM);
  const add = (o: Omit<ActionOption, "enabled">, probe?: ActionParams) => {
    const v = validateAction(ctx, m, probe ?? o.params);
    out.push({ ...o, enabled: v.ok, reasonKey: v.ok ? undefined : v.reasonKey, reasonParams: v.ok ? undefined : v.params });
  };
  const withKnot = <P extends ActionParams>(p: P): P => ({ ...p, knot: PLACEHOLDER_KNOT });

  add({ id: "skip", group: "skip", labelKey: "action.skip", labelParams: {}, params: { kind: "skip" } });

  // movement — label by physical direction (§7.1.8)
  const geo = geoOf(st);
  for (const toward of ["finish", "start"] as const) {
    const r = moveReach(ctx, m, toward);
    const dir = toward === "finish" ? 1 : -1;
    const probeS = Math.max(0, Math.min(geo.totalLength, mem.pos.s + dir * 0.5));
    const up = elevationOfS(geo, probeS) > elevationOfS(geo, mem.pos.s) + 1e-6;
    const flat = Math.abs(elevationOfS(geo, probeS) - elevationOfS(geo, mem.pos.s)) < 1e-6;
    add(
      {
        id: `move:${toward}`,
        group: "move",
        labelKey: flat ? `action.move_flat_${toward}` : up ? "action.move_up" : "action.move_down",
        labelParams: { toward },
        // full reach this step; exact points are chosen with a right-click on the hill (CR-18)
        params: { kind: "move", toward, distanceM: r.reach },
      },
      { kind: "move", toward, distanceM: Math.max(r.reach, 0.01) },
    );
  }

  // attach to fixed rope segments / bases
  for (const seg of belayableSegments(st)) {
    const lo = Math.min(seg.lower.pos.s, seg.upper.pos.s) - ctx.data.rules.adjacencyM;
    const hi = Math.max(seg.lower.pos.s, seg.upper.pos.s) + ctx.data.rules.adjacencyM;
    if (mem.pos.s < lo || mem.pos.s > hi) continue;
    const target = { kind: "segment" as const, ropeId: seg.ropeId, lowerNodeId: seg.lowerNodeId, upperNodeId: seg.upperNodeId };
    const lp = { from: Math.round(seg.lower.pos.s), to: Math.round(seg.upper.pos.s), rope: seg.ropeId };
    add({ id: `attach:grab:${seg.key}`, group: "attach", labelKey: "action.attach_grabbing", labelParams: lp, params: { kind: "attach", method: "grabbing_knot", target }, needs: { knot: { context: "SELF_BELAY_GRAB" } } }, withKnot({ kind: "attach", method: "grabbing_knot", target }));
    add({ id: `attach:lanyard:${seg.key}`, group: "attach", labelKey: "action.attach_lanyard", labelParams: lp, params: { kind: "attach", method: "lanyard_carabiner", target } });
    add({ id: `attach:hand:${seg.key}`, group: "attach", labelKey: "action.attach_hand", labelParams: lp, params: { kind: "attach", method: "hand", target } });
  }
  for (const b of Object.values(st.bases)) {
    if (!near(b.pos.s)) continue;
    add({ id: `attach:base:${b.id}`, group: "attach", labelKey: "action.attach_base", labelParams: { base: b.basePointId }, params: { kind: "attach", method: "lanyard_carabiner", target: { kind: "base", baseId: b.id } } });
    for (const { rope } of harnessNodes(st, m)) {
      add({ id: `clip:${rope.ropeId}:${b.id}`, group: "attach", labelKey: "action.clip", labelParams: { base: b.basePointId, rope: rope.ropeId }, params: { kind: "clip", ropeId: rope.ropeId, baseId: b.id } });
    }
  }

  // tie in / fix rope
  const ropes = new Set<string>([...carried(st, m, "rope").map((r) => r.id), ...Object.keys(st.ropes)]);
  for (const ropeId of ropes) {
    const inUse = !!st.ropes[ropeId];
    if (inUse && !st.ropes[ropeId].nodes.some((n) => n.attach.kind === "free" && near(n.pos.s))) {
      // nothing to tie in to here
    } else {
      const p: ActionParams = { kind: "tie_in", ropeId, knot: PLACEHOLDER_KNOT, viaCarabiner: false };
      add({ id: `tie_in:${ropeId}`, group: "tie", labelKey: "action.tie_in", labelParams: { rope: ropeId }, params: p, needs: { knot: { context: "TIE_IN_END" } } });
    }
    for (const b of Object.values(st.bases)) {
      if (!near(b.pos.s)) continue;
      const p: ActionParams = { kind: "fix_rope", ropeId, baseId: b.id, method: "knot", knot: PLACEHOLDER_KNOT };
      const v = validateAction(ctx, m, p);
      if (!v.ok && (v.reasonKey === "reason.no_free_end_near" || v.reasonKey === "reason.rope_not_carried")) continue;
      add({ id: `fix:${ropeId}:${b.id}`, group: "tie", labelKey: "action.fix_rope", labelParams: { rope: ropeId, base: b.basePointId }, params: p, needs: { knot: { context: anchorContext(st, b) } } });
      if (!inUse) add({ id: `fix2:${ropeId}:${b.id}`, group: "tie", labelKey: "action.fix_doubled", labelParams: { rope: ropeId, base: b.basePointId }, params: { kind: "fix_rope", ropeId, baseId: b.id, method: "doubled" } });
    }
  }

  // bases
  for (const bp of basePointsOf(geo.obstacle)) {
    if (!near(bp.s) || baseAt(st, bp.id)) continue;
    const kinds = bp.anchorType === "bolt" ? (["bolt"] as const) : (["sling", "direct"] as const);
    for (const c of kinds) add({ id: `base:${bp.id}:${c}`, group: "base", labelKey: `action.make_base.${c}`, labelParams: { base: bp.id, anchor: bp.anchorType }, params: { kind: "make_base", basePointId: bp.id, construction: c } });
  }

  // belay «від бази» / «від себе», enabled ones only (CR-33, CR-47)
  for (const other of Object.values(st.members)) {
    if (other.id === m || harnessNodes(st, other.id).length === 0) continue;
    const ok = harnessNodes(st, other.id).some(({ rope }) => rope.nodes.some((n) => n.attach.kind === "free" && near(n.pos.s)));
    if (!ok) continue;
    const mode = belayMode(ctx, m, other.id);
    for (const braking of ["knot", "device"] as const) {
      for (const anchor of ["base", "body"] as const) {
        const p: ActionParams = { kind: "belay", climberId: other.id, braking, anchor };
        add(
          { id: `belay:${other.id}:${braking}:${anchor}`, group: "belay", labelKey: `action.belay.${mode}`, labelParams: { climber: other.id, braking, anchor }, params: p, needs: braking === "knot" ? { knot: { context: mode === "lower" ? "BELAY_LOWER" : "BELAY_UPPER" } } : undefined },
          braking === "knot" ? { ...p, knot: { knotId: "uiaa", control: "none", turns: null } } : p,
        );
      }
    }
  }
  for (const b of belaysAsBelayer(st, m)) add({ id: `stop_belay:${b.id}`, group: "belay", labelKey: "action.stop_belay", labelParams: { climber: b.climberId }, params: { kind: "stop_belay", belayId: b.id } });

  // command
  add({ id: "command", group: "command", labelKey: "action.command", labelParams: {}, params: { kind: "command", command: "go", recipient: "all" }, needs: { command: true } });

  // detach / untie / retrieve
  for (const a of attachmentsOf(st, m)) add({ id: `detach:${a.id}`, group: "detach", labelKey: `action.detach.${a.method}`, labelParams: { target: a.target.kind === "base" ? st.bases[a.target.baseId]?.basePointId ?? "" : a.target.ropeId }, params: { kind: "detach", what: { kind: "attachment", attachmentId: a.id } } });
  for (const rope of Object.values(st.ropes)) {
    for (const n of rope.nodes) {
      if (!near(n.pos.s)) continue;
      if (n.attach.kind === "member_harness" && n.attach.memberId === m) add({ id: `untie:${n.id}`, group: "detach", labelKey: "action.untie_self", labelParams: { rope: rope.ropeId }, params: { kind: "detach", what: { kind: "untie", ropeId: rope.ropeId, nodeId: n.id } } });
      if (n.attach.kind === "base" && (n.attach.mode === "fixed" || n.attach.mode === "doubled")) add({ id: `untie:${n.id}`, group: "detach", labelKey: "action.untie_base", labelParams: { rope: rope.ropeId, base: st.bases[n.attach.baseId]?.basePointId ?? "" }, params: { kind: "detach", what: { kind: "untie", ropeId: rope.ropeId, nodeId: n.id } } });
      if (n.attach.kind === "base" && n.attach.mode === "running") add({ id: `unclip:${n.id}`, group: "detach", labelKey: "action.unclip", labelParams: { rope: rope.ropeId, base: st.bases[n.attach.baseId]?.basePointId ?? "" }, params: { kind: "detach", what: { kind: "unclip", ropeId: rope.ropeId, nodeId: n.id } } });
    }
    if (rope.nodes.some((n) => near(n.pos.s))) add({ id: `coil:${rope.ropeId}`, group: "detach", labelKey: "action.coil", labelParams: { rope: rope.ropeId }, params: { kind: "detach", what: { kind: "coil", ropeId: rope.ropeId } } });
    const ends = [rope.nodes[0], rope.nodes[rope.nodes.length - 1]];
    if (ends.some((n) => n && n.attach.kind === "free" && near(n.pos.s)) && rope.nodes.some((n) => n.attach.kind === "base" && !near(n.pos.s)))
      add({ id: `pull:${rope.ropeId}`, group: "detach", labelKey: "action.pull_down", labelParams: { rope: rope.ropeId }, params: { kind: "detach", what: { kind: "pull_down", ropeId: rope.ropeId } } });
  }
  for (const b of Object.values(st.bases)) if (near(b.pos.s)) add({ id: `dismantle:${b.id}`, group: "detach", labelKey: "action.dismantle_base", labelParams: { base: b.basePointId }, params: { kind: "detach", what: { kind: "dismantle_base", baseId: b.id } } });

  // items
  const mine = carried(st, m).map((i) => i.id);
  for (const other of Object.values(st.members)) {
    if (other.id === m || other.status === "injured" || !near(other.pos.s)) continue;
    add({ id: `pass:${other.id}`, group: "items", labelKey: "action.pass", labelParams: { to: other.id }, params: { kind: "pass", toMemberId: other.id, itemIds: [] }, needs: { items: { choices: mine, max: ctx.data.actions.maxPassItems } } }, { kind: "pass", toMemberId: other.id, itemIds: mine.slice(0, 1) });
  }
  const ground = Object.values(st.items).filter((i) => i.location.kind === "on_ground" && near(i.location.pos.s)).map((i) => i.id);
  if (ground.length) add({ id: "pickup", group: "items", labelKey: "action.pickup", labelParams: { count: ground.length }, params: { kind: "pickup", itemIds: [] }, needs: { items: { choices: ground, max: ground.length } } }, { kind: "pickup", itemIds: ground.slice(0, 1) });
  for (const it of carried(st, m)) if (["harness", "helmet", "gloves", "crampons"].includes(it.type)) add({ id: `wear:${it.id}`, group: "items", labelKey: "action.wear", labelParams: { item: it.type }, params: { kind: "wear", itemId: it.id } });

  return out.filter((o) => o.params.kind !== "belay" || o.enabled);
}
