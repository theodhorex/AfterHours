import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parseGrowthRules, processDividends } from "../src/growth.ts";
import type { SimEvent } from "../src/types.ts";

const growthJson = JSON.parse(readFileSync(join(process.cwd(), "data/growth.rules.json"), "utf-8"));
const growth = parseGrowthRules(growthJson);
const arc = parseArc(JSON.parse(readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8")));
const reserve = (arc.genesis.coin_per_business * growth.dividend_reserve_bps) / 10000n;

function total(s: ReturnType<typeof genesis>): bigint {
  let t = s.citizens.purse + s.treasury;
  for (const sec of s.sectors) for (const b of sec.businesses) t += b.coin;
  return t;
}

test("dividends: parse rejects bad values", () => {
  assert.throws(() => parseGrowthRules({ ...growthJson, dividend_bps: 10001 }), /dividend_bps/);
  assert.throws(() => parseGrowthRules({ ...growthJson, dividend_bps: -1 }), /dividend_bps/);
  assert.throws(() => parseGrowthRules({ ...growthJson, dividend_reserve_bps: -5 }), /dividend_reserve_bps/);
  const { dividend_bps: _drop, ...missing } = growthJson;
  assert.throws(() => parseGrowthRules(missing), /dividend_bps/);
});

test("dividends: excess over the reserve flows to the purse, total coin conserved", () => {
  const s = genesis(arc, "c", "seed");
  const biz = s.sectors[0].businesses[0];
  biz.coin = reserve + 10000n;
  const before = total(s);
  const purse0 = s.citizens.purse;
  const events: SimEvent[] = [];
  processDividends(s, arc, growth, events);
  const expected = (10000n * growth.dividend_bps) / 10000n;
  assert.equal(biz.coin, reserve + 10000n - expected);
  assert.ok(s.citizens.purse >= purse0 + expected);
  assert.equal(total(s), before);
  assert.equal(events.filter((e) => e.event === "dividends_paid").length, 1);
});

test("dividends: a business at or below the reserve pays nothing, closed businesses pay nothing", () => {
  const s = genesis(arc, "c", "seed");
  for (const sec of s.sectors) for (const b of sec.businesses) b.coin = reserve;
  s.sectors[0].businesses[0].coin = reserve + 50000n;
  s.sectors[0].businesses[0].open = false;
  const purse0 = s.citizens.purse;
  const events: SimEvent[] = [];
  processDividends(s, arc, growth, events);
  assert.equal(s.citizens.purse, purse0);
  assert.equal(events.length, 0);
});

// --- working capital top-up ---
import { processWorkingCapital } from "../src/growth.ts";

const floor = (arc.genesis.coin_per_business * growth.topup_floor_bps) / 10000n;

test("top-up: parse rejects a negative or missing topup_floor_bps", () => {
  assert.throws(() => parseGrowthRules({ ...growthJson, topup_floor_bps: -1 }), /topup_floor_bps/);
  const { topup_floor_bps: _d, ...missing } = growthJson;
  assert.throws(() => parseGrowthRules(missing), /topup_floor_bps/);
});

test("top-up: a profitable open business below the floor is topped up from the purse, coin conserved", () => {
  const s = genesis(arc, "c", "seed");
  const biz = s.sectors[0].businesses[0]; // farm: profitable at genesis prices
  biz.coin = 1n;
  s.citizens.purse = 100000n;
  const before = total(s);
  const events: SimEvent[] = [];
  processWorkingCapital(s, arc, growth, events);
  assert.equal(biz.coin, floor);
  assert.equal(total(s), before);
  assert.equal(events.filter((e) => e.event === "capital_injected").length, 1);
});

test("top-up: limited by the purse, never negative", () => {
  const s = genesis(arc, "c", "seed");
  for (const sec of s.sectors) for (const b of sec.businesses) b.coin = 0n;
  s.citizens.purse = 10n;
  processWorkingCapital(s, arc, growth, []);
  assert.equal(s.citizens.purse, 0n);
});

test("top-up: skips closed businesses and businesses whose recipe loses money", () => {
  const s = genesis(arc, "c", "seed");
  const biz = s.sectors[0].businesses[0];
  biz.coin = 0n;
  biz.open = false;
  s.citizens.purse = 100000n;
  processWorkingCapital(s, arc, growth, []);
  assert.equal(biz.coin, 0n);
  biz.open = true;
  for (const it of Object.keys(s.market.price)) s.market.price[it] = 1n; // outputs worth less than the wage
  processWorkingCapital(s, arc, growth, []);
  assert.equal(biz.coin, 0n);
});

// --- stock cap on production ---
import { step } from "../src/step.ts";
import { parsePricingRules } from "../src/pricing.ts";

const pricing = parsePricingRules(readFileSync(join(process.cwd(), "data/pricing.rules.json"), "utf-8"));

test("stock cap: parse rejects stock_cap_runs below 1 or missing", () => {
  assert.throws(() => parseGrowthRules({ ...growthJson, stock_cap_runs: 0 }), /stock_cap_runs/);
  const { stock_cap_runs: _d, ...missing } = growthJson;
  assert.throws(() => parseGrowthRules(missing), /stock_cap_runs/);
});

test("stock cap: a business already holding the cap of its output does not produce; below the cap it does", () => {
  const farmRecipe = arc.recipes.find((r) => r.id === "farm")!;
  const cap = BigInt(growth.stock_cap_runs) * farmRecipe.max_per_run_per_business * farmRecipe.outputs["grain"];
  const s = genesis(arc, "c", "seed");
  const farm = s.sectors[0].businesses.find((b) => b.recipe === "farm")!;
  farm.inventory["grain"] = cap;
  const r1 = step(s, { arc, pricing, growth });
  assert.ok(!r1.events.some((e) => e.event === "produced" && e.recipe === "farm"), "full warehouse: no production");

  const s2 = genesis(arc, "c", "seed");
  const farm2 = s2.sectors[0].businesses.find((b) => b.recipe === "farm")!;
  farm2.inventory["grain"] = cap - 3n;
  const r2 = step(s2, { arc, pricing, growth });
  const ev = r2.events.find((e) => e.event === "produced" && e.recipe === "farm");
  assert.ok(ev, "room for one run: produces");
  assert.equal((ev!.runs as string), "1", "runs limited to the free room");
});
