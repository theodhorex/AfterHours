import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import type { CityState } from "../src/types.ts";

const CAVE_HOLD_PATH = join(import.meta.dirname, "../../../data/arcs/cave_hold.json");
const GOBLIN_WARRENS_PATH = join(import.meta.dirname, "../../../data/arcs/goblin_warrens.json");

function loadArc(path: string) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return parseArc(raw);
}

test("genesis creates valid step-0 state for cave_hold", () => {
  const arc = loadArc(CAVE_HOLD_PATH);
  const city = genesis(arc, "cave_hold_alpha", "seed_123");

  assert.equal(city.city_id, "cave_hold_alpha");
  assert.equal(city.arc_id, "cave_hold");
  assert.equal(city.step, 0);
  assert.equal(city.stage, 0);
  assert.equal(city.world_seed, "seed_123");
  assert.equal(city.treasury, 0n);

  // Sectors
  assert.equal(city.sectors.length, 6);
  for (let i = 0; i < 6; i++) {
    const sector = city.sectors[i];
    assert.equal(sector.idx, i);
    assert.equal(sector.kind, arc.sectors[i].kind);
    assert.equal(sector.owner, null);
    assert.equal(sector.arc_origin, arc.id);
    assert.deepEqual(sector.rules, []);
    // Businesses in sector sorted by id
    const ids = sector.businesses.map((b) => b.id);
    const sortedIds = [...ids].sort();
    assert.deepEqual(ids, sortedIds);
  }

  // Count total businesses across sectors
  const totalBusinesses = city.sectors.reduce((sum, s) => sum + s.businesses.length, 0);
  const expectedTotal = Object.values(arc.genesis.starting_businesses).reduce(
    (sum, count) => sum + Number(count),
    0
  );
  assert.equal(totalBusinesses, expectedTotal);

  // Each business has expected initial fields
  for (const sector of city.sectors) {
    for (const b of sector.businesses) {
      assert.equal(b.open, true);
      assert.equal(b.coin, arc.genesis.coin_per_business);
      assert.deepEqual(b.inventory, {});
      assert.equal(b.insolvent_steps, 0);
    }
  }

  // Citizens
  assert.equal(city.citizens.population, arc.citizens.start_population);
  assert.equal(city.citizens.satisfaction_bps, 8000n);
  assert.equal(city.citizens.purse, arc.genesis.coin_citizens);

  // Market
  for (const item of arc.items) {
    assert.equal(city.market.price[item.id], item.base_price);
    assert.equal(city.market.demand_ema[item.id], 0n);
    assert.equal(city.totals.items[item.id], 0n);
  }

  // Conservation formula for totals.coin
  const businessCoinSum = city.sectors
    .flatMap((s) => s.businesses)
    .reduce((sum, b) => sum + b.coin, 0n);
  const expectedCoin = businessCoinSum + city.citizens.purse;
  assert.equal(city.totals.coin, expectedCoin);
});

test("genesis creates valid step-0 state for goblin_warrens", () => {
  const arc = loadArc(GOBLIN_WARRENS_PATH);
  const city = genesis(arc, "goblin_city", "goblin_seed");

  assert.equal(city.city_id, "goblin_city");
  assert.equal(city.arc_id, "goblin_warrens");
  assert.equal(city.sectors.length, 6);
  assert.equal(city.citizens.population, arc.citizens.start_population);
  assert.equal(city.citizens.satisfaction_bps, 8000n);
  assert.equal(city.citizens.purse, arc.genesis.coin_citizens);

  const businessCoinSum = city.sectors
    .flatMap((s) => s.businesses)
    .reduce((sum, b) => sum + b.coin, 0n);
  assert.equal(city.totals.coin, businessCoinSum + city.citizens.purse);
});

test("genesis is pure and deterministic: two calls produce deep-equal states", () => {
  const arc = loadArc(CAVE_HOLD_PATH);
  const state1 = genesis(arc, "city_test", "seed_test");
  const state2 = genesis(arc, "city_test", "seed_test");

  assert.deepEqual(state1, state2);
});

test("genesis produces r-0 ... r-(n-1) ids placed in the recipe sector", () => {
  const arc = loadArc(CAVE_HOLD_PATH);
  // Clone arc and customize starting_businesses with n > 1
  const customArc = {
    ...arc,
    genesis: {
      ...arc.genesis,
      starting_businesses: {
        farm: 3n,
        mill: 2n,
      },
    },
  };
  const city = genesis(customArc, "test_multi", "seed");
  // farm sector is 0, mill sector is 0
  const sector0 = city.sectors[0];
  const farmIds = sector0.businesses.filter((b) => b.recipe === "farm").map((b) => b.id);
  const millIds = sector0.businesses.filter((b) => b.recipe === "mill").map((b) => b.id);

  assert.deepEqual(farmIds, ["farm-0", "farm-1", "farm-2"]);
  assert.deepEqual(millIds, ["mill-0", "mill-1"]);
});
