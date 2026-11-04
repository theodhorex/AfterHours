import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../../sim/src/arc.ts";
import { genesis } from "../../sim/src/genesis.ts";
import { parseAgent, type Agent } from "../src/schema.ts";
import { evaluateAgent, type AgentState } from "../src/evaluate.ts";

const arcPath = join(process.cwd(), "data/arcs/goblin_warrens.json");
const arc = parseArc(JSON.parse(readFileSync(arcPath, "utf-8")));

function makeCity() {
  const city = genesis(arc, "city-gw", "test-seed");
  // Set explicit market prices for testing
  city.market.price["bread"] = 20n;
  city.market.price["grain"] = 10n;
  return city;
}

test("cond kind: price (true and false)", () => {
  const city = makeCity(); // bread = 20n
  const agentTrue = parseAgent(
    {
      version: 1,
      name: "T",
      rules: [
        {
          id: "r_price_true",
          when: [{ kind: "price", item: "bread", op: "lte", value: "20" }],
          do: { kind: "buy", item: "bread", qty: "1", max_price: "25" },
        },
      ],
    },
    arc
  );
  const agentFalse = parseAgent(
    {
      version: 1,
      name: "F",
      rules: [
        {
          id: "r_price_false",
          when: [{ kind: "price", item: "bread", op: "lt", value: "20" }],
          do: { kind: "buy", item: "bread", qty: "1", max_price: "25" },
        },
      ],
    },
    arc
  );

  const state: AgentState = { account: "test_acct", coin: 100n, items: {} };
  const resTrue = evaluateAgent(agentTrue, state, city, 1, {});
  assert.equal(resTrue.orders.length, 1);
  assert.equal(resTrue.orders[0].order_id, "agent:test_acct:1:r_price_true");
  assert.equal(resTrue.fees, 2n);

  const resFalse = evaluateAgent(agentFalse, state, city, 1, {});
  assert.equal(resFalse.orders.length, 0);
  assert.equal(resFalse.fees, 0n);
});

test("cond kind: stock across open businesses (true and false)", () => {
  const city = makeCity();
  // Count total grain stock across open businesses
  let totalGrain = 0n;
  for (const s of city.sectors) {
    for (const b of s.businesses) {
      if (b.open) totalGrain += b.inventory["grain"] ?? 0n;
    }
  }

  const agentTrue = parseAgent(
    {
      version: 1,
      name: "T",
      rules: [
        {
          id: "r_stock_true",
          when: [{ kind: "stock", item: "grain", op: "eq", value: totalGrain.toString() }],
          do: { kind: "buy", item: "grain", qty: "1", max_price: "15" },
        },
      ],
    },
    arc
  );
  const agentFalse = parseAgent(
    {
      version: 1,
      name: "F",
      rules: [
        {
          id: "r_stock_false",
          when: [{ kind: "stock", item: "grain", op: "gt", value: (totalGrain + 100n).toString() }],
          do: { kind: "buy", item: "grain", qty: "1", max_price: "15" },
        },
      ],
    },
    arc
  );

  const state: AgentState = { account: "test_acct", coin: 100n, items: {} };
  const resTrue = evaluateAgent(agentTrue, state, city, 1, {});
  assert.equal(resTrue.orders.length, 1);

  const resFalse = evaluateAgent(agentFalse, state, city, 1, {});
  assert.equal(resFalse.orders.length, 0);
});

test("cond kind: coin (true and false)", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "CoinTest",
      rules: [
        {
          id: "r_coin",
          when: [{ kind: "coin", op: "gte", value: "50" }],
          do: { kind: "buy", item: "bread", qty: "1", max_price: "20" },
        },
      ],
    },
    arc
  );

  const stateRich: AgentState = { account: "test_acct", coin: 100n, items: {} };
  const resRich = evaluateAgent(agent, stateRich, city, 1, {});
  assert.equal(resRich.orders.length, 1);

  const statePoor: AgentState = { account: "test_acct", coin: 40n, items: {} };
  const resPoor = evaluateAgent(agent, statePoor, city, 1, {});
  assert.equal(resPoor.orders.length, 0);
});

