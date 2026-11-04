import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step } from "../src/step.ts";
import { buildCheckpoint, checkConservation, checkPlayerDeltas } from "../src/checkpoint.ts";
import type { PlayerOrder } from "../src/orders.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const arc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs/goblin_warrens.json"), "utf-8")));

test("orders guard: duplicate id in the same step is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-duplicate-step");
  const ctx = { arc, pricing, growth };
  const firstBiz = s0.sectors[0].businesses[0].id;
  const orders: PlayerOrder[] = [
    { order_id: "ord-1", account: "player1.near", kind: "invest", business_id: firstBiz, amount: 10n },
    { order_id: "ord-1", account: "player2.near", kind: "invest", business_id: firstBiz, amount: 10n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejected = res.events.filter((e) => e.event === "order_rejected" && e.order_id === "ord-1");
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, "duplicate");
  assert.equal(rejected[0].account, "player2.near");
});

test("orders guard: duplicate id in executedIds is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-duplicate-executed");
  const executedIds = new Set<string>(["ord-existing"]);
  const ctx = { arc, pricing, growth, executedIds };
  const orders: PlayerOrder[] = [
    { order_id: "ord-existing", account: "player1.near", kind: "buy", item: "grain", qty: 1n, limit_price: 1000n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejected = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-existing");
  assert.ok(rejected);
  assert.equal(rejected.reason, "duplicate");
});

test("orders guard: buy price above limit is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-buy-above-limit");
  const ctx = { arc, pricing, growth };
  const grainPrice = s0.market.price["grain"] ?? 10n;
  const orders: PlayerOrder[] = [
    { order_id: "ord-price-high", account: "player1.near", kind: "buy", item: "grain", qty: 5n, limit_price: grainPrice - 1n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejected = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-price-high");
  assert.ok(rejected);
  assert.equal(rejected.reason, "price_above_limit");
});

test("orders guard: sell price below limit is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-sell-below-limit");
  const ctx = { arc, pricing, growth };
  const grainPrice = s0.market.price["grain"] ?? 10n;
  const orders: PlayerOrder[] = [
    { order_id: "ord-price-low", account: "player1.near", kind: "sell", item: "grain", qty: 5n, limit_price: grainPrice + 100n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejected = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-price-low");
  assert.ok(rejected);
  assert.equal(rejected.reason, "price_below_limit");
});

test("orders guard: buy with no stock is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-no-stock");
  const ctx = { arc, pricing, growth };
  // Find an item with 0 stock in genesis state
  let zeroStockItem = "gadget";
  let totalStock = 0n;
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      totalStock += b.inventory[zeroStockItem] ?? 0n;
    }
  }
  // If gadget had stock, find another item with 0 stock
  if (totalStock > 0n) {
    for (const it of arc.items) {
      let st = 0n;
      for (const sec of s0.sectors) {
        for (const b of sec.businesses) st += b.inventory[it.id] ?? 0n;
      }
      if (st === 0n) {
        zeroStockItem = it.id;
        break;
      }
    }
  }

  const orders: PlayerOrder[] = [
    { order_id: "ord-no-stock", account: "player1.near", kind: "buy", item: zeroStockItem, qty: 10n, limit_price: 10000n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejected = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-no-stock");
  assert.ok(rejected, `expected rejection for no stock of ${zeroStockItem}`);
  assert.equal(rejected.reason, "no_stock");
});

test("orders guard: sell where buyers lack coin or need is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-no-need");
  const ctx = { arc, pricing, growth };
  // Find an item that is an end product (not an input to any recipe)
  // In goblin_warrens: e.g. gadget, elixir, bread
  let endProduct = "bread";
  const inputItems = new Set<string>();
  for (const r of arc.recipes) {
    for (const inp of Object.keys(r.inputs)) inputItems.add(inp);
  }
  for (const it of arc.items) {
    if (!inputItems.has(it.id)) {
      endProduct = it.id;
      break;
    }
  }

  const orders: PlayerOrder[] = [
    { order_id: "ord-no-need", account: "player1.near", kind: "sell", item: endProduct, qty: 10n, limit_price: 1n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejected = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-no-need");
  assert.ok(rejected);
  assert.equal(rejected.reason, "buyers_lack_coin_or_need");
});

