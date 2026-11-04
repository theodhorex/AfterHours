import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { planCaravan, applyCaravan, type CaravanPlan } from "../src/caravan.ts";
import { checkConservation, type Checkpoint } from "../src/checkpoint.ts";
import type { ArcFile, CityState } from "../src/types.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const caveArc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs/cave_hold.json"), "utf-8")));
const elfArc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs/elf_grove.json"), "utf-8")));

function makeTwoCities(): { a: CityState; b: CityState; ctxA: { arc: ArcFile }; ctxB: { arc: ArcFile } } {
  const a = genesis(caveArc, "city-cave", "seed-cave-1");
  const b = genesis(elfArc, "city-elf", "seed-elf-1");

  // Give city A some grain inventory in its first business
  const bizA = a.sectors[0].businesses[0];
  bizA.inventory["grain"] = 500n;
  a.totals.items["grain"] = 500n;

  // Set market prices such that price in B > price in A
  a.market.price["grain"] = 10n;
  b.market.price["grain"] = 30n;

  // Give B some coin in treasury
  b.treasury = 2000n;
  b.totals.coin += 2000n;

  return { a, b, ctxA: { arc: caveArc }, ctxB: { arc: elfArc } };
}

test("planCaravan: happy path computes midpoint price and valid quantity", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  const plan = planCaravan(a, b, ctxA, ctxB, "grain", 50n);
  assert.ok(plan !== null);
  assert.equal(plan.unitPrice, 20n); // (10 + 30) / 2
  assert.equal(plan.qty, 50n);
  assert.equal(plan.coin, 1000n); // 50 * 20
});

test("planCaravan: returns null when item is unknown in either city", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  assert.equal(planCaravan(a, b, ctxA, ctxB, "non_existent_item", 10n), null);
});

test("planCaravan: returns null when price spread is not positive for seller", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  // Equal prices
  a.market.price["grain"] = 20n;
  b.market.price["grain"] = 20n;
  assert.equal(planCaravan(a, b, ctxA, ctxB, "grain", 10n), null);

  // Seller price higher than buyer price
  a.market.price["grain"] = 25n;
  b.market.price["grain"] = 20n;
  assert.equal(planCaravan(a, b, ctxA, ctxB, "grain", 10n), null);
});

test("planCaravan: returns null when seller has no surplus", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  // Reset grain in A to 0
  a.sectors[0].businesses[0].inventory["grain"] = 0n;
  a.totals.items["grain"] = 0n;

  assert.equal(planCaravan(a, b, ctxA, ctxB, "grain", 10n), null);
});

test("planCaravan: returns null when buyer cannot afford even 1 unit", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  b.treasury = 0n;
  b.citizens.purse = 5n; // unit price is 20n, so 5n < 20n
  b.totals.coin = 5n;

  assert.equal(planCaravan(a, b, ctxA, ctxB, "grain", 10n), null);
});

test("planCaravan: quantity bounded by buyer coin and seller surplus", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  // Buyer only has 100 coin total, unitPrice is 20n -> max 5 units
  b.treasury = 100n;
  b.citizens.purse = 0n;

  const planLimitedByCoin = planCaravan(a, b, ctxA, ctxB, "grain", 50n);
  assert.ok(planLimitedByCoin !== null);
  assert.equal(planLimitedByCoin.qty, 5n);
  assert.equal(planLimitedByCoin.coin, 100n);

  // Seller only has 3 units surplus
  a.sectors[0].businesses[0].inventory["grain"] = 3n;
  a.totals.items["grain"] = 3n;

  const planLimitedBySurplus = planCaravan(a, b, ctxA, ctxB, "grain", 50n);
  assert.ok(planLimitedBySurplus !== null);
  assert.equal(planLimitedBySurplus.qty, 3n);
  assert.equal(planLimitedBySurplus.coin, 60n);
});

function sumCityItems(s: CityState, item: string): bigint {
  let t = 0n;
  for (const sec of s.sectors) {
    for (const b of sec.businesses) {
      t += b.inventory[item] ?? 0n;
    }
  }
  return t;
}

function sumCityCoin(s: CityState): bigint {
  let t = s.citizens.purse + s.treasury;
  for (const sec of s.sectors) {
    for (const b of sec.businesses) {
      t += b.coin;
    }
  }
  return t;
}

