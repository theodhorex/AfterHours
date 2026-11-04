import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step } from "../src/step.ts";
import {
  buildCheckpoint,
  checkConservation,
  checkPlayerDeltas,
} from "../src/checkpoint.ts";
import type { PlayerOrder } from "../src/orders.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const arc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs/goblin_warrens.json"), "utf-8")));

test("buildCheckpoint with buy, sell, and invest orders produces correct flows, deltas and executed_order_ids", () => {
  const s0 = genesis(arc, "city-cp-orders", "seed-cp-orders");
  const ctx = { arc, pricing, growth };

  // Setup: give business inventory and coin so buy and sell both succeed
  const b0 = s0.sectors[0].businesses[0];
  b0.inventory["ore"] = 100n;

  // Find a buyer business for sell order (uses grain as input)
  const miller = s0.sectors.flatMap((s) => s.businesses).find((b) => {
    const r = arc.recipes.find((rec) => rec.id === b.recipe);
    return r && r.inputs["grain"] !== undefined;
  })!;
  miller.inventory["grain"] = 0n;
  miller.coin = 10000n;

  const orePrice = s0.market.price["ore"];
  const grainPrice = s0.market.price["grain"];

  const orders: PlayerOrder[] = [
    // Alice buys 10 ore
    { order_id: "ord-buy-1", account: "alice.near", kind: "buy", item: "ore", qty: 10n, limit_price: orePrice },
    // Bob sells 5 grain
    { order_id: "ord-sell-1", account: "bob.near", kind: "sell", item: "grain", qty: 5n, limit_price: grainPrice },
    // Alice also buys 5 more ore
    { order_id: "ord-buy-2", account: "alice.near", kind: "buy", item: "ore", qty: 5n, limit_price: orePrice },
    // Charlie invests 200 coin into b0
    { order_id: "ord-invest-1", account: "charlie.near", kind: "invest", business_id: b0.id, amount: 200n },
    // Rejected order: duplicate
    { order_id: "ord-buy-1", account: "alice.near", kind: "buy", item: "ore", qty: 1n, limit_price: orePrice },
    // Rejected order: price above limit
    { order_id: "ord-rejected-price", account: "dan.near", kind: "buy", item: "ore", qty: 1n, limit_price: 1n },
  ];

  const res = step(s0, { ...ctx, orders });

  const cp = buildCheckpoint({
    prev: s0,
    next: res.state,
    events: res.events,
    stateRoot: "0".repeat(64),
  });

  // 1. Executed order ids: only accepted orders, in order
  assert.deepEqual(cp.executed_order_ids, [
    "ord-buy-1",
    "ord-sell-1",
    "ord-buy-2",
    "ord-invest-1",
  ]);

  // 2. Flows: ore trade_to_players = 15, grain trade_from_players = 5
  assert.equal(cp.items["ore"].trade_to_players, "15");
  assert.equal(cp.items["ore"].trade_from_players, "0");
  assert.equal(cp.items["grain"].trade_to_players, "0");
  assert.equal(cp.items["grain"].trade_from_players, "5");

  // 3. Coin flow:
  // Alice pays 15 * orePrice
  // Bob receives 5 * grainPrice
  // Charlie pays 200
  const expectedCoinFromPlayers = 15n * orePrice + 200n;
  const expectedCoinToPlayers = 5n * grainPrice;
  assert.equal(cp.coin.trade_from_players, expectedCoinFromPlayers.toString());
  assert.equal(cp.coin.trade_to_players, expectedCoinToPlayers.toString());

  // 4. Player deltas: aggregated per (account, token_id)
  // Alice: (alice, ore) in=15, out=0; (alice, coin) in=0, out=15*orePrice
  // Bob: (bob, grain) in=0, out=5; (bob, coin) in=5*grainPrice, out=0
  // Charlie: (charlie, coin) in=0, out=200
  assert.ok(cp.player_deltas.length >= 4);

  const aliceOre = cp.player_deltas.find((d) => d.account === "alice.near" && d.token_id === "ore")!;
  assert.ok(aliceOre);
  assert.equal(aliceOre.delta_in, "15");
  assert.equal(aliceOre.delta_out, "0");

  const aliceCoin = cp.player_deltas.find((d) => d.account === "alice.near" && d.token_id === "coin")!;
  assert.ok(aliceCoin);
  assert.equal(aliceCoin.delta_in, "0");
  assert.equal(aliceCoin.delta_out, (15n * orePrice).toString());

  const bobGrain = cp.player_deltas.find((d) => d.account === "bob.near" && d.token_id === "grain")!;
  assert.ok(bobGrain);
  assert.equal(bobGrain.delta_in, "0");
  assert.equal(bobGrain.delta_out, "5");

  const bobCoin = cp.player_deltas.find((d) => d.account === "bob.near" && d.token_id === "coin")!;
  assert.ok(bobCoin);
  assert.equal(bobCoin.delta_in, (5n * grainPrice).toString());
  assert.equal(bobCoin.delta_out, "0");

  const charlieCoin = cp.player_deltas.find((d) => d.account === "charlie.near" && d.token_id === "coin")!;
  assert.ok(charlieCoin);
  assert.equal(charlieCoin.delta_in, "0");
  assert.equal(charlieCoin.delta_out, "200");

  // 5. checkPlayerDeltas passes
  assert.equal(checkPlayerDeltas(cp), true);

  // 6. checkConservation passes and matches res.state.totals
  const conservedTotals = checkConservation(s0.totals, cp);
  for (const it of arc.items) {
    assert.equal(conservedTotals.items[it.id], res.state.totals.items[it.id]);
  }
  assert.equal(conservedTotals.coin, res.state.totals.coin);
});

