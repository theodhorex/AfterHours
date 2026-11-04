import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { Pcg32 } from "../src/prng.ts";
import { planCaravan, applyCaravan } from "../src/caravan.ts";
import { checkConservation, type Checkpoint } from "../src/checkpoint.ts";
import type { ArcFile, CityState } from "../src/types.ts";

const root = process.cwd();
const arcs = readdirSync(join(root, "data/arcs"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => parseArc(JSON.parse(readFileSync(join(root, "data/arcs", f), "utf-8"))));

function sumItems(s: CityState, item: string): bigint {
  let t = 0n;
  for (const sec of s.sectors) {
    for (const b of sec.businesses) {
      t += b.inventory[item] ?? 0n;
    }
  }
  return t;
}

function sumCoin(s: CityState): bigint {
  let t = s.citizens.purse + s.treasury;
  for (const sec of s.sectors) {
    for (const b of sec.businesses) {
      t += b.coin;
    }
  }
  return t;
}

test("caravan property: 200 random plans assert global conservation, non-negativity, determinism, and checkpoint acceptance", () => {
  const prng = new Pcg32(0x9e3779b97f4a7c15n, 1442695040888963407n);

  let plannedCount = 0;

  for (let iteration = 0; iteration < 200; iteration++) {
    // Pick two random arcs
    const arcIdxA = prng.nextBelow(arcs.length);
    const arcIdxB = prng.nextBelow(arcs.length);
    const arcA = arcs[arcIdxA];
    const arcB = arcs[arcIdxB];

    const cityA = genesis(arcA, `city-a-${iteration}`, `seed-a-${iteration}`);
    const cityB = genesis(arcB, `city-b-${iteration}`, `seed-b-${iteration}`);

    // Randomize treasury, purse, business inventory, and prices to exercise diverse states
    const itemA = arcA.items[prng.nextBelow(arcA.items.length)].id;

    // Distribute random inventory of itemA in cityA businesses
    let totalInvA = 0n;
    for (const sec of cityA.sectors) {
      for (const biz of sec.businesses) {
        if (prng.nextBelow(2) === 1) {
          const qty = BigInt(prng.nextBelow(100));
          biz.inventory[itemA] = qty;
          totalInvA += qty;
        }
      }
    }
    cityA.totals.items[itemA] = totalInvA;

    // Random market prices: ensure seller has price, buyer has price
    const priceA = BigInt(1 + prng.nextBelow(50));
    const priceB = BigInt(1 + prng.nextBelow(100));
    cityA.market.price[itemA] = priceA;
    cityB.market.price[itemA] = priceB;

    // Random treasury & purse for buyer
    cityB.treasury = BigInt(prng.nextBelow(1000));
    cityB.citizens.purse = BigInt(100 + prng.nextBelow(5000));
    cityB.totals.coin = sumCoin(cityB);

    const maxQty = BigInt(1 + prng.nextBelow(150));

    // 1. Plan caravan
    const plan1 = planCaravan(cityA, cityB, arcA, arcB, itemA, maxQty);
    const plan2 = planCaravan(cityA, cityB, arcA, arcB, itemA, maxQty);

    // Determinism of planner
    assert.deepEqual(plan1, plan2, "planCaravan must be strictly deterministic");

    if (!plan1) {
      continue;
    }

    plannedCount++;

    assert.ok(plan1.qty > 0n, "planned qty must be positive");
    assert.ok(plan1.unitPrice > 0n, "planned unitPrice must be positive");
    assert.equal(plan1.coin, plan1.qty * plan1.unitPrice, "coin must equal qty * unitPrice");
    assert.ok(priceB > priceA, "price spread must be positive");

    // 2. Apply caravan
    const preItemsA = sumItems(cityA, itemA);
    const preItemsB = sumItems(cityB, itemA);
    const preCoinA = sumCoin(cityA);
    const preCoinB = sumCoin(cityB);

    const res1 = applyCaravan(cityA, cityB, plan1, itemA);
    const res2 = applyCaravan(cityA, cityB, plan1, itemA);

    // Determinism of apply
    assert.deepEqual(res1, res2, "applyCaravan must be strictly deterministic");

    // Immutability: input states unchanged
    assert.equal(sumItems(cityA, itemA), preItemsA);
    assert.equal(sumCoin(cityA), preCoinA);
    assert.equal(sumItems(cityB, itemA), preItemsB);
    assert.equal(sumCoin(cityB), preCoinB);

    // Non-negativity assertions
    assert.ok(res1.a.treasury >= 0n, "A treasury non-negative");
    assert.ok(res1.a.citizens.purse >= 0n, "A purse non-negative");
    assert.ok(res1.b.treasury >= 0n, "B treasury non-negative");
    assert.ok(res1.b.citizens.purse >= 0n, "B purse non-negative");
    assert.ok((res1.a.totals.items[itemA] ?? 0n) >= 0n, "A totals.items non-negative");
    assert.ok((res1.b.totals.items[itemA] ?? 0n) >= 0n, "B totals.items non-negative");
    assert.ok(res1.a.totals.coin >= 0n, "A totals.coin non-negative");
    assert.ok(res1.b.totals.coin >= 0n, "B totals.coin non-negative");

    for (const sec of res1.a.sectors) {
      for (const biz of sec.businesses) {
        assert.ok(biz.coin >= 0n, "biz coin non-negative in A");
        for (const [it, q] of Object.entries(biz.inventory)) {
          assert.ok(q >= 0n, `biz inventory non-negative in A: ${it}`);
        }
      }
    }
    for (const sec of res1.b.sectors) {
      for (const biz of sec.businesses) {
        assert.ok(biz.coin >= 0n, "biz coin non-negative in B");
        for (const [it, q] of Object.entries(biz.inventory)) {
          assert.ok(q >= 0n, `biz inventory non-negative in B: ${it}`);
        }
      }
    }

    // Global conservation assertions
    const postItemsA = sumItems(res1.a, itemA);
    const postItemsB = sumItems(res1.b, itemA);
    const postCoinA = sumCoin(res1.a);
    const postCoinB = sumCoin(res1.b);

    assert.equal(postItemsA + postItemsB, preItemsA + preItemsB, "global items conserved");
    assert.equal(postCoinA + postCoinB, preCoinA + preCoinB, "global coin conserved");
    assert.equal(
      res1.a.totals.coin + res1.b.totals.coin,
      cityA.totals.coin + cityB.totals.coin,
      "global totals.coin conserved"
    );

    // Flow consistency
    assert.equal(res1.a.totals.items[itemA], cityA.totals.items[itemA] - plan1.qty);
    assert.equal(res1.a.totals.coin, cityA.totals.coin + plan1.coin);
    assert.equal(res1.b.totals.items[itemA], (cityB.totals.items[itemA] ?? 0n) + plan1.qty);
    assert.equal(res1.b.totals.coin, cityB.totals.coin - plan1.coin);

    // checkConservation from checkpoint.ts verification
    const cpA: Checkpoint = {
      city_id: res1.a.city_id,
      from_step: cityA.step,
      to_step: cityA.step,
      new_state_root: "0".repeat(64),
      new_city_root: "0".repeat(64),
      stage: res1.a.stage,
      items: res1.flowsA.items,
      coin: res1.flowsA.coin,
      player_deltas: [],
      executed_order_ids: [],
    };
    const conservedA = checkConservation(cityA.totals, cpA);
    assert.equal(conservedA.coin, res1.a.totals.coin, "checkConservation A coin matches totals");
    assert.equal(
      conservedA.items[itemA],
      res1.a.totals.items[itemA],
      "checkConservation A item matches totals"
    );

    const cpB: Checkpoint = {
      city_id: res1.b.city_id,
      from_step: cityB.step,
      to_step: cityB.step,
      new_state_root: "0".repeat(64),
      new_city_root: "0".repeat(64),
      stage: res1.b.stage,
      items: res1.flowsB.items,
      coin: res1.flowsB.coin,
      player_deltas: [],
      executed_order_ids: [],
    };
    const conservedB = checkConservation(cityB.totals, cpB);
    assert.equal(conservedB.coin, res1.b.totals.coin, "checkConservation B coin matches totals");
    assert.equal(
      conservedB.items[itemA],
      res1.b.totals.items[itemA],
      "checkConservation B item matches totals"
    );
  }

  assert.ok(plannedCount > 0, `Expected multiple successful plans out of 200, got ${plannedCount}`);
});