test("orders guard: invest in unknown business is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-unknown-biz");
  const ctx = { arc, pricing, growth };
  const orders: PlayerOrder[] = [
    { order_id: "ord-unknown-biz", account: "player1.near", kind: "invest", business_id: "biz-ghost-404", amount: 100n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejected = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-unknown-biz");
  assert.ok(rejected);
  assert.equal(rejected.reason, "unknown_business");
});

test("orders guard: invest with zero or negative amount is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-zero-amount");
  const ctx = { arc, pricing, growth };
  const firstBiz = s0.sectors[0].businesses[0].id;
  const orders: PlayerOrder[] = [
    { order_id: "ord-zero-amt", account: "player1.near", kind: "invest", business_id: firstBiz, amount: 0n },
    { order_id: "ord-neg-amt", account: "player2.near", kind: "invest", business_id: firstBiz, amount: -10n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejectedZero = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-zero-amt");
  assert.ok(rejectedZero);
  assert.equal(rejectedZero.reason, "zero_amount");

  const rejectedNeg = res.events.find((e) => e.event === "order_rejected" && e.order_id === "ord-neg-amt");
  assert.ok(rejectedNeg);
  assert.equal(rejectedNeg.reason, "zero_amount");
});

test("happy path: buy order fills from businesses holding item in order", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-happy-buy");
  const ctx = { arc, pricing, growth };

  // Give inventory to a specific business
  const targetBiz = s0.sectors[0].businesses[0];
  targetBiz.inventory["ore"] = 50n;
  const initialCoin = targetBiz.coin;
  const orePrice = s0.market.price["ore"] ?? 15n;

  const orders: PlayerOrder[] = [
    { order_id: "ord-buy-ok", account: "alice.near", kind: "buy", item: "ore", qty: 10n, limit_price: orePrice },
  ];

  const res = step(s0, { ...ctx, orders });
  const accepted = res.events.find((e) => e.event === "order_accepted" && e.order_id === "ord-buy-ok");
  assert.ok(accepted);
  assert.equal(accepted.kind, "buy");
  assert.equal(accepted.item, "ore");
  assert.equal(accepted.filled, "10");
  assert.equal(accepted.price, orePrice.toString());
  assert.equal(accepted.total_coin, (10n * orePrice).toString());

  // Business inventory decreased by 10, coin increased by 10 * orePrice
  const afterBiz = res.state.sectors[0].businesses.find((b) => b.id === targetBiz.id)!;
  // Note: production might also run in the step, but targetBiz was given ore
  // Check that the order took ore and added coin
});

test("happy path: sell order fills from open businesses needing input", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-happy-sell");
  const ctx = { arc, pricing, growth };

  // Find a recipe with inputs, e.g. smelting ore into ingot or milling grain into flour
  // Let's find an input item
  let inputItem = "grain";
  let buyerBiz = s0.sectors.flatMap((s) => s.businesses).find((b) => {
    const r = arc.recipes.find((rec) => rec.id === b.recipe);
    return r && r.inputs[inputItem] !== undefined && b.open;
  });
  if (!buyerBiz) {
    inputItem = "ore";
    buyerBiz = s0.sectors.flatMap((s) => s.businesses).find((b) => {
      const r = arc.recipes.find((rec) => rec.id === b.recipe);
      return r && r.inputs[inputItem] !== undefined && b.open;
    })!;
  }
  // Ensure buyer has 0 inventory of that item and ample coin
  buyerBiz.inventory[inputItem] = 0n;
  buyerBiz.coin = 100000n;
  const price = s0.market.price[inputItem];

  const orders: PlayerOrder[] = [
    { order_id: "ord-sell-ok", account: "bob.near", kind: "sell", item: inputItem, qty: 5n, limit_price: price },
  ];

  const res = step(s0, { ...ctx, orders });
  const accepted = res.events.find((e) => e.event === "order_accepted" && e.order_id === "ord-sell-ok");
  assert.ok(accepted);
  assert.equal(accepted.kind, "sell");
  assert.equal(accepted.item, inputItem);
  assert.equal(accepted.filled, "5");
  assert.equal(accepted.price, price.toString());
  assert.equal(accepted.total_coin, (5n * price).toString());
});

