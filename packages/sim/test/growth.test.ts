import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step } from "../src/step.ts";
import type { CityState } from "../src/types.ts";

const pricingJson = readFileSync(join(process.cwd(), "data/pricing.rules.json"), "utf-8");
const pricing = parsePricingRules(pricingJson);

const growthJson = readFileSync(join(process.cwd(), "data/growth.rules.json"), "utf-8");
const growth = parseGrowthRules(growthJson);

const goblinArcJson = readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8");
const goblinArc = parseArc(JSON.parse(goblinArcJson));

test("parseGrowthRules parses valid data/growth.rules.json", () => {
  const parsed = parseGrowthRules(growthJson);
  assert.equal(parsed.version, 0);
  assert.equal(parsed.idle_close_steps, 40);
  assert.equal(parsed.entry_price_premium_bps, 1000n);
  assert.equal(parsed.entry_min_margin_bps, 2000n);
  assert.equal(parsed.entry_purse_reserve, 3000n);
  assert.equal(parsed.growth_min_satisfaction_bps, 8000n);
  assert.equal(parsed.growth_bps, 150n);
  assert.equal(parsed.shrink_max_satisfaction_bps, 3000n);
  assert.equal(parsed.shrink_bps, 300n);
  assert.equal(parsed.min_population, 10n);
  assert.equal(parsed.stage_min_satisfaction_bps, 6000n);
});

test("parseGrowthRules throws on invalid variants (2 per field class)", () => {
  const base = JSON.parse(growthJson);

  // 1. Version class
  assert.throws(
    () => parseGrowthRules({ ...base, version: -1 }),
    /version/,
    "Negative version must throw"
  );
  assert.throws(
    () => parseGrowthRules({ ...base, version: 1.5 }),
    /version/,
    "Non-integer version must throw"
  );

  // 2. Step counts class (idle_close_steps)
  assert.throws(
    () => parseGrowthRules({ ...base, idle_close_steps: 0 }),
    /idle_close_steps/,
    "idle_close_steps <= 0 must throw"
  );
  assert.throws(
    () => parseGrowthRules({ ...base, idle_close_steps: "eight" }),
    /idle_close_steps/,
    "Non-number idle_close_steps must throw"
  );

  // 3. Coin class (entry_purse_reserve)
  assert.throws(
    () => parseGrowthRules({ ...base, entry_purse_reserve: -100 }),
    /entry_purse_reserve/,
    "Negative entry_purse_reserve must throw"
  );
  assert.throws(
    () => parseGrowthRules({ ...base, entry_purse_reserve: "foo" }),
    /entry_purse_reserve/,
    "Non-numeric entry_purse_reserve must throw"
  );

  // 4. Bps rates class (satisfaction bps, margin bps, growth bps)
  assert.throws(
    () => parseGrowthRules({ ...base, growth_min_satisfaction_bps: 10001 }),
    /growth_min_satisfaction_bps/,
    "Satisfaction bps > 10000 must throw"
  );
  assert.throws(
    () => parseGrowthRules({ ...base, growth_bps: -10 }),
    /growth_bps/,
    "Negative growth_bps must throw"
  );

  // 5. Population class (min_population)
  assert.throws(
    () => parseGrowthRules({ ...base, min_population: 0 }),
    /min_population/,
    "min_population <= 0 must throw"
  );
  assert.throws(
    () => parseGrowthRules({ ...base, min_population: "ten" }),
    /min_population/,
    "Non-numeric min_population must throw"
  );
});

