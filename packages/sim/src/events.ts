/**
 * Stateless Arc Events engine for AfterHours simulation.
 * Erasable TypeScript only, zero external dependencies, BigInt arithmetic.
 * Events are derived via PRNG re-drawing over a rolling window.
 */

import { seedStep } from "./prng.ts";
import type { ArcFile, ArcEventDef, CityState, SimEvent } from "./types.ts";
import type { GrowthRules } from "./growth.ts";

export interface ActiveEvent {
  eventDef: ArcEventDef;
  startedAt: number;
}

let stepCache = new Map<number, ArcEventDef | null>();
let lastCityKey = "";

/**
 * Checks whether an event starts at a given step.
 * Uses a fresh Pcg32 seeded via seedStep(worldSeed, cityId, step).
 */
export function drawEventForStep(
  worldSeed: string,
  cityId: string,
  step: number,
  arc: ArcFile,
  eventStartBps: bigint
): ArcEventDef | null {
  if (step < 1 || arc.events.length === 0 || eventStartBps <= 0n) {
    return null;
  }

  const cityKey = `${worldSeed}:${cityId}:${arc.id}:${eventStartBps}`;
  if (cityKey !== lastCityKey) {
    stepCache = new Map<number, ArcEventDef | null>();
    lastCityKey = cityKey;
  }

  const cached = stepCache.get(step);
  if (cached !== undefined) {
    return cached;
  }

  const prng = seedStep(worldSeed, cityId, step);
  const roll = prng.nextBelow(10000);
  if (roll >= Number(eventStartBps)) {
    if (stepCache.size > 20000) stepCache.clear();
    stepCache.set(step, null);
    return null;
  }

  let totalWeight = 0n;
  for (const ev of arc.events) {
    totalWeight += ev.weight;
  }
  if (totalWeight <= 0n) {
    if (stepCache.size > 20000) stepCache.clear();
    stepCache.set(step, null);
    return null;
  }

  const weightChoice = prng.nextBelow(Number(totalWeight));
  let cumulative = 0n;
  let picked: ArcEventDef | null = null;
  for (const ev of arc.events) {
    cumulative += ev.weight;
    if (BigInt(weightChoice) < cumulative) {
      picked = ev;
      break;
    }
  }
  if (!picked) picked = arc.events[arc.events.length - 1];

  if (stepCache.size > 20000) stepCache.clear();
  stepCache.set(step, picked);
  return picked;
}

/**
 * Phase 1: Re-draws events for rolling window to find ending, starting, and active events.
 * Emits event_end and event_start, and applies start-step effects:
 * - sink_inventory_bps: destroys bps/10000 of inventory in sector, emits inventory_sunk
 * - population_bps: modifies population by bps/10000 (min growth.min_population), emits population_change
 * Returns the list of currently active events for production phase modifiers.
 */
export function processEventsPhase(
  state: CityState,
  arc: ArcFile,
  growth: GrowthRules | undefined,
  events: SimEvent[]
): ActiveEvent[] {
  if (!growth || arc.events.length === 0) {
    return [];
  }

  const nextStep = state.step;
  const maxDuration = arc.events.reduce(
    (max, ev) => Math.max(max, Number(ev.duration_steps)),
    0
  );

  const activeEvents: ActiveEvent[] = [];
  const startWindow = Math.max(1, nextStep - maxDuration);

  // 1. Check earlier steps for endings and active status
  for (let s = startWindow; s <= nextStep; s++) {
    const ev = drawEventForStep(state.world_seed, state.city_id, s, arc, growth.event_start_bps);
    if (!ev) continue;

    const d = Number(ev.duration_steps);

    // Event ended at this step: active was s .. s+d-1, so nextStep is s+d
    if (s + d === nextStep) {
      events.push({
        event: "event_end",
        city_id: state.city_id,
        step: nextStep,
        id: ev.id,
      });
    }

    // Active at nextStep
    if (s <= nextStep && nextStep < s + d) {
      activeEvents.push({ eventDef: ev, startedAt: s });
    }

    // Event starts at nextStep: emit event_start and apply start-step effects
    if (s === nextStep) {
      events.push({
        event: "event_start",
        city_id: state.city_id,
        step: nextStep,
        id: ev.id,
        duration: ev.duration_steps.toString(),
        duration_steps: ev.duration_steps.toString(),
      });

      for (const eff of ev.effects) {
        if (eff.kind === "sink_inventory_bps" && eff.sector !== undefined && eff.bps !== undefined) {
          const secIdx = eff.sector;
          if (secIdx >= 0 && secIdx < state.sectors.length) {
            const sector = state.sectors[secIdx];
            const perItemSunk: Record<string, bigint> = {};

            // Sort businesses by id
            const sortedBiz = [...sector.businesses].sort((a, b) =>
              a.id < b.id ? -1 : a.id > b.id ? 1 : 0
            );

            for (const b of sortedBiz) {
              const itemKeys = Object.keys(b.inventory).sort();
              for (const item of itemKeys) {
                const current = b.inventory[item] ?? 0n;
                const destroyed = (current * eff.bps) / 10000n;
                if (destroyed > 0n) {
                  b.inventory[item] = current - destroyed;
                  if (b.inventory[item] === 0n) delete b.inventory[item];
                  perItemSunk[item] = (perItemSunk[item] ?? 0n) + destroyed;
                }
              }
            }

            const itemsObj: Record<string, string> = {};
            for (const [it, amt] of Object.entries(perItemSunk).sort()) {
              itemsObj[it] = amt.toString();
            }

            events.push({
              event: "inventory_sunk",
              city_id: state.city_id,
              step: nextStep,
              sector: secIdx,
              event_id: ev.id,
              items: itemsObj,
              sunk: itemsObj,
            });
          }
        } else if (eff.kind === "population_bps" && eff.bps !== undefined) {
          const currentPop = state.citizens.population;
          const popDelta = (currentPop * eff.bps) / 10000n;
          let newPop = currentPop + popDelta;
          const minPop = growth.min_population;
          if (newPop < minPop) newPop = minPop;

          if (newPop !== currentPop) {
            state.citizens.population = newPop;
            events.push({
              event: "population_change",
              city_id: state.city_id,
              step: nextStep,
              old: currentPop.toString(),
              new: newPop.toString(),
              reason: "arc_event",
            });
          }
        }
      }
    }
  }

  // Stable ordering for active events: startedAt asc, then id asc
  activeEvents.sort((a, b) => {
    if (a.startedAt !== b.startedAt) return a.startedAt - b.startedAt;
    return a.eventDef.id < b.eventDef.id ? -1 : a.eventDef.id > b.eventDef.id ? 1 : 0;
  });

  return activeEvents;
}

/**
 * Applies active recipe_output_bps effects sequentially to an output quantity.
 */
export function applyRecipeOutputEffects(
  recipeId: string,
  baseQty: bigint,
  activeEvents: ActiveEvent[]
): bigint {
  let qty = baseQty;
  for (const active of activeEvents) {
    for (const eff of active.eventDef.effects) {
      if (eff.kind === "recipe_output_bps" && eff.recipe === recipeId && eff.bps !== undefined) {
        qty = (qty * eff.bps) / 10000n;
      }
    }
  }
  return qty;
}
