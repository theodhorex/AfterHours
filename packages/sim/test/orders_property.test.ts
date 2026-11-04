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
import { eventRoot, cityRoot } from "../src/roots.ts";
import type { PlayerOrder } from "../src/orders.ts";
import type { ArcFile, CityState, SimEvent } from "../src/types.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const arcs = readdirSync(join(root, "data/arcs"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => parseArc(JSON.parse(readFileSync(join(root, "data/arcs", f), "utf-8"))));

/** Tiny seeded generator (xorshift32), integers only, no Math.random. */
function rng(seed: number): (n: number) => number {
  let x = seed >>> 0 || 1;
  return (n: number) => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x % n;
  };
}

function makeOrders(arc: ArcFile, state: CityState, stepNo: number, r: (n: number) => number): PlayerOrder[] {
  const out: PlayerOrder[] = [];
  const count = r(4); // 0..3 orders per step
  const bizIds = state.sectors.flatMap((s) => s.businesses.map((b) => b.id)).sort();
  for (let i = 0; i < count; i++) {
    const kind = (["buy", "sell", "invest"] as const)[r(3)];
    const item = arc.items[r(arc.items.length)].id;
    const price = state.market.price[item] ?? 1n;
    const order_id = `o-${stepNo}-${i}`;
    const account = `acct${r(5)}.near`;
    if (kind === "invest") {
      out.push({ order_id, account, kind, business_id: bizIds[r(bizIds.length)], amount: BigInt(r(400)) });
    } else {
      out.push({ order_id, account, kind, item, qty: BigInt(1 + r(30)), limit_price: kind === "buy" ? price * 2n : price / 2n });
    }
  }
  // occasionally replay an earlier id to exercise duplicate rejection
  if (stepNo > 3 && r(10) === 0) {
    out.push({ order_id: `o-${stepNo - 1}-0`, account: "acct0.near", kind: "buy", item: arc.items[0].id, qty: 1n, limit_price: 1000000n });
  }
  return out;
}

function sumItems(s: CityState, item: string): bigint {
  let t = 0n;
  for (const sec of s.sectors) for (const b of sec.businesses) t += b.inventory[item] ?? 0n;
  return t;
}
function sumCoin(s: CityState): bigint {
  let t = s.citizens.purse + s.treasury;
  for (const sec of s.sectors) for (const b of sec.businesses) t += b.coin;
  return t;
}

function run(arc: ArcFile, seedLabel: string, steps: number): { roots: string[]; windows: number; accepted: number; rejected: number } {
  let state = genesis(arc, `city-${arc.id}`, seedLabel);
  const executed = new Set<string>();
  const r = rng(0x9e3779b9);
  const roots: string[] = [];
  let windowPrev = state;
  let windowEvents: SimEvent[] = [];
  let windows = 0;
  let accepted = 0;
  let rejected = 0;
  for (let s = 1; s <= steps; s++) {
    const orders = makeOrders(arc, state, s, r);
    const res = step(state, { arc, pricing, growth, orders, executedIds: executed });
    for (const e of res.events) {
      if (e.event === "order_accepted") { executed.add(e.order_id as string); accepted++; }
      if (e.event === "order_rejected") rejected++;
    }
    state = res.state;
    windowEvents.push(...res.events);
    roots.push(cityRoot(state) + eventRoot(res.events));

    // non-negativity
    for (const sec of state.sectors) for (const b of sec.businesses) {
      assert.ok(b.coin >= 0n, `${arc.id} step ${s}: ${b.id} coin negative`);
      for (const [it, q] of Object.entries(b.inventory)) assert.ok(q >= 0n, `${arc.id} step ${s}: ${b.id} ${it} negative`);
    }
    assert.ok(state.citizens.purse >= 0n && state.treasury >= 0n);
    // totals match the physical sums every step (items and coin)
    for (const it of arc.items) assert.equal(state.totals.items[it.id] ?? 0n, sumItems(state, it.id), `${arc.id} step ${s}: total of ${it.id}`);
    assert.equal(state.totals.coin, sumCoin(state), `${arc.id} step ${s}: total coin`);

    if (s % 40 === 0) {
      const cp = buildCheckpoint({ prev: windowPrev, next: state, events: windowEvents, stateRoot: "0".repeat(64) });
      assert.ok(checkPlayerDeltas(cp), "player deltas consistent");
      const t = checkConservation(windowPrev.totals, cp);
      for (const it of arc.items) assert.equal(t.items[it.id] ?? 0n, state.totals.items[it.id] ?? 0n, `${arc.id} window ${s}: checkConservation ${it.id}`);
      assert.equal(t.coin, state.totals.coin, `${arc.id} window ${s}: checkConservation coin`);
      windowPrev = state;
      windowEvents = [];
      windows++;
    }
  }
  return { roots, windows, accepted, rejected };
}

for (const arc of arcs) {
  test(`orders property ${arc.id}: 400 steps with seeded random orders conserve items and coin and are deterministic`, () => {
    const a = run(arc, "seed-orders", 400);
    assert.equal(a.windows, 10);
    assert.ok(a.accepted >= 50, `orders must really execute (accepted ${a.accepted})`);
    assert.ok(a.rejected >= 5, `guards must really fire (rejected ${a.rejected})`);
    const b = run(arc, "seed-orders", 400);
    assert.deepEqual(b.roots, a.roots, "same seed and same orders give the same roots");
  });
}
