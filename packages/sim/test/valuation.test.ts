import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { runSteps } from "../src/run.ts";
import type { ArcFile, CityState, SimEvent } from "../src/types.ts";
import {
  EARNINGS_MULTIPLE_STEPS,
  incomeFromEvents,
  valueSector,
  valueCity,
  previewSale,
} from "../src/valuation.ts";

const CAVE_HOLD_PATH = join(import.meta.dirname, "../../../data/arcs/cave_hold.json");
const PRICING_PATH = join(import.meta.dirname, "../../../data/pricing.rules.json");
const GROWTH_PATH = join(import.meta.dirname, "../../../data/growth.rules.json");

function loadContext() {
  const arc = parseArc(JSON.parse(readFileSync(CAVE_HOLD_PATH, "utf8")));
  const pricing = parsePricingRules(JSON.parse(readFileSync(PRICING_PATH, "utf8")));
  const growth = parseGrowthRules(JSON.parse(readFileSync(GROWTH_PATH, "utf8")));
  return { arc, pricing, growth };
}

test("incomeFromEvents calculates net production value per business and per sector", () => {
  const { arc } = loadContext();
  // Recipe "farm" is in sector 0, inputs: {}, outputs: { grain: 4 }, wage: 1
  const events: SimEvent[] = [
    {
      event: "produced",
      city_id: "test_city",
      step: 1,
      business_id: "farm-0",
      recipe: "farm",
      runs: "2",
      consumed_recipe: {},
      produced: { grain: "8" },
      wage_paid: "2",
    },
  ];
  // Price of grain = 5n
  const prices = { grain: 5n };
  const income = incomeFromEvents(events, arc, prices);

  // 8 * 5 - 0 - 2 = 38n
  assert.equal(income.businesses["farm-0"], 38n);
  assert.equal(income.sectors[0], 38n);
  assert.equal(income.sectors[1], 0n);
});

test("genesis state valuation is deterministic and positive", () => {
  const { arc } = loadContext();
  const state1 = genesis(arc, "city_1", "seed_1");
  const state2 = genesis(arc, "city_1", "seed_1");

  const val1 = valueSector(state1, arc, 0, []);
  const val2 = valueSector(state2, arc, 0, []);

  assert.deepEqual(val1, val2);
  assert(val1.assetValue > 0n);
  assert.equal(val1.earningsValue, 0n); // empty window
  assert.equal(val1.total, val1.assetValue);
});

test("empty window gives assets only", () => {
  const { arc } = loadContext();
  const state = genesis(arc, "city_1", "seed_1");
  for (let s = 0; s < 6; s++) {
    const val = valueSector(state, arc, s, []);
    assert.equal(val.earningsValue, 0n);
    assert.equal(val.total, val.assetValue);
  }
});

test("inventory raises assetValue", () => {
  const { arc } = loadContext();
  const state = genesis(arc, "city_1", "seed_1");
  const before = valueSector(state, arc, 0, []);

  // Add 10 grain to the first business in sector 0
  const biz = state.sectors[0].businesses[0];
  biz.inventory.grain = 10n;
  const price = state.market.price.grain;
  assert(price !== undefined && price > 0n);
  const after = valueSector(state, arc, 0, []);

  assert.equal(after.assetValue, before.assetValue + 10n * price);
  assert.equal(after.total, before.total + 10n * price);
});

test("closing a business lowers earningsValue", () => {
  const ctx = loadContext();
  const state0 = genesis(ctx.arc, "city_1", "seed_1");
  const run = runSteps(state0, 20, ctx);

  // Both businesses open
  const before = valueSector(run.state, ctx.arc, 0, run.events);
  assert(before.earningsValue > 0n);

  // Close one business in sector 0
  const modifiedState: CityState = structuredClone(run.state);
  const openBiz = modifiedState.sectors[0].businesses.find((b) => b.open);
  assert(openBiz !== undefined);
  openBiz.open = false;

  const after = valueSector(modifiedState, ctx.arc, 0, run.events);
  assert(after.earningsValue < before.earningsValue);
});