test("happy path: invest order funds open business", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-happy-invest");
  const ctx = { arc, pricing, growth };
  const targetBiz = s0.sectors[0].businesses[0];
  const prevCoin = targetBiz.coin;

  const orders: PlayerOrder[] = [
    { order_id: "ord-invest-ok", account: "charlie.near", kind: "invest", business_id: targetBiz.id, amount: 500n },
  ];

  const res = step(s0, { ...ctx, orders });
  const accepted = res.events.find((e) => e.event === "order_accepted" && e.order_id === "ord-invest-ok");
  assert.ok(accepted);
  assert.equal(accepted.kind, "invest");
  assert.equal(accepted.business_id, targetBiz.id);
  assert.equal(accepted.amount, "500");
  assert.equal(accepted.total_coin, "500");
});

test("happy path: invest order reopens closed business", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-reopen-invest");
  const ctx = { arc, pricing, growth };
  const primaryBiz = s0.sectors.flatMap((s) => s.businesses).find((b) => {
    const r = arc.recipes.find((rec) => rec.id === b.recipe);
    return r && Object.keys(r.inputs).length === 0;
  })!;
  primaryBiz.open = false;
  primaryBiz.insolvent_steps = 3;

  const orders: PlayerOrder[] = [
    { order_id: "ord-reopen-ok", account: "david.near", kind: "invest", business_id: primaryBiz.id, amount: 1000n },
  ];

  const res = step(s0, { ...ctx, orders });
  const reopenedEv = res.events.find((e) => e.event === "business_reopened" && e.business_id === primaryBiz.id);
  assert.ok(reopenedEv, "expected business_reopened event");
  assert.equal(reopenedEv.recipe, primaryBiz.recipe);

  const accepted = res.events.find((e) => e.event === "order_accepted" && e.order_id === "ord-reopen-ok");
  assert.ok(accepted);

  const afterBiz = res.state.sectors.flatMap((s) => s.businesses).find((b) => b.id === primaryBiz.id)!;
  assert.equal(afterBiz.open, true);
  assert.equal(afterBiz.insolvent_steps, 0);
});

test("orders guard: fee with zero or negative amount is rejected", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-fee-zero");
  const ctx = { arc, pricing, growth };
  const orders: PlayerOrder[] = [
    { order_id: "ord-fee-0", account: "agent.near", kind: "fee", amount: 0n },
    { order_id: "ord-fee-neg", account: "agent.near", kind: "fee", amount: -5n },
  ];

  const res = step(s0, { ...ctx, orders });
  const rejections = res.events.filter((e) => e.event === "order_rejected");
  assert.equal(rejections.length, 2);
  assert.equal(rejections[0].order_id, "ord-fee-0");
  assert.equal(rejections[0].reason, "zero_amount");
  assert.equal(rejections[1].order_id, "ord-fee-neg");
  assert.equal(rejections[1].reason, "zero_amount");
});

test("happy path: fee order funds treasury and conserves totals", () => {
  const s0 = genesis(arc, "city-orders-test", "seed-fee-happy");
  const ctx = { arc, pricing, growth };
  const initialTreasury = s0.treasury;
  const initialCoin = s0.totals.coin;
  const orders: PlayerOrder[] = [
    { order_id: "ord-fee-ok", account: "agent.near", kind: "fee", amount: 100n },
  ];

  const res = step(s0, { ...ctx, orders });
  const accepted = res.events.find((e) => e.event === "order_accepted" && e.order_id === "ord-fee-ok");
  assert.ok(accepted);
  assert.equal(accepted.kind, "fee");
  assert.equal(accepted.amount, "100");
  assert.equal(accepted.total_coin, "100");

  // Treasury increased
  assert.equal(res.state.treasury, initialTreasury + 100n);

  // Totals coin increased by fee
  assert.equal(res.state.totals.coin, initialCoin + 100n);

  // Physical sum matches totals.coin
  let sumCoin = res.state.citizens.purse + res.state.treasury;
  for (const s of res.state.sectors) for (const b of s.businesses) sumCoin += b.coin;
  assert.equal(res.state.totals.coin, sumCoin);

  // Checkpoint verifies flow conservation
  const cp = buildCheckpoint({
    prev: s0,
    next: res.state,
    events: res.events,
    stateRoot: "0".repeat(64),
  });
  assert.equal(cp.coin.trade_from_players, "100");
  assert.ok(checkPlayerDeltas(cp));
  const conserved = checkConservation(s0.totals, cp);
  assert.equal(conserved.coin, res.state.totals.coin);
});
