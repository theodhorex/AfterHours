/**
 * Multi-city world runner for AfterHours simulation.
 * Pure orchestration of multi-city stepping, inter-city caravans, and verifiable checkpoints.
 * Erasable TypeScript only, zero external dependencies, BigInt arithmetic.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "./arc.ts";
import { genesis } from "./genesis.ts";
import { parsePricingRules } from "./pricing.ts";
import { parseGrowthRules } from "./growth.ts";
import { step } from "./step.ts";
import { cityRoot, nextStateRoot, eventRoot, genesisPrevRoot } from "./roots.ts";
import { buildCheckpoint } from "./checkpoint.ts";
import { planCaravan, applyCaravan } from "./caravan.ts";
import type { ArcFile, CityState, SimEvent } from "./types.ts";
import type { Checkpoint, ItemFlow } from "./checkpoint.ts";
import type { PricingRules } from "./pricing.ts";
import type { GrowthRules } from "./growth.ts";

export interface WorldCityConfig {
  cityId: string;
  arcId: string;
  seed: string;
}

export interface CaravanRoute {
  from: string;
  to: string;
  item: string;
  maxQty: bigint;
}

export interface WorldConfig {
  cities: WorldCityConfig[];
  steps: number;
  window: number;
  caravanEvery?: number;
  routes?: CaravanRoute[];
  dataDir?: string;
  pricing?: PricingRules;
  growth?: GrowthRules;
  arcs?: Record<string, ArcFile>;
}

export interface WorldCityResult {
  cityId: string;
  state: CityState;
  events: SimEvent[];
  roots: string[];
  checkpoints: Checkpoint[];
}

export interface RunWorldResult {
  cities: Record<string, WorldCityResult>;
  checkpoints: Record<string, Checkpoint[]>;
  states: Record<string, CityState>;
  events: Record<string, SimEvent[]>;
  roots: Record<string, string[]>;
}

export interface CaravanSyntheticEvent extends SimEvent {
  event: "caravan_out" | "caravan_in";
  kind: "caravan_out" | "caravan_in";
  city_id: string;
  step: number;
  item: string;
  qty: string;
  unitPrice: string;
  counterparty: string;
}

/**
 * Runs a multi-city world simulation for cfg.steps steps in windows of cfg.window.
 * Every cfg.caravanEvery steps, evaluates cfg.routes between cities.
 * Emits deterministic checkpoints committing engine flows and caravan flows.
 */
