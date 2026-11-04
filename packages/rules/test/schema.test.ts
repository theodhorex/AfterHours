import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseAgent,
  MAX_RULES,
  MAX_CONDS,
  MAX_ORDERS_PER_STEP,
  FEE_PER_FIRED_RULE,
  type Agent,
} from "../src/schema.ts";
import { parseArc } from "../../sim/src/arc.ts";

const arcPath = join(process.cwd(), "data/arcs/goblin_warrens.json");
const arc = parseArc(JSON.parse(readFileSync(arcPath, "utf-8")));

test("schema constants have expected values", () => {
  assert.equal(MAX_RULES, 8);
  assert.equal(MAX_CONDS, 3);
  assert.equal(MAX_ORDERS_PER_STEP, 4);
  assert.equal(FEE_PER_FIRED_RULE, 2n);
});

test("parseAgent successfully parses a valid agent", () => {
  const json = {
    version: 1,
    name: "Goblin Trader",
    rules: [
      {
        id: "buy_cheap_bread",
        when: [
          { kind: "price", item: "bread", op: "lt", value: "15" },
          { kind: "coin", op: "gte", value: "30" },
          { kind: "season_in", seasons: [0, 1] },
        ],
        do: { kind: "buy", item: "bread", qty: "10", max_price: "15" },
        cooldown: 2,
      },
      {
        id: "sell_high_bread",
        when: [
          { kind: "stock", item: "bread", op: "gt", value: "50" },
          { kind: "holding", item: "bread", op: "gte", value: "5" },
        ],
        do: { kind: "sell", item: "bread", qty: "5", min_price: "25" },
      },
    ],
  };

  const agent = parseAgent(json, arc);
  assert.equal(agent.version, 1);
  assert.equal(agent.name, "Goblin Trader");
  assert.equal(agent.rules.length, 2);

  const r1 = agent.rules[0];
  assert.equal(r1.id, "buy_cheap_bread");
  assert.equal(r1.cooldown, 2);
  assert.equal(r1.when.length, 3);
  assert.deepEqual(r1.when[0], { kind: "price", item: "bread", op: "lt", value: 15n });
  assert.deepEqual(r1.when[1], { kind: "coin", op: "gte", value: 30n });
  assert.deepEqual(r1.when[2], { kind: "season_in", seasons: [0, 1] });
  assert.deepEqual(r1.do, { kind: "buy", item: "bread", qty: 10n, max_price: 15n });

  const r2 = agent.rules[1];
  assert.equal(r2.id, "sell_high_bread");
  assert.equal(r2.cooldown, 0); // default cooldown 0
  assert.equal(r2.when.length, 2);
  assert.deepEqual(r2.when[0], { kind: "stock", item: "bread", op: "gt", value: 50n });
  assert.deepEqual(r2.when[1], { kind: "holding", item: "bread", op: "gte", value: 5n });
  assert.deepEqual(r2.do, { kind: "sell", item: "bread", qty: 5n, min_price: 25n });
});

// Negative tests: 2 variants per field class

test("negative test: unknown item (cond & action)", () => {
  // variant 1: unknown item in cond
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Bad Item Cond",
          rules: [
            {
              id: "r1",
              when: [{ kind: "price", item: "dragon_scales_nonexistent", op: "lt", value: "10" }],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /item.*dragon_scales_nonexistent/i
  );

  // variant 2: unknown item in action
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Bad Item Action",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "buy", item: "unobtainium", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /item.*unobtainium/i
  );
});

test("negative test: bad op (invalid string & non-string)", () => {
  // variant 1: invalid op string
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Bad Op",
          rules: [
            {
              id: "r1",
              when: [{ kind: "coin", op: "neq", value: "10" }],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /op.*neq/i
  );

  // variant 2: non-string op
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Non-string Op",
          rules: [
            {
              id: "r1",
              when: [{ kind: "coin", op: 123, value: "10" }],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /op/i
  );
});

test("negative test: 9 rules (9 and 10 rules)", () => {
  const makeRules = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `r_${i}`,
      when: [],
      do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
    }));

  // variant 1: 9 rules
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Nine Rules",
          rules: makeRules(9),
        },
        arc
      ),
    /rules.*8/i
  );

  // variant 2: 10 rules
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Ten Rules",
          rules: makeRules(10),
        },
        arc
      ),
    /rules.*8/i
  );
});

