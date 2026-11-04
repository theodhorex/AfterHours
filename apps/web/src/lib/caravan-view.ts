/**
 * Pure Caravan View engine running multi-city trade simulation in the browser.
 * Zero external dependencies, pure BigInt math compatibility, no node:fs.
 */

import {
  genesis,
  checkConservation,
  runWorld,
} from "../../../../packages/sim/src/index.ts";
import {
  getArc,
  getPricingRules,
  getGrowthRules,
} from "./sim-adapter.ts";

export interface CaravanRow {
  step: number;
  item: string;
  qty: bigint;
  unitPrice: bigint;
  coin: bigint;
  fromCity: string;
  toCity: string;
  sunkA: bigint;
  sourcedB: bigint;
}

export interface CaravanViewResult {
  rows: CaravanRow[];
  finalTreasury: Record<string, bigint>;
  treasury: Record<string, bigint>;
  finalItems: Record<string, Record<string, bigint>>;
  items: Record<string, Record<string, bigint>>;
  conservationOk: boolean;
  cityConservation: Record<string, boolean>;
  totalExported: bigint;
  totalImported: bigint;
  totalCoinTraded: bigint;
  item: string;
  cfgSteps: number;
  every: number;
}

/**
 * Builds inter-city caravan view for Dino Vale -> Elf Grove.
 * Runs runWorld purely in browser using injected arcs and rules.
 * Computes per-window trade rows, final treasury/item totals, and checks conservation.
 */
export function buildCaravanView(
  cfgSteps: number = 400,
  every: number = 10,
  item: string = "bread"
): CaravanViewResult {
  const arcDino = getArc("dino_vale");
  const arcElf = getArc("elf_grove");
  const pricing = getPricingRules();
  const growth = getGrowthRules();

  const worldResult = runWorld({
    cities: [
      { cityId: "city-dino_vale", arcId: "dino_vale", seed: "demo" },
      { cityId: "city-elf_grove", arcId: "elf_grove", seed: "demo" },
    ],
    steps: cfgSteps,
    window: 40,
    caravanEvery: every,
    routes: [
      { from: "city-dino_vale", to: "city-elf_grove", item, maxQty: 50n },
    ],
    pricing,
    growth,
    arcs: {
      dino_vale: arcDino,
      elf_grove: arcElf,
    },
  });

  const rawCaravans = (worldResult.events["city-dino_vale"] ?? []).filter(
    (e) => e.event === "caravan_out"
  );

  const rows: CaravanRow[] = rawCaravans.map((e) => {
    const qty = BigInt(e.qty ?? "0");
    const unitPrice = BigInt(e.unitPrice ?? "0");
    const coin = qty * unitPrice;
    return {
      step: e.step,
      item: (e.item as string) ?? item,
      qty,
      unitPrice,
      coin,
      fromCity: e.city_id,
      toCity: (e.counterparty as string) ?? "city-elf_grove",
      sunkA: qty,
      sourcedB: qty,
    };
  });

  let conservationOk = true;
  const cityConservation: Record<string, boolean> = {};

  for (const cityId of ["city-dino_vale", "city-elf_grove"]) {
    const arc = cityId === "city-dino_vale" ? arcDino : arcElf;
    const gen = genesis(arc, cityId, "demo");
    let running = { items: { ...gen.totals.items }, coin: gen.totals.coin };
    let cityOk = true;

    try {
      for (const cp of worldResult.checkpoints[cityId] ?? []) {
        running = checkConservation(running, cp);
      }
      const finalState = worldResult.states[cityId];
      if (running.coin !== finalState.totals.coin) {
        cityOk = false;
      }
      for (const [k, v] of Object.entries(finalState.totals.items)) {
        if ((running.items[k] ?? 0n) !== v) {
          cityOk = false;
        }
      }
    } catch {
      cityOk = false;
    }

    cityConservation[cityId] = cityOk;
    if (!cityOk) {
      conservationOk = false;
    }
  }

  const finalTreasury: Record<string, bigint> = {
    "city-dino_vale": worldResult.states["city-dino_vale"].treasury,
    "city-elf_grove": worldResult.states["city-elf_grove"].treasury,
  };

  const finalItems: Record<string, Record<string, bigint>> = {
    "city-dino_vale": { ...worldResult.states["city-dino_vale"].totals.items },
    "city-elf_grove": { ...worldResult.states["city-elf_grove"].totals.items },
  };

  let totalExported = 0n;
  let totalImported = 0n;
  let totalCoinTraded = 0n;
  for (const r of rows) {
    totalExported += r.qty;
    totalImported += r.qty;
    totalCoinTraded += r.coin;
  }

  return {
    rows,
    finalTreasury,
    treasury: finalTreasury,
    finalItems,
    items: finalItems,
    conservationOk,
    cityConservation,
    totalExported,
    totalImported,
    totalCoinTraded,
    item,
    cfgSteps,
    every,
  };
}