test("checkPlayerDeltas: pure validation checks", () => {
  const baseCp = {
    city_id: "test",
    from_step: 0,
    to_step: 1,
    new_state_root: "a".repeat(64),
    new_city_root: "b".repeat(64),
    stage: 0,
    items: {
      ore: {
        produced: "0",
        consumed_recipe: "0",
        consumed_pop: "0",
        sourced: "0",
        sunk: "0",
        trade_to_players: "10",
        trade_from_players: "0",
      },
    },
    coin: {
      sourced: "0",
      sunk: "0",
      trade_to_players: "0",
      trade_from_players: "50",
    },
    player_deltas: [
      { account: "p1", token_id: "ore", delta_in: "10", delta_out: "0" },
      { account: "p1", token_id: "coin", delta_in: "0", delta_out: "50" },
    ],
    executed_order_ids: ["o1"],
  };

  // Valid
  assert.equal(checkPlayerDeltas(baseCp), true);

  // Mismatch item delta_in
  const badItemIn = JSON.parse(JSON.stringify(baseCp));
  badItemIn.player_deltas[0].delta_in = "9";
  assert.throws(() => checkPlayerDeltas(badItemIn), /PLAYER_DELTA_MISMATCH/);

  // Mismatch item delta_out
  const badItemOut = JSON.parse(JSON.stringify(baseCp));
  badItemOut.player_deltas[0].delta_out = "1";
  assert.throws(() => checkPlayerDeltas(badItemOut), /PLAYER_DELTA_MISMATCH/);

  // Mismatch coin delta_in
  const badCoinIn = JSON.parse(JSON.stringify(baseCp));
  badCoinIn.coin.trade_to_players = "5";
  assert.throws(() => checkPlayerDeltas(badCoinIn), /PLAYER_DELTA_MISMATCH/);

  // Mismatch coin delta_out
  const badCoinOut = JSON.parse(JSON.stringify(baseCp));
  badCoinOut.coin.trade_from_players = "99";
  assert.throws(() => checkPlayerDeltas(badCoinOut), /PLAYER_DELTA_MISMATCH/);

  // Stray token
  const stray = JSON.parse(JSON.stringify(baseCp));
  stray.player_deltas.push({ account: "p2", token_id: "mystery", delta_in: "1", delta_out: "0" });
  assert.throws(() => checkPlayerDeltas(stray), /PLAYER_DELTA_MISMATCH/);

  // Duplicate (account, token_id) key
  const duplicateKey = JSON.parse(JSON.stringify(baseCp));
  duplicateKey.player_deltas.push({ account: "p1", token_id: "ore", delta_in: "0", delta_out: "0" });
  assert.throws(() => checkPlayerDeltas(duplicateKey), /DUPLICATE_PLAYER_DELTA_KEY/);
});
