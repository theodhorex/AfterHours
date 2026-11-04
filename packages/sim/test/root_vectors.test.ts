import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sectorRoot, cityCore, cityRoot, sectorProof, verifySectorProof } from "../src/roots.ts";
import type { CityState, SectorState, Business } from "../src/types.ts";

const FIXTURE_PATH = join(import.meta.dirname, "../../../data/fixtures/root_vectors.json");

function parseFixtureState(rawState: any): CityState {
  const sectors = rawState.sectors.map((s: any): SectorState => ({
    idx: Number(s.idx),
    kind: s.kind,
    owner: s.owner,
    arc_origin: s.arc_origin,
    businesses: s.businesses.map((b: any): Business => {
      const inv: Record<string, bigint> = {};
      for (const [k, v] of Object.entries(b.inventory)) {
        inv[k] = BigInt(v as string);
      }
      return {
        id: b.id,
        recipe: b.recipe,
        open: Boolean(b.open),
        coin: BigInt(b.coin),
        inventory: inv,
        insolvent_steps: Number(b.insolvent_steps),
      };
    }),
    rules: s.rules,
  })) as [SectorState, SectorState, SectorState, SectorState, SectorState, SectorState];

  const price: Record<string, bigint> = {};
  for (const [k, v] of Object.entries(rawState.market.price)) {
    price[k] = BigInt(v as string);
  }
  const demand_ema: Record<string, bigint> = {};
  for (const [k, v] of Object.entries(rawState.market.demand_ema)) {
    demand_ema[k] = BigInt(v as string);
  }
  const totalsItems: Record<string, bigint> = {};
  for (const [k, v] of Object.entries(rawState.totals.items)) {
    totalsItems[k] = BigInt(v as string);
  }

  return {
    city_id: rawState.city_id,
    arc_id: rawState.arc_id,
    step: Number(rawState.step),
    world_seed: rawState.world_seed,
    stage: Number(rawState.stage),
    sectors,
    citizens: {
      population: BigInt(rawState.citizens.population),
      satisfaction_bps: BigInt(rawState.citizens.satisfaction_bps),
      purse: BigInt(rawState.citizens.purse),
    },
    market: {
      price,
      demand_ema,
    },
    treasury: BigInt(rawState.treasury),
    totals: {
      items: totalsItems,
      coin: BigInt(rawState.totals.coin),
    },
  };
}

test("root vectors: TypeScript roots match Python-generated vectors exactly", () => {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const state = parseFixtureState(raw.state);

  // Compare sector roots
  for (let i = 0; i < 6; i++) {
    const tsSectorRoot = sectorRoot(state.sectors[i]);
    const pySectorRoot = raw.sector_roots[i];
    assert.equal(
      tsSectorRoot,
      pySectorRoot,
      `Sector ${i} root mismatch between TS and Python`
    );
  }

  // Compare city core
  const tsCore = cityCore(state);
  assert.equal(tsCore, raw.city_core, "City core mismatch between TS and Python");

  // Compare city root
  const tsCityRoot = cityRoot(state);
  assert.equal(tsCityRoot, raw.city_root, "City root mismatch between TS and Python");

  // Verify all 6 sector proofs with the Python roots
  for (let idx = 0; idx < 6; idx++) {
    const proof = sectorProof(state, idx);
    const valid = verifySectorProof(raw.sector_roots[idx], proof, raw.city_root);
    assert.equal(valid, true, `Proof verification failed for sector ${idx}`);
  }
});
