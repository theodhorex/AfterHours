import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step, flowsFromEvents } from "../src/step.ts";
import { runSteps } from "../src/run.ts";
import { cityRoot, nextStateRoot, eventRoot, genesisPrevRoot } from "../src/roots.ts";
import {
  buildCheckpoint,
  arcCaps,
  checkConservation,
} from "../src/checkpoint.ts";
import type { CityState, SimEvent } from "../src/types.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const arcFiles = readdirSync(join(root, "data/arcs")).filter((f) => f.endsWith(".json")).sort();
const arcs = arcFiles.map((f) => parseArc(JSON.parse(readFileSync(join(root, "data/arcs", f), "utf-8"))));

test("buildCheckpoint returns exact Rust Checkpoint shape with valid aggregated flows", () => {
  const arc = arcs.find((a) => a.id === "goblin_warrens")!;
  const s0 = genesis(arc, "city-test", "seed-cp-shape");
  const ctx = { arc, pricing, growth };
  const { state: s10, events, roots } = runSteps(s0, 10, ctx);

  const cp = buildCheckpoint({
    prev: s0,
    next: s10,
    events,
    stateRoot: roots[roots.length - 1],
  });

  assert.equal(cp.city_id, "city-test");
  assert.equal(cp.from_step, 0);
  assert.equal(cp.to_step, 10);
  assert.equal(cp.new_state_root, roots[roots.length - 1]);
  assert.equal(cp.new_city_root, cityRoot(s10));
  assert.equal(cp.stage, s10.stage);
  assert.deepEqual(cp.player_deltas, []);
  assert.deepEqual(cp.executed_order_ids, []);

  // Coin flow
  assert.deepEqual(cp.coin, {
    sourced: "0",
    sunk: "0",
    trade_to_players: "0",
    trade_from_players: "0",
  });

  // Items flow
  const flows = flowsFromEvents(events);
  for (const item of arc.items) {
    const itemFlow = cp.items[item.id];
    assert.ok(itemFlow, `missing item flow for ${item.id}`);
    const expectedProd = (flows[item.id]?.produced ?? 0n).toString();
    const expectedConsRecipe = (flows[item.id]?.consumed_recipe ?? 0n).toString();
    const expectedConsPop = (flows[item.id]?.consumed_pop ?? 0n).toString();

    assert.equal(itemFlow.produced, expectedProd);
    assert.equal(itemFlow.consumed_recipe, expectedConsRecipe);
    assert.equal(itemFlow.consumed_pop, expectedConsPop);
    assert.equal(itemFlow.sourced, "0");
    assert.equal(itemFlow.sunk, "0");
    assert.equal(itemFlow.trade_to_players, "0");
    assert.equal(itemFlow.trade_from_players, "0");
  }
});

test("arcCaps: safe upper bounds are never exceeded in 400-step runs across all four arcs", () => {
  for (const arc of arcs) {
    const caps = arcCaps(arc);
    assert.equal(caps.arc_id, arc.id);

    // Verify all cap fields are valid decimal strings
    assert.match(caps.coin_source_cap_per_step, /^\d+$/);
    assert.match(caps.coin_sink_cap_per_step, /^\d+$/);

    for (const item of arc.items) {
      assert.match(caps.produce_cap_per_step[item.id] ?? "", /^\d+$/);
      assert.match(caps.consume_cap_per_step[item.id] ?? "", /^\d+$/);
      assert.match(caps.source_cap_per_step[item.id] ?? "", /^\d+$/);
      assert.match(caps.sink_cap_per_step[item.id] ?? "", /^\d+$/);
    }

    // Run 400 steps and assert every single step does not exceed caps
    let currState = genesis(arc, `city-${arc.id}`, "seed-caps-test");
    const ctx = { arc, pricing, growth };

    for (let s = 1; s <= 400; s++) {
      const res = step(currState, ctx);
      const stepFlows = flowsFromEvents(res.events);

      for (const item of arc.items) {
        const prod = stepFlows[item.id]?.produced ?? 0n;
        const cons = (stepFlows[item.id]?.consumed_recipe ?? 0n) + (stepFlows[item.id]?.consumed_pop ?? 0n);
        const prodCap = BigInt(caps.produce_cap_per_step[item.id]);
        const consCap = BigInt(caps.consume_cap_per_step[item.id]);

        assert.ok(
          prod <= prodCap,
          `Arc ${arc.id} step ${s} item ${item.id} produced ${prod} exceeded cap ${prodCap}`
        );
        assert.ok(
          cons <= consCap,
          `Arc ${arc.id} step ${s} item ${item.id} consumed ${cons} exceeded cap ${consCap}`
        );
      }
      currState = res.state;
    }
  }
});

test("checkConservation: mirrors contract arithmetic and passes over 400 steps in 40-step windows for all 4 arcs", () => {
  for (const arc of arcs) {
    let currState = genesis(arc, `city-${arc.id}`, "seed-conservation-test");
    let currPrevRoot = genesisPrevRoot(currState.city_id, currState.world_seed);
    const ctx = { arc, pricing, growth };
    const WINDOW = 40;
    const TOTAL_STEPS = 400;

    for (let w = 0; w < TOTAL_STEPS / WINDOW; w++) {
      const windowPrevState = currState;
      const windowEvents: SimEvent[] = [];
      let lastStateRoot = currPrevRoot;

      for (let s = 0; s < WINDOW; s++) {
        const res = step(currState, ctx);
        currState = res.state;
        windowEvents.push(...res.events);

        const eRoot = eventRoot(res.events);
        const cRoot = cityRoot(currState);
        lastStateRoot = nextStateRoot(currPrevRoot, currState.step, eRoot, cRoot);
        currPrevRoot = lastStateRoot;
      }

      const cp = buildCheckpoint({
        prev: windowPrevState,
        next: currState,
        events: windowEvents,
        stateRoot: lastStateRoot,
      });

      const nextTotals = checkConservation(windowPrevState.totals, cp);

      // Assert BigInt equality for all items
      for (const item of arc.items) {
        assert.equal(
          nextTotals.items[item.id],
          currState.totals.items[item.id],
          `Arc ${arc.id} window ${w} item ${item.id} totals mismatch`
        );
      }

      // Assert coin conserved
      assert.equal(
        nextTotals.coin,
        currState.totals.coin,
        `Arc ${arc.id} window ${w} coin totals mismatch`
      );
    }
  }
});

test("checkConservation: throws CONSERVATION_UNDERFLOW on tampered deductions", () => {
  const arc = arcs[0];
  const s0 = genesis(arc, "city-test", "seed-tamper");
  const ctx = { arc, pricing, growth };
  const { state: s10, events, roots } = runSteps(s0, 10, ctx);

  const cp = buildCheckpoint({
    prev: s0,
    next: s10,
    events,
    stateRoot: roots[roots.length - 1],
  });

  // Tamper item consumed_recipe to an absurdly high number
  const firstItem = arc.items[0].id;
  const tamperedItemCp = JSON.parse(JSON.stringify(cp));
  tamperedItemCp.items[firstItem].consumed_recipe = "999999999999999";

  assert.throws(
    () => checkConservation(s0.totals, tamperedItemCp),
    /CONSERVATION_UNDERFLOW/
  );

  // Tamper coin sunk to an absurdly high number
  const tamperedCoinCp = JSON.parse(JSON.stringify(cp));
  tamperedCoinCp.coin.sunk = "999999999999999";

  assert.throws(
    () => checkConservation(s0.totals, tamperedCoinCp),
    /CONSERVATION_UNDERFLOW/
  );
});
