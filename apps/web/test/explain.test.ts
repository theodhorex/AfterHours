import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { explainPrice, explainText } from "../src/lib/explain.ts";

describe("price explanation", () => {
  it("calculates baseline price when stock equals target and demand equals reference", () => {
    const item = {
      id: "bread",
      base_price: 12,
      stock: 100,
      target: 100,
      dem_ema: 50,
      dem_ref: 50,
    };
    const res = explainPrice(item);
    assert.equal(res.price, 12);
    assert.equal(res.stock_effect_bps, 0);
    assert.equal(res.demand_effect_bps, 0);
    assert.equal(res.clamp, "none");
    assert.match(explainText(res), /Balanced market/i);
  });

  it("calculates increased price and explanation when stock is below target", () => {
    // 50% below target -> k_stock_bps = 6000 -> +3000 bps (+30%)
    // Base 10 -> 10 * 1.30 = 13
    const item = {
      id: "ore",
      base_price: 10,
      stock: 50,
      target: 100,
      dem_ema: 50,
      dem_ref: 50,
    };
    const res = explainPrice(item);
    assert.equal(res.stock_effect_bps, 3000);
    assert.equal(res.price, 13);
    assert.equal(res.clamp, "none");
    const text = explainText(res);
    assert.match(text, /50% below target/i);
    assert.match(text, /price rises 30%/i);
  });

  it("calculates decreased price and explanation when stock is above target", () => {
    // 50% above target -> -3000 bps (-30%)
    // Base 20 -> 20 * 0.70 = 14
    const item = {
      id: "ingot",
      base_price: 20,
      stock: 150,
      target: 100,
      dem_ema: 50,
      dem_ref: 50,
    };
    const res = explainPrice(item);
    assert.equal(res.stock_effect_bps, -3000);
    assert.equal(res.price, 14);
    assert.equal(res.clamp, "none");
    const text = explainText(res);
    assert.match(text, /50% above target/i);
    assert.match(text, /price falls 30%/i);
  });

  it("respects floor clamp at 30% of base price", () => {
    // Huge excess stock -> would drive price to 0 or negative
    const item = {
      id: "scrap",
      base_price: 10,
      stock: 1000,
      target: 100,
      dem_ema: 10,
      dem_ref: 50,
    };
    const res = explainPrice(item);
    assert.equal(res.clamp, "floor");
    // floor is 30% of 10 = 3
    assert.equal(res.price, 3);
    assert.equal(explainText(res), "Price held at the floor (30% of base).");
  });

  it("respects cap clamp at 400% of base price", () => {
    // Stock is 0 and massive demand
    const item = {
      id: "gadget",
      base_price: 100,
      stock: 0,
      target: 100,
      dem_ema: 1000,
      dem_ref: 10,
    };
    const res = explainPrice(item);
    assert.equal(res.clamp, "cap");
    // cap is 400% of 100 = 400
    assert.equal(res.price, 400);
    assert.equal(explainText(res), "Price held at the cap (400% of base).");
  });
});