test("closure: a business forced idle closes after exactly idle_close_steps steps", () => {
  const s0 = genesis(goblinArc, "city-test-closure", "seed-c1");
  // Find a business that needs input, e.g. mill (needs grain)
  // Ensure there is no grain in the entire city so mill can never produce or buy
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      delete b.inventory["grain"];
      delete b.inventory["flour"];
      if (b.recipe === "farm") {
        // Close farms so no grain is ever produced
        b.open = false;
      }
    }
  }

  let curr: CityState = s0;
  const idleLimit = growth.idle_close_steps;
  for (let stepIdx = 1; stepIdx < idleLimit; stepIdx++) {
    const res = step(curr, { arc: goblinArc, pricing, growth });
    curr = res.state;
    const mill = curr.sectors[0].businesses.find((b) => b.recipe === "mill")!;
    assert.equal(mill.open, true, `Mill should remain open at step ${stepIdx}`);
    assert.equal(mill.insolvent_steps, stepIdx, `Insolvent steps should be ${stepIdx}`);
    const closedEvent = res.events.find(
      (e) => e.event === "business_closed" && e.business_id === mill.id
    );
    assert.equal(closedEvent, undefined, `No business_closed event before step ${idleLimit}`);
  }

  // The mill reaches idle_close_steps insolvent steps and closes
  const res8 = step(curr, { arc: goblinArc, pricing, growth });
  curr = res8.state;
  const mill = curr.sectors[0].businesses.find((b) => b.recipe === "mill")!;
  assert.equal(mill.open, false, `Mill must close at step ${idleLimit}`);
  const closedEvent = res8.events.find(
    (e) => e.event === "business_closed" && e.business_id === mill.id
  );
  assert.ok(closedEvent, `business_closed event must be emitted at step ${idleLimit}`);
  assert.equal(closedEvent!.recipe, "mill");
});

test("closure: a producing business never closes", () => {
  const s0 = genesis(goblinArc, "city-test-prod", "seed-c2");
  // Give farm abundant coin and let it produce
  let curr = s0;
  for (let s = 1; s <= 20; s++) {
    const res = step(curr, { arc: goblinArc, pricing, growth });
    curr = res.state;
    const farm = curr.sectors[0].businesses.find((b) => b.recipe === "farm")!;
    assert.equal(farm.open, true, `Farm must remain open at step ${s}`);
    assert.equal(farm.insolvent_steps, 0, `Farm insolvent_steps must be reset to 0`);
  }
});

test("auction: inventory and coin move correctly and conserve totals", () => {
  const s0 = genesis(goblinArc, "city-test-auction", "seed-c3");
  // Add mill-1 so there is a buyer for grain
  const mill1 = {
    id: "mill-1",
    recipe: "mill",
    open: true,
    coin: 1000n,
    inventory: {},
    insolvent_steps: 0,
  };
  s0.sectors[0].businesses.push(mill1);
  s0.sectors[0].businesses.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const mill0 = s0.sectors[0].businesses.find((b) => b.id === "mill-0")!;
  mill0.insolvent_steps = growth.idle_close_steps - 1;
  mill0.coin = 0n;
  mill0.inventory["grain"] = 5n;

  // Sync totals
  let actualCoin = s0.citizens.purse + s0.treasury;
  for (const sec of s0.sectors) for (const b of sec.businesses) actualCoin += b.coin;
  s0.totals.coin = actualCoin;

  s0.totals.items["grain"] = (s0.totals.items["grain"] ?? 0n) + 5n;
  const initialTotalCoin = s0.totals.coin;
  const initialGrainTotal = s0.totals.items["grain"] ?? 0n;

  const res = step(s0, { arc: goblinArc, pricing, growth });
  const s1 = res.state;

  const nextMill0 = s1.sectors[0].businesses.find((b) => b.id === "mill-0")!;
  const nextMill1 = s1.sectors[0].businesses.find((b) => b.id === "mill-1")!;

  assert.equal(nextMill0.open, false, "mill-0 should have closed");
  assert.equal(nextMill1.open, true, "mill-1 should remain open");
  // mill-1 should have bought grain from mill-0 in auction
  assert.ok((nextMill1.inventory["grain"] ?? 0n) > 0n, "mill-1 should have acquired grain");
  assert.ok(nextMill0.coin > 0n, "mill-0 should have received coin from auction");

  // Verify conservation
  let sumCoin = s1.citizens.purse + s1.treasury;
  for (const sec of s1.sectors) {
    for (const b of sec.businesses) {
      sumCoin += b.coin;
    }
  }
  assert.equal(sumCoin, initialTotalCoin, "Total coin must be conserved during auction");
});