test("sum of sector totals + treasury equals city value, citizens purse not included", () => {
  const ctx = loadContext();
  const state0 = genesis(ctx.arc, "city_1", "seed_1");
  const run = runSteps(state0, 20, ctx);
  // Give treasury some coins
  run.state.treasury = 500n;

  let sumSectorTotals = 0n;
  let sumSectorAssets = 0n;
  let sumSectorEarnings = 0n;
  for (let s = 0; s < 6; s++) {
    const val = valueSector(run.state, ctx.arc, s, run.events);
    sumSectorTotals += val.total;
    sumSectorAssets += val.assetValue;
    sumSectorEarnings += val.earningsValue;
  }

  const cityVal = valueCity(run.state, ctx.arc, run.events);
  assert.equal(cityVal.assetValue, sumSectorAssets + run.state.treasury);
  assert.equal(cityVal.earningsValue, sumSectorEarnings);
  assert.equal(cityVal.total, sumSectorTotals + run.state.treasury);

  // Verify citizens.purse is NOT included
  run.state.citizens.purse += 1000000n;
  const cityVal2 = valueCity(run.state, ctx.arc, run.events);
  assert.equal(cityVal.total, cityVal2.total);
});

test("previewSale: risk flag sells_critical_food positive and negative", () => {
  const ctx = loadContext();
  const state = genesis(ctx.arc, "city_1", "seed_1");

  // Synthetic events where sector 0 (food) produces 4000 bps of total city production
  const eventsHighFood: SimEvent[] = [
    {
      event: "produced",
      city_id: "city_1",
      step: 1,
      business_id: "farm-0",
      recipe: "farm",
      runs: "1",
      consumed_recipe: {},
      produced: { grain: "40" },
      wage_paid: "0",
    },
    {
      event: "produced",
      city_id: "city_1",
      step: 1,
      business_id: "mine-0",
      recipe: "mine",
      runs: "1",
      consumed_recipe: {},
      produced: { ore: "60" },
      wage_paid: "0",
    },
  ];
  // Prices: grain = 1n, ore = 1n. Total prod = 40 + 60 = 100. Food share = 40 / 100 = 4000 bps >= 3000 bps
  const previewPos = previewSale(state, ctx.arc, eventsHighFood, 0);
  assert(previewPos.riskFlags.includes("sells_critical_food"));

  // Negative 1: food sector but share < 3000 bps (e.g. food produces 20, mine produces 80 -> share 2000 bps)
  const eventsLowFood: SimEvent[] = [
    {
      event: "produced",
      city_id: "city_1",
      step: 1,
      business_id: "farm-0",
      recipe: "farm",
      runs: "1",
      consumed_recipe: {},
      produced: { grain: "20" },
      wage_paid: "0",
    },
    {
      event: "produced",
      city_id: "city_1",
      step: 1,
      business_id: "mine-0",
      recipe: "mine",
      runs: "1",
      consumed_recipe: {},
      produced: { ore: "80" },
      wage_paid: "0",
    },
  ];
  const previewNeg1 = previewSale(state, ctx.arc, eventsLowFood, 0);
  assert(!previewNeg1.riskFlags.includes("sells_critical_food"));

  // Negative 2: non-food sector (e.g. ore sector 1) with share >= 3000 bps
  const previewNeg2 = previewSale(state, ctx.arc, eventsHighFood, 1);
  assert(!previewNeg2.riskFlags.includes("sells_critical_food"));
});

test("previewSale: risk flag many_closed positive and negative", () => {
  const ctx = loadContext();
  const state = genesis(ctx.arc, "city_1", "seed_1");

  // Sector 0 has 3 businesses in cave_hold: farm-0, mill-0, bakery-0
  assert.equal(state.sectors[0].businesses.length, 3);

  // Negative: all open (0 closed)
  const prevAllOpen = previewSale(state, ctx.arc, [], 0);
  assert(!prevAllOpen.riskFlags.includes("many_closed"));
  assert.equal(prevAllOpen.openBusinesses, 3n);
  assert.equal(prevAllOpen.closedBusinesses, 0n);

  // Positive: 2 out of 3 closed (>= half)
  const modifiedState = structuredClone(state);
  modifiedState.sectors[0].businesses[0].open = false;
  modifiedState.sectors[0].businesses[1].open = false;
  const prevClosed = previewSale(modifiedState, ctx.arc, [], 0);
  assert(prevClosed.riskFlags.includes("many_closed"));
  assert.equal(prevClosed.openBusinesses, 1n);
  assert.equal(prevClosed.closedBusinesses, 2n);
});

test("previewSale: risk flag single_supplier positive and negative", () => {
  const ctx = loadContext();
  const state = genesis(ctx.arc, "city_1", "seed_1");

  // Sector 0 outputs grain (which sector 3 consumes).
  // In genesis cave_hold, there is exactly 1 farm producing grain -> single_supplier is true
  const prev1Supplier = previewSale(state, ctx.arc, [], 0);
  assert(prev1Supplier.riskFlags.includes("single_supplier"));

  // Negative: add a second open farm so 2 businesses produce grain in the city
  const modifiedState = structuredClone(state);
  modifiedState.sectors[0].businesses.push({
    id: "farm-1",
    recipe: "farm",
    open: true,
    coin: 100n,
    inventory: {},
    insolvent_steps: 0,
  });
  const prev2Suppliers = previewSale(modifiedState, ctx.arc, [], 0);
  assert(!prev2Suppliers.riskFlags.includes("single_supplier"));
});

