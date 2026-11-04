import type { ArcFile, Business, CityState, SectorState } from "./types.ts";

/**
 * Creates the initial step-0 CityState from an ArcFile, city identifier, and world seed.
 * Pure and deterministic.
 */
export function genesis(arc: ArcFile, cityId: string, worldSeed: string): CityState {
  // Map recipes to their sector index
  const recipeSectorMap = new Map<string, number>();
  for (const recipe of arc.recipes) {
    recipeSectorMap.set(recipe.id, recipe.sector);
  }

  // Group businesses by sector
  const sectorBusinesses: Business[][] = Array.from({ length: 6 }, () => []);

  // Sort recipe keys for absolute determinism
  const recipeIds = Object.keys(arc.genesis.starting_businesses).sort();
  for (const recipeId of recipeIds) {
    const count = Number(arc.genesis.starting_businesses[recipeId]);
    const sectorIdx = recipeSectorMap.get(recipeId);
    if (sectorIdx === undefined || sectorIdx < 0 || sectorIdx > 5) {
      throw new Error(`Recipe '${recipeId}' has invalid sector index: ${sectorIdx}`);
    }

    for (let i = 0; i < count; i++) {
      const business: Business = {
        id: `${recipeId}-${i}`,
        recipe: recipeId,
        open: true,
        coin: arc.genesis.coin_per_business,
        inventory: {},
        insolvent_steps: 0,
      };
      sectorBusinesses[sectorIdx].push(business);
    }
  }

  // Sort businesses by id within each sector
  for (let s = 0; s < 6; s++) {
    sectorBusinesses[s].sort((a, b) => a.id.localeCompare(b.id));
  }

  // Build the 6 SectorStates
  const sectors = Array.from({ length: 6 }, (_, idx): SectorState => {
    const arcSector = arc.sectors.find((s) => s.idx === idx) ?? arc.sectors[idx];
    return {
      idx,
      kind: arcSector.kind,
      owner: null,
      arc_origin: arc.id,
      businesses: sectorBusinesses[idx],
      rules: [],
    };
  }) as [SectorState, SectorState, SectorState, SectorState, SectorState, SectorState];

  // Market initialization
  const price: Record<string, bigint> = {};
  const demand_ema: Record<string, bigint> = {};
  const itemsTotal: Record<string, bigint> = {};

  for (const item of arc.items) {
    price[item.id] = item.base_price;
    demand_ema[item.id] = 0n;
    itemsTotal[item.id] = 0n;
  }

  // Total coin calculation:
  // The genesis endowment is the sum of all business starting coin and citizen purse.
  // It represents the single initial source of coin for the city simulation.
  let totalBusinessCoin = 0n;
  for (const s of sectorBusinesses) {
    for (const b of s) {
      totalBusinessCoin += b.coin;
    }
  }
  const totalsCoin = totalBusinessCoin + arc.genesis.coin_citizens;

  return {
    city_id: cityId,
    arc_id: arc.id,
    step: 0,
    world_seed: worldSeed,
    stage: 0,
    sectors,
    citizens: {
      population: arc.citizens.start_population,
      satisfaction_bps: 8000n,
      purse: arc.genesis.coin_citizens,
    },
    market: {
      price,
      demand_ema,
    },
    treasury: 0n,
    totals: {
      items: itemsTotal,
      coin: totalsCoin,
    },
  };
}