test("closure: closed businesses are skipped everywhere", () => {
  const s0 = genesis(goblinArc, "city-test-skip", "seed-c4");
  const farm0 = s0.sectors[0].businesses.find((b) => b.id === "farm-0")!;
  farm0.open = false;
  farm0.inventory["grain"] = 100n;

  const res = step(s0, { arc: goblinArc, pricing, growth });
  // farm-0 must not have produced
  const prodEvent = res.events.find(
    (e) => e.event === "produced" && e.business_id === "farm-0"
  );
  assert.equal(prodEvent, undefined, "Closed business must not produce");
});

test("entry: opens exactly one qualifying business per step with highest margin", () => {
  const s0 = genesis(goblinArc, "city-test-entry", "seed-e1");
  // Set stage to 2 so max_businesses_per_sector is 4 (sector 0 currently has 3)
  s0.stage = 2;
  // Give citizens rich purse
  s0.citizens.purse = 50000n;
  // Elevate demand_ema for grain so price stays at cap after pricing update
  s0.market.demand_ema["grain"] = 50000n;
  // Close other businesses so no wages are paid
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      b.coin = 0n;
    }
  }

  const initialBusinessesCount = s0.sectors[0].businesses.length;
  const initialPurse = s0.citizens.purse;

  // Isolate entry: dividends and working-capital top-up also move purse coin (tested in dividends.test.ts)
  const entryOnly = { ...growth, dividend_bps: 0n, topup_floor_bps: 0n };
  const res = step(s0, { arc: goblinArc, pricing, growth: entryOnly });
  const s1 = res.state;

  assert.equal(
    s1.sectors[0].businesses.length,
    initialBusinessesCount + 1,
    "Exactly one new business should open"
  );
  const openedEvent = res.events.find((e) => e.event === "business_opened");
  assert.ok(openedEvent, "business_opened event must be emitted");
  assert.equal(openedEvent!.recipe, "farm");
  assert.equal(
    s1.citizens.purse,
    initialPurse - goblinArc.genesis.coin_per_business,
    "Coin must move from purse to business"
  );
});

test("entry guard: stage cap blocks entry", () => {
  const s0 = genesis(goblinArc, "city-test-cap", "seed-e2");
  s0.stage = 2;
  s0.citizens.purse = 50000n;
  s0.market.demand_ema["grain"] = 50000n;

  // Max businesses per sector in stage 2 is 4
  const maxBiz = Number(goblinArc.stages[2].max_businesses_per_sector);
  while (s0.sectors[0].businesses.length < maxBiz) {
    const idx = s0.sectors[0].businesses.length;
    s0.sectors[0].businesses.push({
      id: `filler-${idx}`,
      recipe: "farm",
      open: false,
      coin: 100n,
      inventory: {},
      insolvent_steps: 8,
    });
  }

  const res = step(s0, { arc: goblinArc, pricing, growth });
  const s1 = res.state;
  const openedEvent = res.events.find(
    (e) => e.event === "business_opened" && e.sector === 0
  );
  assert.equal(openedEvent, undefined, "Sector at cap cannot open business");
});

test("entry guard: purse reserve blocks entry", () => {
  const s0 = genesis(goblinArc, "city-test-reserve", "seed-e3");
  s0.stage = 2;
  // Set purse just below requirement (coin_per_business + entry_purse_reserve - 1)
  s0.citizens.purse = goblinArc.genesis.coin_per_business + growth.entry_purse_reserve - 1n;
  s0.market.demand_ema["grain"] = 50000n;
  // Zero business coins so no wages are paid
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      b.coin = 0n;
    }
  }

  const res = step(s0, { arc: goblinArc, pricing, growth });
  const openedEvent = res.events.find((e) => e.event === "business_opened");
  assert.equal(openedEvent, undefined, "Insufficient purse reserve must block entry");
});

test("entry guard: margin threshold blocks entry", () => {
  const s0 = genesis(goblinArc, "city-test-margin", "seed-e4");
  s0.stage = 2;
  s0.citizens.purse = 50000n;
  s0.market.demand_ema["grain"] = 50000n;
  const highMarginGrowth = { ...growth, entry_min_margin_bps: 999999n };
  const res = step(s0, { arc: goblinArc, pricing, growth: highMarginGrowth });
  const openedEvent = res.events.find((e) => e.event === "business_opened");
  assert.equal(openedEvent, undefined, "Margin below threshold must block entry");
});