test("previewSale: risk flag low_earnings positive and negative", () => {
  const ctx = loadContext();
  const state = genesis(ctx.arc, "city_1", "seed_1");

  // Negative: earningsValue >= 25% of assetValue
  // Asset value = 3 businesses * 100 coin = 300 coin. 25% = 75 coin.
  // With window of 1 step producing earnings of 2 coin -> earningsValue = 2 * 80 = 160 coin >= 75
  const highEarningsEvents: SimEvent[] = [
    {
      event: "produced",
      city_id: "city_1",
      step: 1,
      business_id: "farm-0",
      recipe: "farm",
      runs: "1",
      consumed_recipe: {},
      produced: { grain: "4" },
      wage_paid: "2",
    },
  ];
  const prevHigh = previewSale(state, ctx.arc, highEarningsEvents, 0);
  assert(!prevHigh.riskFlags.includes("low_earnings"));

  // Positive: empty window -> earningsValue = 0n < 25% of assetValue
  const prevLow = previewSale(state, ctx.arc, [], 0);
  assert(prevLow.riskFlags.includes("low_earnings"));
});

test("previewSale: risk flag input_dependent positive and negative", () => {
  const ctx = loadContext();
  const state = genesis(ctx.arc, "city_1", "seed_1");

  // Negative: Sector 0 has farm, mill, bakery. farm produces grain, mill produces flour.
  // Neither requires imports outside sector 0.
  const prevFood = previewSale(state, ctx.arc, [], 0);
  assert(!prevFood.riskFlags.includes("input_dependent"));
  assert.deepEqual(prevFood.importsNeeded, []);

  // Positive: Sector 2 (forge: smelter & smith) needs ore and hide which are produced in other sectors.
  const prevForge = previewSale(state, ctx.arc, [], 2);
  assert(prevForge.riskFlags.includes("input_dependent"));
  assert(prevForge.importsNeeded.includes("ore"));
  assert(prevForge.importsNeeded.includes("hide"));
});

test("previewSale: determinism across calls", () => {
  const ctx = loadContext();
  const state = genesis(ctx.arc, "city_1", "seed_1");
  const p1 = previewSale(state, ctx.arc, [], 0);
  const p2 = previewSale(state, ctx.arc, [], 0);
  assert.deepEqual(p1, p2);
});

test("previewSale: works for all 4 arcs at genesis and after 400 steps", () => {
  const arcIds = ["cave_hold", "dino_vale", "elf_grove", "goblin_warrens"];
  const pricing = parsePricingRules(JSON.parse(readFileSync(PRICING_PATH, "utf8")));
  const growth = parseGrowthRules(JSON.parse(readFileSync(GROWTH_PATH, "utf8")));

  for (const arcId of arcIds) {
    const arcPath = join(import.meta.dirname, `../../../data/arcs/${arcId}.json`);
    const arc = parseArc(JSON.parse(readFileSync(arcPath, "utf8")));
    const ctx = { arc, pricing, growth };

    // Genesis check
    const genesisState = genesis(arc, `city_${arcId}`, `seed_${arcId}`);
    for (let s = 0; s < 6; s++) {
      const prevGen = previewSale(genesisState, arc, [], s);
      assert.equal(prevGen.askPrice, prevGen.assetValue + prevGen.earningsValue);
      assert(Array.isArray(prevGen.importsNeeded));
      assert(Array.isArray(prevGen.exportsOffered));
      assert(Array.isArray(prevGen.dependents));
      assert(Array.isArray(prevGen.riskFlags));
    }

    // 400 steps run check
    const run = runSteps(genesisState, 400, ctx);
    // Use last 40 steps of events
    const last40Events = run.events.filter((e) => typeof e.step === "number" && e.step > 360);
    for (let s = 0; s < 6; s++) {
      const prev400 = previewSale(run.state, arc, last40Events, s);
      assert.equal(prev400.askPrice, prev400.assetValue + prev400.earningsValue);
      assert(prev400.sectorShareBps >= 0n && prev400.sectorShareBps <= 10000n);
      assert(prev400.openBusinesses >= 0n);
      assert(prev400.closedBusinesses >= 0n);
      // Risk flags must be sorted
      const sortedFlags = [...prev400.riskFlags].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      assert.deepEqual(prev400.riskFlags, sortedFlags);
    }
  }
});