test("cond kind: holding (true and false)", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "HoldingTest",
      rules: [
        {
          id: "r_holding",
          when: [{ kind: "holding", item: "bread", op: "gte", value: "5" }],
          do: { kind: "sell", item: "bread", qty: "3", min_price: "10" },
        },
      ],
    },
    arc
  );

  const stateHasItems: AgentState = { account: "test_acct", coin: 100n, items: { bread: 6n } };
  const resHas = evaluateAgent(agent, stateHasItems, city, 1, {});
  assert.equal(resHas.orders.length, 1);
  assert.equal(resHas.orders[0].qty, 3n);

  const stateLacksItems: AgentState = { account: "test_acct", coin: 100n, items: { bread: 4n } };
  const resLacks = evaluateAgent(agent, stateLacksItems, city, 1, {});
  assert.equal(resLacks.orders.length, 0);
});

test("cond kind: season_in (true and false)", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "SeasonTest",
      rules: [
        {
          id: "r_season",
          when: [{ kind: "season_in", seasons: [0, 2] }],
          do: { kind: "buy", item: "bread", qty: "1", max_price: "20" },
        },
      ],
    },
    arc
  );

  const state: AgentState = { account: "test_acct", coin: 100n, items: {} };
  // Step 4 % 4 = 0 -> true
  const res0 = evaluateAgent(agent, state, city, 4, {});
  assert.equal(res0.orders.length, 1);

  // Step 5 % 4 = 1 -> false
  const res1 = evaluateAgent(agent, state, city, 5, {});
  assert.equal(res1.orders.length, 0);

  // Step 6 % 4 = 2 -> true
  const res2 = evaluateAgent(agent, state, city, 6, {});
  assert.equal(res2.orders.length, 1);
});

test("all-conds-must-hold", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "AllConds",
      rules: [
        {
          id: "r_multi",
          when: [
            { kind: "price", item: "bread", op: "eq", value: "20" }, // true
            { kind: "coin", op: "gte", value: "50" }, // true
            { kind: "holding", item: "bread", op: "gt", value: "10" }, // false
          ],
          do: { kind: "buy", item: "bread", qty: "1", max_price: "20" },
        },
      ],
    },
    arc
  );

  const state: AgentState = { account: "test_acct", coin: 100n, items: { bread: 5n } };
  const res = evaluateAgent(agent, state, city, 1, {});
  assert.equal(res.orders.length, 0);
});

test("order of evaluation (rules evaluated in listed order)", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "OrderTest",
      rules: [
        { id: "first", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "20" } },
        { id: "second", when: [], do: { kind: "buy", item: "grain", qty: "1", max_price: "10" } },
      ],
    },
    arc
  );

  const state: AgentState = { account: "test_acct", coin: 100n, items: {} };
  const res = evaluateAgent(agent, state, city, 1, {});
  assert.equal(res.orders.length, 2);
  assert.equal(res.orders[0].order_id, "agent:test_acct:1:first");
  assert.equal(res.orders[1].order_id, "agent:test_acct:1:second");
});

test("cooldown prevents refiring until cooldown elapsed", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "CooldownTest",
      rules: [
        { id: "r_cd", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "20" }, cooldown: 2 },
      ],
    },
    arc
  );

  const state: AgentState = { account: "test_acct", coin: 100n, items: {} };

  // Step 1: fires, lastFired becomes 1
  const res1 = evaluateAgent(agent, state, city, 1, {});
  assert.equal(res1.orders.length, 1);
  assert.equal(res1.lastFired["r_cd"], 1);

  // Step 2: 2 - 1 = 1 <= 2 -> does not fire
  const res2 = evaluateAgent(agent, state, city, 2, res1.lastFired);
  assert.equal(res2.orders.length, 0);

  // Step 3: 3 - 1 = 2 <= 2 -> does not fire
  const res3 = evaluateAgent(agent, state, city, 3, res1.lastFired);
  assert.equal(res3.orders.length, 0);

  // Step 4: 4 - 1 = 3 > 2 -> fires!
  const res4 = evaluateAgent(agent, state, city, 4, res1.lastFired);
  assert.equal(res4.orders.length, 1);
  assert.equal(res4.lastFired["r_cd"], 4);
});

