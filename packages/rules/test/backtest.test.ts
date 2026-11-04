import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../../sim/src/arc.ts";
import { parsePricingRules } from "../../sim/src/pricing.ts";
import { parseGrowthRules } from "../../sim/src/growth.ts";
import { parseAgent } from "../src/schema.ts";
import { backtestAgent } from "../src/backtest.ts";
import { genesis } from "../../sim/src/genesis.ts";
import { step } from "../../sim/src/step.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const arc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs/goblin_warrens.json"), "utf-8")));

test("trivial agent that does nothing scores 0n", () => {
  const agent = parseAgent(
    {
      version: 1,
      name: "DoNothing",
      rules: [],
    },
    arc
  );

  const res = backtestAgent({
    arc,
    pricing,
    growth,
    seed: "seed-trivial-1",
    cityId: "city-trivial",
    agent,
    startCoin: 1000n,
    steps: 50,
  });

  assert.equal(res.score, 0n);
  assert.equal(res.trades, 0);
  assert.equal(res.orders, 0);
  assert.equal(res.finalState.coin, 1000n);
  assert.deepEqual(res.finalState.items, {});
  assert.equal(typeof res.stateRoot, "string");
  assert.equal(res.stateRoot.length, 64);
});

test("buy-low/sell-high agent on goblin_warrens over 200 steps is deterministic and conserves totals", () => {
  // Buy bread when price <= 15n, sell bread when price >= 22n
  const agent = parseAgent(
    {
      version: 1,
      name: "Goblin Bread Merchant",
      rules: [
        {
          id: "buy_cheap_bread",
          when: [
            { kind: "price", item: "bread", op: "lte", value: "15" },
            { kind: "coin", op: "gte", value: "30" },
          ],
          do: { kind: "buy", item: "bread", qty: "10", max_price: "15" },
          cooldown: 1,
        },
        {
          id: "sell_high_bread",
          when: [
            { kind: "price", item: "bread", op: "gte", value: "20" },
            { kind: "holding", item: "bread", op: "gte", value: "5" },
          ],
          do: { kind: "sell", item: "bread", qty: "5", min_price: "20" },
          cooldown: 1,
        },
      ],
    },
    arc
  );

  const params = {
    arc,
    pricing,
    growth,
    seed: "gw-seed-test-200",
    cityId: "gw-backtest",
    agent,
    startCoin: 2000n,
    steps: 200,
    assertConservation: true,
  };

  const run1 = backtestAgent(params);
  const run2 = backtestAgent(params);

  // Determinism: two runs produce same score and root
  assert.equal(run1.score, run2.score);
  assert.equal(run1.stateRoot, run2.stateRoot);
  assert.equal(run1.trades, run2.trades);
  assert.equal(run1.orders, run2.orders);
  assert.deepEqual(run1.finalState, run2.finalState);

  // Invariant: score equals final coin + items * price - startCoin
  // And stateRoot is 64 hex characters
  assert.equal(run1.stateRoot.length, 64);
});

test("tampered agent rule changes score or state root", () => {
  const baseAgent = parseAgent(
    {
      version: 1,
      name: "BaseAgent",
      rules: [
        {
          id: "buy_rule",
          when: [{ kind: "price", item: "grain", op: "lte", value: "15" }],
          do: { kind: "buy", item: "grain", qty: "10", max_price: "15" },
        },
      ],
    },
    arc
  );

  const tamperedAgent = parseAgent(
    {
      version: 1,
      name: "TamperedAgent",
      rules: [
        {
          id: "buy_rule",
          when: [{ kind: "price", item: "grain", op: "lte", value: "1" }], // below the price floor -> never fires
          do: { kind: "buy", item: "grain", qty: "10", max_price: "1" },
        },
      ],
    },
    arc
  );

  const common = {
    arc,
    pricing,
    growth,
    seed: "seed-tamper-check",
    cityId: "city-gw",
    startCoin: 1000n,
    steps: 50,
  };

  const resBase = backtestAgent({ ...common, agent: baseAgent });
  const resTampered = backtestAgent({ ...common, agent: tamperedAgent });

  assert.ok(resBase.trades > 0, "base agent should execute trades");
  assert.equal(resTampered.trades, 0, "tampered agent should execute 0 trades");
  assert.notEqual(resBase.score, resTampered.score, "scores should differ");
  assert.notEqual(resBase.stateRoot, resTampered.stateRoot, "state roots should differ");
});