export function runWorld(cfg: WorldConfig): RunWorldResult {
  if (cfg.steps <= 0 || cfg.window <= 0) {
    throw new RangeError(`steps (${cfg.steps}) and window (${cfg.window}) must be positive`);
  }
  if (cfg.steps % cfg.window !== 0) {
    throw new RangeError(`steps (${cfg.steps}) must be divisible by window (${cfg.window})`);
  }

  const dir = cfg.dataDir ?? join(process.cwd(), "data");
  const pricing = cfg.pricing ?? parsePricingRules(readFileSync(join(dir, "pricing.rules.json"), "utf-8"));
  const growth = cfg.growth ?? parseGrowthRules(JSON.parse(readFileSync(join(dir, "growth.rules.json"), "utf-8")));

  const arcCache = new Map<string, ArcFile>();
  if (cfg.arcs) {
    for (const [id, arc] of Object.entries(cfg.arcs)) {
      arcCache.set(id, arc);
    }
  }

  const getArc = (arcId: string): ArcFile => {
    let arc = arcCache.get(arcId);
    if (!arc) {
      const raw = JSON.parse(readFileSync(join(dir, "arcs", `${arcId}.json`), "utf-8"));
      arc = parseArc(raw);
      arcCache.set(arcId, arc);
    }
    return arc;
  };

  const cityOrder = cfg.cities.map((c) => c.cityId);
  const cityArcs: Record<string, ArcFile> = {};
  const cityStates: Record<string, CityState> = {};
  const cityPrevRoots: Record<string, string> = {};
  const allCityEvents: Record<string, SimEvent[]> = {};
  const cityRoots: Record<string, string[]> = {};
  const cityCheckpoints: Record<string, Checkpoint[]> = {};

  for (const c of cfg.cities) {
    const arc = getArc(c.arcId);
    cityArcs[c.cityId] = arc;
    cityStates[c.cityId] = genesis(arc, c.cityId, c.seed);
    cityPrevRoots[c.cityId] = genesisPrevRoot(c.cityId, c.seed);
    allCityEvents[c.cityId] = [];
    cityRoots[c.cityId] = [];
    cityCheckpoints[c.cityId] = [];
  }

  const numWindows = cfg.steps / cfg.window;

  for (let w = 0; w < numWindows; w++) {
    const windowPrevStates: Record<string, CityState> = {};
    const windowEvents: Record<string, SimEvent[]> = {};
    const lastStateRoots: Record<string, string> = {};
    const caravanSunkItems: Record<string, Record<string, bigint>> = {};
    const caravanSourcedItems: Record<string, Record<string, bigint>> = {};
    const caravanCoinSourced: Record<string, bigint> = {};
    const caravanCoinSunk: Record<string, bigint> = {};

    for (const id of cityOrder) {
      windowPrevStates[id] = cityStates[id];
      windowEvents[id] = [];
      lastStateRoots[id] = cityPrevRoots[id];
      caravanSunkItems[id] = {};
      caravanSourcedItems[id] = {};
      caravanCoinSourced[id] = 0n;
      caravanCoinSunk[id] = 0n;
    }

    for (let s = 0; s < cfg.window; s++) {
      const stepEventsMap: Record<string, SimEvent[]> = {};

      // 1. Step each city with engine step
      for (const id of cityOrder) {
        const ctx = { arc: cityArcs[id], pricing, growth };
        const res = step(cityStates[id], ctx);
        cityStates[id] = res.state;
        stepEventsMap[id] = [...res.events];
      }

      // 2. Caravan trade phase (after step, before roots)
      const currentStep = cityStates[cityOrder[0]].step;
      const canRunCaravans =
        cfg.caravanEvery !== undefined &&
        cfg.caravanEvery > 0 &&
        currentStep % cfg.caravanEvery === 0 &&
        cfg.routes &&
        cfg.routes.length > 0;

      if (canRunCaravans && cfg.routes) {
        for (const route of cfg.routes) {
          if (route.from === route.to) continue;
          const a = cityStates[route.from];
          const b = cityStates[route.to];
          if (!a || !b) continue;

          const ctxA = { arc: cityArcs[route.from] };
          const ctxB = { arc: cityArcs[route.to] };
          const plan = planCaravan(a, b, ctxA, ctxB, route.item, route.maxQty);
          if (!plan || plan.qty <= 0n) continue;

          const applied = applyCaravan(a, b, plan, route.item);
          cityStates[route.from] = applied.a;
          cityStates[route.to] = applied.b;

          // Record synthetic caravan events
          const eventOut: CaravanSyntheticEvent = {
            event: "caravan_out",
            kind: "caravan_out",
            city_id: route.from,
            step: currentStep,
            item: route.item,
            qty: plan.qty.toString(),
            unitPrice: plan.unitPrice.toString(),
            counterparty: route.to,
          };

          const eventIn: CaravanSyntheticEvent = {
            event: "caravan_in",
            kind: "caravan_in",
            city_id: route.to,
            step: currentStep,
            item: route.item,
            qty: plan.qty.toString(),
            unitPrice: plan.unitPrice.toString(),
            counterparty: route.from,
          };

          stepEventsMap[route.from].push(eventOut);
          stepEventsMap[route.to].push(eventIn);

          // Track window flows for checkpoint
          caravanSunkItems[route.from][route.item] =
            (caravanSunkItems[route.from][route.item] ?? 0n) + plan.qty;
          caravanCoinSourced[route.from] += plan.coin;

          caravanSourcedItems[route.to][route.item] =
            (caravanSourcedItems[route.to][route.item] ?? 0n) + plan.qty;
          caravanCoinSunk[route.to] += plan.coin;
        }
      }

      // 3. Roots phase per city
      for (const id of cityOrder) {
        const events = stepEventsMap[id];
        const eRoot = eventRoot(events);
        const cRoot = cityRoot(cityStates[id]);
        const sRoot = nextStateRoot(cityPrevRoots[id], cityStates[id].step, eRoot, cRoot);

        cityRoots[id].push(sRoot);
        cityPrevRoots[id] = sRoot;
        lastStateRoots[id] = sRoot;

        windowEvents[id].push(...events);
        allCityEvents[id].push(...events);
      }
    }

    // 4. Window checkpoint construction & flow merging
    for (const id of cityOrder) {
      const cp = buildCheckpoint({
        prev: windowPrevStates[id],
        next: cityStates[id],
        events: windowEvents[id],
        stateRoot: lastStateRoots[id],
      });

      // Merge caravan items flows
      const allCaravanItems = new Set<string>([
        ...Object.keys(caravanSunkItems[id]),
        ...Object.keys(caravanSourcedItems[id]),
      ]);

      for (const item of allCaravanItems) {
        const sunk = caravanSunkItems[id][item] ?? 0n;
        const sourced = caravanSourcedItems[id][item] ?? 0n;

        if (!cp.items[item]) {
          cp.items[item] = {
            produced: "0",
            consumed_recipe: "0",
            consumed_pop: "0",
            sourced: sourced.toString(),
            sunk: sunk.toString(),
            trade_to_players: "0",
            trade_from_players: "0",
          };
        } else {
          cp.items[item].sunk = (BigInt(cp.items[item].sunk) + sunk).toString();
          cp.items[item].sourced = (BigInt(cp.items[item].sourced) + sourced).toString();
        }
      }

      // Sort items keys deterministically
      const sortedItems: Record<string, ItemFlow> = {};
      for (const k of Object.keys(cp.items).sort()) {
        sortedItems[k] = cp.items[k];
      }
      cp.items = sortedItems;

      // Merge caravan coin flows
      cp.coin.sourced = (BigInt(cp.coin.sourced) + caravanCoinSourced[id]).toString();
      cp.coin.sunk = (BigInt(cp.coin.sunk) + caravanCoinSunk[id]).toString();

      cityCheckpoints[id].push(cp);
    }
  }

  const citiesResult: Record<string, WorldCityResult> = {};
  for (const id of cityOrder) {
    citiesResult[id] = {
      cityId: id,
      state: cityStates[id],
      events: allCityEvents[id],
      roots: cityRoots[id],
      checkpoints: cityCheckpoints[id],
    };
  }

  return {
    cities: citiesResult,
    checkpoints: cityCheckpoints,
    states: cityStates,
    events: allCityEvents,
    roots: cityRoots,
  };
}