test("population: grows when satisfaction >= growth_min_satisfaction_bps", () => {
  const s0 = genesis(goblinArc, "city-test-pop-grow", "seed-p1");
  // Give businesses abundant stock of all citizen needs so satisfaction is 100%
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      b.inventory["bread"] = 1000n;
      b.inventory["tool"] = 1000n;
      b.inventory["elixir"] = 1000n;
      b.inventory["gadget"] = 1000n;
    }
  }
  s0.citizens.purse = 50000n;
  s0.citizens.satisfaction_bps = 9000n;
  const initialPop = s0.citizens.population;

  const res = step(s0, { arc: goblinArc, pricing, growth });
  const s1 = res.state;

  assert.ok(s1.citizens.population > initialPop, "Population must grow");
  const popEvent = res.events.find((e) => e.event === "population_change");
  assert.ok(popEvent, "population_change event must be emitted");
  assert.equal(popEvent!.old, initialPop.toString());
  assert.equal(popEvent!.new, s1.citizens.population.toString());
});

test("population: shrinks when satisfaction <= shrink_max_satisfaction_bps, never below min_population", () => {
  const s0 = genesis(goblinArc, "city-test-pop-shrink", "seed-p2");
  // Close businesses so no production occurs and needs are completely unmet
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      b.open = false;
      b.inventory = {};
    }
  }
  s0.citizens.satisfaction_bps = 2000n;
  const initialPop = s0.citizens.population;

  const res = step(s0, { arc: goblinArc, pricing, growth });
  const s1 = res.state;

  assert.ok(s1.citizens.population < initialPop, "Population must shrink");
  const popEvent = res.events.find((e) => e.event === "population_change");
  assert.ok(popEvent, "population_change event must be emitted");

  // Test min_population floor
  s1.citizens.population = growth.min_population;
  s1.citizens.satisfaction_bps = 1000n;
  const resFloor = step(s1, { arc: goblinArc, pricing, growth });
  assert.equal(
    resFloor.state.citizens.population,
    growth.min_population,
    "Population must never drop below min_population"
  );
  const floorEvent = resFloor.events.find((e) => e.event === "population_change");
  assert.equal(floorEvent, undefined, "No population_change event when population is unchanged at floor");
});

test("stage: advances when population and satisfaction meet thresholds", () => {
  const s0 = genesis(goblinArc, "city-test-stage", "seed-st1");
  const targetMinPop = goblinArc.stages[1].min_population;
  s0.citizens.population = targetMinPop;
  // Give businesses goods so satisfaction stays high
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      b.inventory["bread"] = 1000n;
      b.inventory["tool"] = 1000n;
      b.inventory["elixir"] = 1000n;
      b.inventory["gadget"] = 1000n;
    }
  }
  s0.citizens.purse = 50000n;
  s0.citizens.satisfaction_bps = 9000n;
  assert.equal(s0.stage, 0);

  const res = step(s0, { arc: goblinArc, pricing, growth });
  const s1 = res.state;

  assert.equal(s1.stage, 1, "Stage should advance to 1");
  const stageEvent = res.events.find((e) => e.event === "stage_up");
  assert.ok(stageEvent, "stage_up event must be emitted");
});

test("stage negative: does not advance if population or satisfaction is insufficient", () => {
  const s0 = genesis(goblinArc, "city-test-stage-neg", "seed-st2");
  const targetMinPop = goblinArc.stages[1].min_population;

  // 1. Pop sufficient, but sat insufficient
  s0.citizens.population = targetMinPop;
  s0.citizens.satisfaction_bps = growth.stage_min_satisfaction_bps - 1n;
  const res1 = step(s0, { arc: goblinArc, pricing, growth });
  assert.equal(res1.state.stage, 0, "Low satisfaction must prevent stage up");

  // 2. Sat sufficient, but pop insufficient
  s0.citizens.population = targetMinPop - 1n;
  s0.citizens.satisfaction_bps = growth.stage_min_satisfaction_bps;
  const res2 = step(s0, { arc: goblinArc, pricing, growth });
  assert.equal(res2.state.stage, 0, "Low population must prevent stage up");
});

