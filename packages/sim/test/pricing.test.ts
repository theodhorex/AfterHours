import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parsePricingRules,
  explainPrice,
  explainText,
  type PricingRules,
} from "../src/pricing.ts";

const PRICING_PATH = join(process.cwd(), "data/pricing.rules.json");
const rawPricingJson = readFileSync(PRICING_PATH, "utf-8");

test("parsePricingRules parses valid data/pricing.rules.json", () => {
  const rules = parsePricingRules(rawPricingJson);
  assert.equal(rules.version, 0);
  assert.equal(rules.k_stock_bps, 6000n);
  assert.equal(rules.k_dem_bps, 3000n);
  assert.equal(rules.floor_bps, 3000n);
  assert.equal(rules.cap_bps, 40000n);
  assert.equal(rules.dem_ema_alpha_bps, 2500n);
  assert.equal(rules.target_stock_steps, 2n);
  assert.equal(rules.dem_ref_floor, 1n);
  assert.ok(rules.explain.stock_low.includes("{pct}"));
});

test("parsePricingRules throws on invalid variants", () => {
  assert.throws(() => parsePricingRules(null), /object/);
  assert.throws(() => parsePricingRules("not json"), /SyntaxError|JSON/);
  assert.throws(() => parsePricingRules({ ...JSON.parse(rawPricingJson), k_stock_bps: -1 }), /k_stock_bps/);
  assert.throws(() => parsePricingRules({ ...JSON.parse(rawPricingJson), cap_bps: 1000, floor_bps: 2000 }), /cap_bps/);
  assert.throws(() => parsePricingRules({ ...JSON.parse(rawPricingJson), target_stock_steps: 0 }), /target_stock_steps/);
  assert.throws(() => parsePricingRules({ ...JSON.parse(rawPricingJson), dem_ema_alpha_bps: 15000 }), /dem_ema_alpha_bps/);
  assert.throws(() => parsePricingRules({ ...JSON.parse(rawPricingJson), explain: {} }), /explain/);
});

test("T09: price is base price when stock equals target and demand equals reference", () => {
  const rules = parsePricingRules(rawPricingJson);
  const reason = explainPrice({
    item: "bread",
    base: 100n,
    stock: 50n,
    dem_ema: 25n,
    expected: 25n, // target = 2 * 25 = 50, dem_ref = max(1, 25) = 25
    pricing: rules,
  });

  assert.equal(reason.price, 100n);
  assert.equal(reason.stock_effect_bps, 0n);
  assert.equal(reason.demand_effect_bps, 0n);
  assert.equal(reason.clamped, null);
  assert.equal(explainText(reason, rules), "");
});

test("T09: price is non-increasing in stock", () => {
  const rules = parsePricingRules(rawPricingJson);
  let prevPrice = 1000000n;
  for (let s = 0; s <= 200; s += 5) {
    const reason = explainPrice({
      item: "bread",
      base: 100n,
      stock: BigInt(s),
      dem_ema: 25n,
      expected: 25n,
      pricing: rules,
    });
    assert.ok(reason.price <= prevPrice, `Expected price at stock ${s} (${reason.price}) <= prev (${prevPrice})`);
    prevPrice = reason.price;
  }
});

test("T09: price is non-decreasing in demand", () => {
  const rules = parsePricingRules(rawPricingJson);
  let prevPrice = 0n;
  for (let d = 0; d <= 200; d += 5) {
    const reason = explainPrice({
      item: "bread",
      base: 100n,
      stock: 50n,
      dem_ema: BigInt(d),
      expected: 25n,
      pricing: rules,
    });
    assert.ok(reason.price >= prevPrice, `Expected price at demand ${d} (${reason.price}) >= prev (${prevPrice})`);
    prevPrice = reason.price;
  }
});

test("T09: floor and cap are strictly respected", () => {
  const rules = parsePricingRules(rawPricingJson);
  // Extremely high stock: should hit floor (30% of 100 = 30)
  const floorReason = explainPrice({
    item: "bread",
    base: 100n,
    stock: 10000n,
    dem_ema: 0n,
    expected: 25n,
    pricing: rules,
  });
  assert.equal(floorReason.price, 30n);
  assert.equal(floorReason.clamped, "floor");
  const floorText = explainText(floorReason, rules);
  assert.ok(floorText.includes("30% of base"));

  // Zero stock, huge demand: should hit cap (400% of 100 = 400)
  const capReason = explainPrice({
    item: "bread",
    base: 100n,
    stock: 0n,
    dem_ema: 10000n,
    expected: 25n,
    pricing: rules,
  });
  assert.equal(capReason.price, 400n);
  assert.equal(capReason.clamped, "cap");
  const capText = explainText(capReason, rules);
  assert.ok(capText.includes("400% of base"));
});

test("T09: text contains the right direction and numbers", () => {
  const rules = parsePricingRules(rawPricingJson);
  // Example from task: Stock is 40% below target, so the price rises 24%.
  // target = 50, stock = 30 (40% below target)
  // k_stock_bps = 6000 -> 6000 * 40 / 100 = 2400 bps -> 24%
  const reason = explainPrice({
    item: "bread",
    base: 100n,
    stock: 30n,
    dem_ema: 25n,
    expected: 25n,
    pricing: rules,
  });

  const text = explainText(reason, rules);
  assert.equal(text, "Stock is 40% below target, so the price rises 24%.");
});

test("T09: items nobody consumes keep their base price", () => {
  const rules = parsePricingRules(rawPricingJson);
  const reason = explainPrice({
    item: "scroll",
    base: 60n,
    stock: 500n,
    dem_ema: 0n,
    expected: 0n, // nobody consumes scroll
    pricing: rules,
  });

  assert.equal(reason.price, 60n);
  assert.equal(reason.clamped, null);
  assert.equal(reason.stock_effect_bps, 0n);
  assert.equal(reason.demand_effect_bps, 0n);
});