test("per-step order cap of 4 orders", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "CapTest",
      rules: [
        { id: "r1", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
        { id: "r2", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
        { id: "r3", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
        { id: "r4", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
        { id: "r5", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
      ],
    },
    arc
  );

  const state: AgentState = { account: "test_acct", coin: 1000n, items: {} };
  const res = evaluateAgent(agent, state, city, 1, {});
  assert.equal(res.orders.length, 4);
  assert.equal(res.orders.map((o) => o.order_id).join(","), [
    "agent:test_acct:1:r1",
    "agent:test_acct:1:r2",
    "agent:test_acct:1:r3",
    "agent:test_acct:1:r4",
  ].join(","));
});

test("clamping to coin and holdings", () => {
  const city = makeCity();

  // Buy clamping: has 22 coin. Fee = 2n. Remaining = 20n. Max price = 10n. Can afford 20/10 = 2 units.
  // Rule asks for qty 5. Should clamp to 2.
  const agentBuy = parseAgent(
    {
      version: 1,
      name: "ClampBuy",
      rules: [
        { id: "buy_clamp", when: [], do: { kind: "buy", item: "bread", qty: "5", max_price: "10" } },
      ],
    },
    arc
  );
  const stateBuy: AgentState = { account: "test_acct", coin: 22n, items: {} };
  const resBuy = evaluateAgent(agentBuy, stateBuy, city, 1, {});
  assert.equal(resBuy.orders.length, 1);
  assert.equal(resBuy.orders[0].qty, 2n);

  // Buy clamping to 0: has 11 coin. Fee = 2n. Remaining = 9n. Max price = 10n. 9/10 = 0. Clamped to 0 -> skipped!
  const stateBuyPoor: AgentState = { account: "test_acct", coin: 11n, items: {} };
  const resBuyPoor = evaluateAgent(agentBuy, stateBuyPoor, city, 1, {});
  assert.equal(resBuyPoor.orders.length, 0);
  assert.equal(resBuyPoor.fees, 0n);

  // Sell clamping: has 3 units. Rule asks for 10 units. Clamped to 3.
  const agentSell = parseAgent(
    {
      version: 1,
      name: "ClampSell",
      rules: [
        { id: "sell_clamp", when: [], do: { kind: "sell", item: "bread", qty: "10", min_price: "5" } },
      ],
    },
    arc
  );
  const stateSell: AgentState = { account: "test_acct", coin: 100n, items: { bread: 3n } };
  const resSell = evaluateAgent(agentSell, stateSell, city, 1, {});
  assert.equal(resSell.orders.length, 1);
  assert.equal(resSell.orders[0].qty, 3n);

  // Sell clamping to 0: has 0 units -> skipped!
  const stateSellEmpty: AgentState = { account: "test_acct", coin: 100n, items: { bread: 0n } };
  const resSellEmpty = evaluateAgent(agentSell, stateSellEmpty, city, 1, {});
  assert.equal(resSellEmpty.orders.length, 0);
  assert.equal(resSellEmpty.fees, 0n);
});

test("fee cannot be paid prevents rule from firing", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "FeeTest",
      rules: [
        { id: "r1", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "1" } },
      ],
    },
    arc
  );

  // Fee is 2n. Agent has only 1n coin. Rule does not fire.
  const state: AgentState = { account: "test_acct", coin: 1n, items: {} };
  const res = evaluateAgent(agent, state, city, 1, {});
  assert.equal(res.orders.length, 0);
  assert.equal(res.fees, 0n);
});

test("determinism: identical inputs produce identical outputs", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "DetTest",
      rules: [
        { id: "r1", when: [{ kind: "coin", op: "gte", value: "20" }], do: { kind: "buy", item: "bread", qty: "3", max_price: "10" } },
        { id: "r2", when: [], do: { kind: "sell", item: "grain", qty: "2", min_price: "5" } },
      ],
    },
    arc
  );
  const state: AgentState = { account: "test_acct", coin: 100n, items: { grain: 10n } };
  const lastFired = { r2: 0 };

  const out1 = evaluateAgent(agent, state, city, 1, lastFired);
  const out2 = evaluateAgent(agent, state, city, 1, lastFired);

  assert.deepEqual(out1, out2);
});

test("purity: inputs are not mutated", () => {
  const city = makeCity();
  const agent = parseAgent(
    {
      version: 1,
      name: "PureTest",
      rules: [
        { id: "r1", when: [], do: { kind: "buy", item: "bread", qty: "2", max_price: "10" } },
        { id: "r2", when: [], do: { kind: "sell", item: "grain", qty: "3", min_price: "5" } },
      ],
    },
    arc
  );
  const state: AgentState = { account: "test_acct", coin: 100n, items: { grain: 10n } };
  const lastFired = { r1: 0 };

  const stateCopy = JSON.parse(JSON.stringify(state, (_, v) => typeof v === "bigint" ? v.toString() : v));
  const lastFiredCopy = { ...lastFired };

  evaluateAgent(agent, state, city, 2, lastFired);

  // Assert state not mutated
  assert.equal(state.coin, 100n);
  assert.equal(state.items.grain, 10n);
  // Assert lastFired not mutated
  assert.deepEqual(lastFired, lastFiredCopy);
});
