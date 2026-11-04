import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step, flowsFromEvents } from "../src/step.ts";
import { runSteps } from "../src/run.ts";

const pricingJson = readFileSync(join(process.cwd(), "data/pricing.rules.json"), "utf-8");
const pricing = parsePricingRules(pricingJson);

const growthJson = readFileSync(join(process.cwd(), "data/growth.rules.json"), "utf-8");
const growth = parseGrowthRules(growthJson);

const goblinArcJson = readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8");
const goblinArc = parseArc(JSON.parse(goblinArcJson));

const caveArcJson = readFileSync(join(process.cwd(), "data/arcs/cave_hold.json"), "utf-8");
const caveArc = parseArc(JSON.parse(caveArcJson));

test("T01: item conservation over 200 steps for BOTH real arcs", () => {
  for (const arc of [goblinArc, caveArc]) {
    const s0 = genesis(arc, "city-test", "seed-42");
    const { state: sFinal, events } = runSteps(s0, 200, { arc, pricing, growth });

    const flows = flowsFromEvents(events);

    // Sum inventory directly from all businesses
    const actualInventory: Record<string, bigint> = {};
    for (const item of arc.items) {
      actualInventory[item.id] = 0n;
    }
    for (const sector of sFinal.sectors) {
      for (const b of sector.businesses) {
        for (const [item, qty] of Object.entries(b.inventory)) {
          actualInventory[item] = (actualInventory[item] ?? 0n) + qty;
        }
      }
    }

    for (const item of arc.items) {
      const netFlow =
        (flows[item.id]?.produced ?? 0n) -
        (flows[item.id]?.consumed_recipe ?? 0n) -
        (flows[item.id]?.consumed_pop ?? 0n);

      assert.equal(
        sFinal.totals.items[item.id],
        netFlow,
        `Arc ${arc.id}: totals.items[${item.id}] must equal net flow from events`
      );

      assert.equal(
        sFinal.totals.items[item.id],
        actualInventory[item.id],
        `Arc ${arc.id}: totals.items[${item.id}] must equal actual sum of business inventories`
      );
    }
  }
});

test("T02: total coin is constant for 200 steps for BOTH real arcs", () => {
  for (const arc of [goblinArc, caveArc]) {
    const s0 = genesis(arc, "city-test", "seed-42");
    const initialCoin = s0.totals.coin;

    let curr = s0;
    for (let stepIdx = 0; stepIdx < 200; stepIdx++) {
      const { state: nextState } = step(curr, { arc, pricing, growth });

      let sumBusinessCoin = 0n;
      for (const sec of nextState.sectors) {
        for (const b of sec.businesses) {
          sumBusinessCoin += b.coin;
        }
      }
      const actualTotalCoin = sumBusinessCoin + nextState.citizens.purse + nextState.treasury;

      assert.equal(
        actualTotalCoin,
        initialCoin,
        `Arc ${arc.id} at step ${nextState.step}: sum business coin + purse + treasury must equal initial coin`
      );
      assert.equal(
        nextState.totals.coin,
        initialCoin,
        `Arc ${arc.id} at step ${nextState.step}: totals.coin must equal initial coin`
      );

      curr = nextState;
    }
  }
});

test("T03: determinism and purity", () => {
  const s0 = genesis(goblinArc, "city-det", "seed-99");
  const s0Copy = JSON.parse(JSON.stringify(s0, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

  const run1 = runSteps(s0, 50, { arc: goblinArc, pricing, growth });
  const run2 = runSteps(s0, 50, { arc: goblinArc, pricing, growth });

  assert.deepEqual(run1.roots, run2.roots, "Two runs from same state must produce identical roots");

  // Verify input state s0 was not mutated
  const s0After = JSON.parse(JSON.stringify(s0, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
  assert.deepEqual(s0Copy, s0After, "step/runSteps must not mutate input state");
});

test("world_advances_without_players: state differs after 100 steps", () => {
  const s0 = genesis(goblinArc, "city-adv", "seed-123");
  const { state: s100 } = runSteps(s0, 100, { arc: goblinArc, pricing, growth });

  assert.equal(s100.step, 100);
  assert.notEqual(s100.citizens.purse, s0.citizens.purse);
  // Total items produced > 0
  let totalItems = 0n;
  for (const qty of Object.values(s100.totals.items)) {
    totalItems += qty;
  }
  assert.ok(totalItems > 0n, "Items should have been produced over 100 steps");
});

test("property-based: non-negativity and satisfaction bounds over seeds and arcs", () => {
  const seeds = ["alpha", "beta", "gamma"];
  const arcs = [goblinArc, caveArc];

  for (const arc of arcs) {
    for (const seed of seeds) {
      const s0 = genesis(arc, `city-${seed}`, seed);
      let curr = s0;

      for (let s = 1; s <= 50; s++) {
        const { state: next } = step(curr, { arc, pricing, growth });

        assert.ok(next.citizens.purse >= 0n, `Citizens purse must be >= 0 at step ${s}`);
        assert.ok(
          next.citizens.satisfaction_bps >= 0n && next.citizens.satisfaction_bps <= 10000n,
          `Satisfaction must be in [0, 10000] at step ${s}, got ${next.citizens.satisfaction_bps}`
        );

        for (const sec of next.sectors) {
          for (const b of sec.businesses) {
            assert.ok(b.coin >= 0n, `Business ${b.id} coin must be >= 0 at step ${s}`);
            for (const [item, qty] of Object.entries(b.inventory)) {
              assert.ok(qty >= 0n, `Business ${b.id} inventory of ${item} must be >= 0 at step ${s}`);
            }
          }
        }

        curr = next;
      }
    }
  }
});
