// Rockfall (§14.4).
import { effectiveSurface, elevationOfS, geoOf, isActive, wears } from "../model/selectors";
import { segmentAt } from "../geometry/hill";
import type { PendingRockfall } from "../model/types";
import type { StepTx } from "../resolution/tx";
import { injuryRoll } from "./falls";

function rockShouted(tx: StepTx, step: number): boolean {
  return tx.state.protocol.recent.some((c) => c.command === "rock" && c.step === step);
}

/** Commands phase of step N+1: a rock from step N warned now or in step N → threatened members take cover. */
export function rockfallWarnings(tx: StepTx): Set<string> {
  const st = tx.state;
  const coverNow = new Set<string>();
  for (const r of st.hazards.pendingRockfalls) {
    if (r.warned) continue;
    if (rockShouted(tx, st.step)) {
      r.warned = true;
      for (const m of r.threatened) coverNow.add(m);
      st.stats.rockfall.warned += 1;
      tx.emit({ type: "rockfall.warned", severity: "info", messageKey: "event.rock_warned", params: { count: r.threatened.length }, refs: { members: r.threatened } });
    } else {
      for (const m of r.threatened) tx.unwarnedRockThreat.add(m);
    }
  }
  st.hazards.pendingRockfalls = st.hazards.pendingRockfalls.filter((r) => !r.warned);
  return coverNow;
}

/** Hazard rolls: moving on rock / scree may dislodge a stone. */
export function dislodgeRolls(tx: StepTx) {
  const st = tx.state;
  const geo = geoOf(st);
  for (const [m, mv] of tx.moved) {
    const g = segmentAt(geo, mv.to - 1e-6 * Math.sign(mv.to - mv.from));
    const surf = effectiveSurface(st, tx.data, g.surface);
    const p = surf ? tx.data.hazards.rockfall.pDislodge[surf] ?? 0 : 0;
    if (p <= 0) continue;
    const r = tx.roll(`rockfall:dislodge:${m}`, p);
    if (!r.hit) continue;
    const srcElev = elevationOfS(geo, st.members[m].pos.s);
    const threatened = Object.values(st.members)
      .filter((o) => o.id !== m && isActive(o) && elevationOfS(geo, o.pos.s) < srcElev - 1e-6)
      .map((o) => o.id);
    const warnedNow = rockShouted(tx, st.step);
    const rf: PendingRockfall = { id: tx.newId("r"), createdStep: st.step, sourceMemberId: m, pos: { ...st.members[m].pos }, threatened, warned: warnedNow };
    st.stats.rockfall.total += 1;
    tx.emit({ type: "rockfall.dislodged", severity: "danger", messageKey: "event.rock_dislodged", params: { member: m, count: threatened.length }, refs: { members: [m, ...threatened], rolls: [r] } });
    if (warnedNow) {
      st.stats.rockfall.warned += 1;
      for (const t of threatened) st.members[t].forcedSkipNextStep = true;
      tx.emit({ type: "rockfall.warned", severity: "info", messageKey: "event.rock_warned", params: { count: threatened.length }, refs: { members: threatened } });
    } else if (threatened.length > 0) {
      st.hazards.pendingRockfalls.push(rf);
    }
  }
}

/** End of step N+1: unwarned rocks hit (§14.4.4). */
export function rockfallHits(tx: StepTx) {
  const st = tx.state;
  const rf = tx.data.hazards.rockfall;
  const remaining: PendingRockfall[] = [];
  for (const r of st.hazards.pendingRockfalls) {
    if (r.createdStep >= st.step) {
      remaining.push(r);
      continue;
    }
    tx.violation("P5", r.sourceMemberId);
    for (const m of r.threatened) {
      if (st.members[m].status === "injured") continue;
      const hit = tx.roll(`rockfall:hit:${r.id}:${m}`, rf.pHit);
      if (!hit.hit) {
        tx.emit({ type: "rockfall.missed", severity: "warning", messageKey: "event.rock_missed", params: { member: m }, refs: { members: [m], rolls: [hit] } });
        continue;
      }
      st.stats.rockfall.hits += 1;
      tx.emit({ type: "rockfall.hit", severity: "danger", messageKey: "event.rock_hit", params: { member: m, helmet: wears(st, m, "helmet") ? 1 : 0 }, refs: { members: [m], rolls: [hit] } });
      const p = rf.pInjuryRock * (wears(st, m, "helmet") ? rf.helmetFactor : 1);
      injuryRoll(tx, m, p, "injury.rock", { helmet: wears(st, m, "helmet") ? 1 : 0 });
    }
  }
  st.hazards.pendingRockfalls = remaining;
}