test("negative test: 4 conds (4 and 5 conds)", () => {
  // variant 1: 4 conds
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Four Conds",
          rules: [
            {
              id: "r1",
              when: [
                { kind: "coin", op: "gt", value: "1" },
                { kind: "coin", op: "gt", value: "2" },
                { kind: "coin", op: "gt", value: "3" },
                { kind: "coin", op: "gt", value: "4" },
              ],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /when|cond/i
  );

  // variant 2: 5 conds
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Five Conds",
          rules: [
            {
              id: "r1",
              when: [
                { kind: "coin", op: "gt", value: "1" },
                { kind: "coin", op: "gt", value: "2" },
                { kind: "coin", op: "gt", value: "3" },
                { kind: "coin", op: "gt", value: "4" },
                { kind: "coin", op: "gt", value: "5" },
              ],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /when|cond/i
  );
});

test("negative test: qty 0 (buy & sell)", () => {
  // variant 1: buy qty 0
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Zero Qty Buy",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "buy", item: "bread", qty: "0", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /qty/i
  );

  // variant 2: sell qty 0
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Zero Qty Sell",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "sell", item: "bread", qty: "0", min_price: "10" },
            },
          ],
        },
        arc
      ),
    /qty/i
  );
});

test("negative test: qty 1001 (1001 and 2000)", () => {
  // variant 1: qty 1001
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "1001 Qty",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "buy", item: "bread", qty: "1001", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /qty/i
  );

  // variant 2: qty 2000
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "2000 Qty",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "sell", item: "bread", qty: "2000", min_price: "10" },
            },
          ],
        },
        arc
      ),
    /qty/i
  );
});

test("negative test: negative price (buy max_price & sell min_price)", () => {
  // variant 1: buy negative max_price
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Negative Buy Price",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "buy", item: "bread", qty: "10", max_price: "-10" },
            },
          ],
        },
        arc
      ),
    /max_price|price/i
  );

  // variant 2: sell negative min_price
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Negative Sell Price",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "sell", item: "bread", qty: "10", min_price: "-1" },
            },
          ],
        },
        arc
      ),
    /min_price|price/i
  );
});

test("negative test: non-string number (value as number & qty as number)", () => {
  // variant 1: cond value as number
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Number Value",
          rules: [
            {
              id: "r1",
              when: [{ kind: "coin", op: "gte", value: 100 }],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /value.*string/i
  );

  // variant 2: action qty as number
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Number Qty",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "buy", item: "bread", qty: 5, max_price: "10" },
            },
          ],
        },
        arc
      ),
    /qty.*string/i
  );
});

test("negative test: season 4 (season 4 and season -1)", () => {
  // variant 1: season 4
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Season 4",
          rules: [
            {
              id: "r1",
              when: [{ kind: "season_in", seasons: [4] }],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /season/i
  );

  // variant 2: season -1
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Season -1",
          rules: [
            {
              id: "r1",
              when: [{ kind: "season_in", seasons: [-1] }],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
            },
          ],
        },
        arc
      ),
    /season/i
  );
});

test("negative test: duplicate ids (two rules & three rules)", () => {
  // variant 1: two rules with id "r1"
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Dup Ids",
          rules: [
            { id: "r1", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
            { id: "r1", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
          ],
        },
        arc
      ),
    /duplicate.*r1/i
  );

  // variant 2: three rules with duplicate "r2"
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Dup Ids 2",
          rules: [
            { id: "r2", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
            { id: "r1", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
            { id: "r2", when: [], do: { kind: "buy", item: "bread", qty: "1", max_price: "10" } },
          ],
        },
        arc
      ),
    /duplicate.*r2/i
  );
});

test("negative test: cooldown negative (cooldown -1 and cooldown -5)", () => {
  // variant 1: cooldown -1
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Negative Cooldown",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
              cooldown: -1,
            },
          ],
        },
        arc
      ),
    /cooldown/i
  );

  // variant 2: cooldown -5
  assert.throws(
    () =>
      parseAgent(
        {
          version: 1,
          name: "Negative Cooldown 2",
          rules: [
            {
              id: "r1",
              when: [],
              do: { kind: "buy", item: "bread", qty: "1", max_price: "10" },
              cooldown: -5,
            },
          ],
        },
        arc
      ),
    /cooldown/i
  );
});