test("applyCaravan: immutability, deterministic order, and conservation", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  // Distribute 40 grain across two businesses in A
  const sortedBizA = a.sectors.flatMap((s) => s.businesses).sort((x, y) => (x.id < y.id ? -1 : 1));
  sortedBizA[0].inventory["grain"] = 15n;
  sortedBizA[1].inventory["grain"] = 25n;
  a.totals.items["grain"] = 40n;

  const plan = planCaravan(a, b, ctxA, ctxB, "grain", 30n);
  assert.ok(plan !== null);
  assert.equal(plan.qty, 30n);

  const prevItemsA = sumCityItems(a, "grain");
  const prevItemsB = sumCityItems(b, "grain");
  const prevCoinA = sumCityCoin(a);
  const prevCoinB = sumCityCoin(b);

  const res = applyCaravan(a, b, plan, "grain");

  // Original states must not be mutated
  assert.equal(sumCityItems(a, "grain"), prevItemsA);
  assert.equal(sumCityCoin(a), prevCoinA);
  assert.equal(sumCityItems(b, "grain"), prevItemsB);
  assert.equal(sumCityCoin(b), prevCoinB);

  // In res.a: first biz drained of 15, second biz drained of 15 (leaving 10)
  const afterBizA = res.a.sectors.flatMap((s) => s.businesses).sort((x, y) => (x.id < y.id ? -1 : 1));
  assert.equal(afterBizA[0].inventory["grain"], undefined); // deleted when 0
  assert.equal(afterBizA[1].inventory["grain"], 10n);

  // In res.b: 30 added to first sector's first business
  const sector0BizB = [...res.b.sectors[0].businesses].sort((x, y) => (x.id < y.id ? -1 : 1));
  assert.equal(sector0BizB[0].inventory["grain"], 30n);

  // Totals change by exactly the flows
  assert.equal(res.a.totals.items["grain"], a.totals.items["grain"] - plan.qty);
  assert.equal(res.a.totals.coin, a.totals.coin + plan.coin);
  assert.equal(res.b.totals.items["grain"], (b.totals.items["grain"] ?? 0n) + plan.qty);
  assert.equal(res.b.totals.coin, b.totals.coin - plan.coin);

  // Sum of items and coin over both cities is conserved
  assert.equal(sumCityItems(res.a, "grain") + sumCityItems(res.b, "grain"), prevItemsA + prevItemsB);
  assert.equal(sumCityCoin(res.a) + sumCityCoin(res.b), prevCoinA + prevCoinB);

  // Flows shape and checkConservation validation
  assert.equal(res.flowsA.items["grain"].sunk, plan.qty.toString());
  assert.equal(res.flowsA.coin.sourced, plan.coin.toString());
  assert.equal(res.flowsB.items["grain"].sourced, plan.qty.toString());
  assert.equal(res.flowsB.coin.sunk, plan.coin.toString());

  const cpA: Checkpoint = {
    city_id: res.a.city_id,
    from_step: a.step,
    to_step: a.step,
    new_state_root: "0".repeat(64),
    new_city_root: "0".repeat(64),
    stage: res.a.stage,
    items: res.flowsA.items,
    coin: res.flowsA.coin,
    player_deltas: [],
    executed_order_ids: [],
  };
  const conservedA = checkConservation(a.totals, cpA);
  assert.equal(conservedA.coin, res.a.totals.coin);
  assert.equal(conservedA.items["grain"], res.a.totals.items["grain"]);

  const cpB: Checkpoint = {
    city_id: res.b.city_id,
    from_step: b.step,
    to_step: b.step,
    new_state_root: "0".repeat(64),
    new_city_root: "0".repeat(64),
    stage: res.b.stage,
    items: res.flowsB.items,
    coin: res.flowsB.coin,
    player_deltas: [],
    executed_order_ids: [],
  };
  const conservedB = checkConservation(b.totals, cpB);
  assert.equal(conservedB.coin, res.b.totals.coin);
  assert.equal(conservedB.items["grain"], res.b.totals.items["grain"]);
});

test("doubt-driven edge cases: zero qty, equal prices, insolvent buyer, insufficient inventory", () => {
  const { a, b, ctxA, ctxB } = makeTwoCities();

  // Edge case 1: zero qty plan to applyCaravan
  const zeroPlan: CaravanPlan = { qty: 0n, unitPrice: 20n, coin: 0n };
  const zeroRes = applyCaravan(a, b, zeroPlan, "grain");
  assert.equal(zeroRes.a.totals.coin, a.totals.coin);
  assert.equal(zeroRes.b.totals.coin, b.totals.coin);
  assert.equal(zeroRes.flowsA.items["grain"].sunk, "0");
  assert.equal(zeroRes.flowsB.items["grain"].sourced, "0");

  // Edge case 2: equal prices in planCaravan
  a.market.price["grain"] = 15n;
  b.market.price["grain"] = 15n;
  assert.equal(planCaravan(a, b, ctxA, ctxB, "grain", 10n), null);

  // Edge case 3: buyer completely insolvent
  b.market.price["grain"] = 30n;
  b.treasury = 0n;
  b.citizens.purse = 0n;
  assert.equal(planCaravan(a, b, ctxA, ctxB, "grain", 10n), null);

  // Edge case 4: applyCaravan with plan exceeding inventory throws RangeError
  const excessivePlan: CaravanPlan = { qty: 999999n, unitPrice: 20n, coin: 100n };
  assert.throws(() => applyCaravan(a, b, excessivePlan, "grain"), /INSUFFICIENT_INVENTORY/);

  // Edge case 5: applyCaravan with plan exceeding buyer coin throws RangeError
  const expensivePlan: CaravanPlan = { qty: 1n, unitPrice: 20n, coin: 999999n };
  assert.throws(() => applyCaravan(a, b, expensivePlan, "grain"), /INSUFFICIENT_COIN/);
});


