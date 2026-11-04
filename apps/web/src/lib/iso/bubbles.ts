/**
 * Pure helper for computing icon bubbles over buildings.
 * Speech-bubble icons:
 *   - bread: hungry citizens
 *   - zzz: idle/closed business
 *   - exclamation: chronicle events
 *   - coin: active trade
 * Max 12 visible at once, pooled, deterministic.
 */

import type { CityView } from "../sim-view.ts";

export type BubbleGlyph = "bread" | "zzz" | "exclamation" | "coin";

export interface Bubble {
  id: string;
  sectorIdx: number;
  buildingId?: string;
  glyph: BubbleGlyph;
  title: string;
  description: string;
  ariaLabel: string;
  priority: number;
}

export const MAX_BUBBLES = 12;

/**
 * Pure function: returns at most 12 prioritized bubbles for the given city view.
 * Zero Math.random, zero Date, deterministic ordering.
 */
export function bubblesFor(city: CityView): Bubble[] {
  if (!city || !Array.isArray(city.sectors) || city.sectors.length === 0) {
    return [];
  }

  const candidates: Bubble[] = [];

  // 1. Idle / Closed / Insolvent businesses -> 'zzz' glyph
  for (const sector of city.sectors) {
    for (const biz of sector.businesses) {
      if (!biz.open || biz.insolvent_steps > 0) {
        candidates.push({
          id: `bubble_closed_${biz.id}`,
          sectorIdx: sector.idx,
          buildingId: biz.id,
          glyph: "zzz",
          title: `${biz.name} Idle`,
          description: `${biz.name} is closed / insolvent (${biz.insolvent_steps} steps)`,
          ariaLabel: `Closed business: ${biz.name} in ${sector.name} is idle or insolvent`,
          priority: 90 + Math.min(10, biz.insolvent_steps),
        });
      }
    }
  }

  // 2. Hungry citizens / food scarcity -> 'bread' glyph
  const foodSector = city.sectors.find((s) => s.kind === "food") ?? city.sectors[0];
  const breadItem = city.market?.find((m) => m.id === "bread" || m.id === "grain");
  const isHungry =
    city.citizens.satisfaction_bps < 8000 ||
    (breadItem && breadItem.stock < breadItem.target);

  if (isHungry && foodSector) {
    const satisfactionPct = Math.round(city.citizens.satisfaction_bps / 100);
    candidates.push({
      id: `bubble_hungry_${foodSector.idx}`,
      sectorIdx: foodSector.idx,
      glyph: "bread",
      title: "Hungry Citizens",
      description: `Citizens in ${foodSector.name} require bread rations (satisfaction ${satisfactionPct}%)`,
      ariaLabel: `Hungry citizens need bread in ${foodSector.name} (satisfaction ${satisfactionPct}%)`,
      priority: 85,
    });
  }

  // 3. Chronicle Events -> 'exclamation' glyph
  const recentEvents = (city.chronicle ?? []).slice(0, 3);
  for (let i = 0; i < recentEvents.length; i++) {
    const ev = recentEvents[i];
    // Assign to a sector deterministically based on step / index
    const sectorIdx = (Math.abs(ev.step) + i) % city.sectors.length;
    const targetSector = city.sectors[sectorIdx] ?? city.sectors[0];
    candidates.push({
      id: `bubble_event_${ev.id}`,
      sectorIdx: targetSector.idx,
      glyph: "exclamation",
      title: ev.title,
      description: ev.description,
      ariaLabel: `Event in ${targetSector.name}: ${ev.title} - ${ev.description}`,
      priority: 70 - i * 5,
    });
  }

  // 4. Active Trade -> 'coin' glyph
  for (const sector of city.sectors) {
    const activeBiz = sector.businesses.find(
      (b) => b.open && b.insolvent_steps === 0 && b.coin > 0
    );
    if (activeBiz) {
      candidates.push({
        id: `bubble_trade_${activeBiz.id}`,
        sectorIdx: sector.idx,
        buildingId: activeBiz.id,
        glyph: "coin",
        title: `Active Trade: ${activeBiz.name}`,
        description: `${activeBiz.name} trading ${activeBiz.recipe} (${activeBiz.coin} coin)`,
        ariaLabel: `Active trade: ${activeBiz.name} in ${sector.name} has ${activeBiz.coin} coin`,
        priority: 50 + Math.min(15, Math.floor(activeBiz.coin / 200)),
      });
    }
  }

  // Sort deterministically: highest priority first, tie-break by id
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });

  // Cap at MAX_BUBBLES
  return candidates.slice(0, MAX_BUBBLES);
}
