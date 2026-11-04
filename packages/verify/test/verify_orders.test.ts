import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseArc } from "../../sim/src/arc.ts";
import { genesis } from "../../sim/src/genesis.ts";
import { parsePricingRules } from "../../sim/src/pricing.ts";
import { parseGrowthRules } from "../../sim/src/growth.ts";
import { step } from "../../sim/src/step.ts";
import { eventRoot, cityRoot, nextStateRoot, genesisPrevRoot } from "../../sim/src/roots.ts";
import { buildCheckpoint } from "../../sim/src/checkpoint.ts";
import type { PlayerOrder } from "../../sim/src/orders.ts";
import type { SimEvent } from "../../sim/src/types.ts";
import { verifyCheckpoints, parseOrdersFile } from "../src/verify.ts";

const root = process.cwd();
const arc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs/goblin_warrens.json"), "utf-8")));
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));

function buildRun() {
  const ordersByStep: Record<number, PlayerOrder[]> = {
    3: [{ order_id: "a1", account: "alice.near", kind: "buy", item: "ore", qty: 10n, limit_price: 1000n }],
    5: [{ order_id: "a2", account: "bob.near", kind: "sell", item: "grain", qty: 5n, limit_price: 1n }],
    7: [{ order_id: "a3", account: "carol.near", kind: "invest", business_id: "mine-0", amount: 300n }],
  };
  let state = genesis(arc, "city-o", "seed-o");
  let prevRoot = genesisPrevRoot("city-o", "seed-o");
  const executed = new Set<string>();
  const prev = state;
  const events: SimEvent[] = [];
  let lastRoot = prevRoot;
  for (let s = 1; s <= 10; s++) {
    const res = step(state, { arc, pricing, growth, orders: ordersByStep[s] ?? [], executedIds: executed });
    for (const e of res.events) if (e.event === "order_accepted") executed.add(e.order_id as string);
    state = res.state;
    events.push(...res.events);
    lastRoot = nextStateRoot(lastRoot, state.step, eventRoot(res.events), cityRoot(state));
  }
  const cp = buildCheckpoint({ prev, next: state, events, stateRoot: lastRoot });
  return { cp, ordersByStep };
}

test("verify with orders: honest checkpoint verifies when the orders are supplied", () => {
  const { cp, ordersByStep } = buildRun();
  assert.ok(cp.executed_order_ids.length >= 2, "some orders really executed");
  const r = verifyCheckpoints({ arcId: "goblin_warrens", seed: "seed-o", cityId: "city-o", checkpoints: [cp], orders: ordersByStep });
  assert.equal(r.success, true, r.finalLine);
});

test("verify with orders: replay without the orders fails (flows and roots differ)", () => {
  const { cp } = buildRun();
  const r = verifyCheckpoints({ arcId: "goblin_warrens", seed: "seed-o", cityId: "city-o", checkpoints: [cp] });
  assert.equal(r.success, false);
});

test("verify with orders: a tampered order amount fails", () => {
  const { cp, ordersByStep } = buildRun();
  ordersByStep[7][0].amount = 301n;
  const r = verifyCheckpoints({ arcId: "goblin_warrens", seed: "seed-o", cityId: "city-o", checkpoints: [cp], orders: ordersByStep });
  assert.equal(r.success, false);
});

test("parseOrdersFile converts decimal strings to bigint and rejects malformed input", () => {
  const parsed = parseOrdersFile([{ step: 3, orders: [{ order_id: "x", account: "a.near", kind: "buy", item: "ore", qty: "10", limit_price: "5" }] }]);
  assert.equal(parsed[3][0].qty, 10n);
  assert.equal(parsed[3][0].limit_price, 5n);
  assert.throws(() => parseOrdersFile({ nope: 1 }), /orders file/);
  assert.throws(() => parseOrdersFile([{ step: "x", orders: [] }]), /step/);
});

test("CLI --orders: honest passes (exit 0), tampered fails (exit 1)", () => {
  const { cp, ordersByStep } = buildRun();
  const dir = mkdtempSync(join(tmpdir(), "verify-orders-"));
  const ser = (o: Record<number, PlayerOrder[]>) =>
    Object.entries(o).map(([step, orders]) => ({
      step: Number(step),
      orders: orders.map((x) => ({ ...x, qty: x.qty?.toString(), limit_price: x.limit_price?.toString(), amount: x.amount?.toString() })),
    }));
  writeFileSync(join(dir, "cp.json"), JSON.stringify([cp]));
  writeFileSync(join(dir, "orders.json"), JSON.stringify(ser(ordersByStep)));
  const base = ["packages/verify/cli.ts", "--arc", "goblin_warrens", "--seed", "seed-o", "--city", "city-o", "--checkpoints", join(dir, "cp.json")];
  const ok = spawnSync("node", [...base, "--orders", join(dir, "orders.json")], { cwd: root, encoding: "utf-8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  ordersByStep[7][0].amount = 999n;
  writeFileSync(join(dir, "orders_bad.json"), JSON.stringify(ser(ordersByStep)));
  const bad = spawnSync("node", [...base, "--orders", join(dir, "orders_bad.json")], { cwd: root, encoding: "utf-8" });
  assert.equal(bad.status, 1);
});
