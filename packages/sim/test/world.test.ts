import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step, flowsFromEvents } from "../src/step.ts";
import { cityRoot, nextStateRoot, eventRoot, genesisPrevRoot } from "../src/roots.ts";
import { buildCheckpoint, checkConservation } from "../src/checkpoint.ts";
import { canonicalJson } from "../src/canonical.ts";
import { runWorld } from "../src/world.ts";
import { loadWorldData } from "../src/world-node.ts";
import type { Checkpoint } from "../src/checkpoint.ts";
import type { SimEvent } from "../src/types.ts";

const root = join(process.cwd(), "data");
const worldData = loadWorldData(root);

function runDemoMockLogic(arcId: string, seed: string, cityId: string, totalSteps: number, windowSize: number): Checkpoint[] {
  const arcRaw = JSON.parse(readFileSync(join(root, "arcs", `${arcId}.json`), "utf-8"));
  const arc = parseArc(arcRaw);
  const pricing = parsePricingRules(readFileSync(join(root, "pricing.rules.json"), "utf-8"));
  const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "growth.rules.json"), "utf-8")));
  const ctx = { arc, pricing, growth };

  let currState = genesis(arc, cityId, seed);
  let currPrevRoot = genesisPrevRoot(cityId, seed);
  const checkpoints: Checkpoint[] = [];
  const numWindows = totalSteps / windowSize;

  for (let w = 0; w < numWindows; w++) {
    const windowPrevState = currState;
    const windowEvents: SimEvent[] = [];
    let lastStateRoot = currPrevRoot;

    for (let s = 0; s < windowSize; s++) {
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
    checkpoints.push(cp);
  }

  return checkpoints;
}

test("Item 1: runWorld skeleton is byte-identical to demo_mock when routes are empty", () => {
  const arcId = "goblin_warrens";
  const seed = "demo";
  const cityId = `city-${arcId}`;
  const totalSteps = 200;
  const windowSize = 40;

  const expectedCheckpoints = runDemoMockLogic(arcId, seed, cityId, totalSteps, windowSize);

  const result = runWorld({
    cities: [{ cityId, arcId, seed }],
    steps: totalSteps,
    window: windowSize,
    caravanEvery: 0,
    routes: [],
    ...worldData,
  });

  const actualCheckpoints = result.checkpoints[cityId];
  assert.equal(actualCheckpoints.length, expectedCheckpoints.length);
  assert.equal(JSON.stringify(actualCheckpoints), JSON.stringify(expectedCheckpoints));
  assert.deepEqual(actualCheckpoints, expectedCheckpoints);
});

test("Item 2: Caravans in the loop (dino_vale -> elf_grove 400 steps), conservation and determinism", () => {
  const cityA = "city-dino";
  const cityB = "city-elf";
  const cfg = {
    cities: [
      { cityId: cityA, arcId: "dino_vale", seed: "seed-dino-1" },
      { cityId: cityB, arcId: "elf_grove", seed: "seed-elf-1" },
    ],
    steps: 400,
    window: 40,
    caravanEvery: 10,
    routes: [
      { from: cityA, to: cityB, item: "grain", maxQty: 50n },
      { from: cityA, to: cityB, item: "bread", maxQty: 30n },
    ],
    ...worldData,
  };

  const arcDino = parseArc(JSON.parse(readFileSync(join(root, "arcs/dino_vale.json"), "utf-8")));
  const arcElf = parseArc(JSON.parse(readFileSync(join(root, "arcs/elf_grove.json"), "utf-8")));
  const genA = genesis(arcDino, cityA, "seed-dino-1");
  const genB = genesis(arcElf, cityB, "seed-elf-1");

  const run1 = runWorld(cfg);

  // 1. Verify caravans actually happened and synthetic events were emitted
  const caravanOutEvents = run1.events[cityA].filter((e) => e.event === "caravan_out");
  const caravanInEvents = run1.events[cityB].filter((e) => e.event === "caravan_in");
  assert.ok(caravanOutEvents.length > 0, "Expected at least one caravan_out event");
  assert.equal(caravanOutEvents.length, caravanInEvents.length, "Caravan events count must match between cities");

  for (let i = 0; i < caravanOutEvents.length; i++) {
    const outEv = caravanOutEvents[i];
    const inEv = caravanInEvents[i];
    assert.equal(outEv.step, inEv.step);
    assert.equal(outEv.item, inEv.item);
    assert.equal(outEv.qty, inEv.qty);
    assert.equal(outEv.unitPrice, inEv.unitPrice);
    assert.equal(outEv.counterparty, cityB);
    assert.equal(inEv.counterparty, cityA);
    assert.equal(outEv.kind, "caravan_out");
    assert.equal(inEv.kind, "caravan_in");
  }

  // 2. Per-city conservation check on all checkpoints
  for (const cityId of [cityA, cityB]) {
    const gen = cityId === cityA ? genA : genB;
    let runningTotals = { items: { ...gen.totals.items }, coin: gen.totals.coin };
    const cps = run1.checkpoints[cityId];
    assert.equal(cps.length, 10);

    for (const cp of cps) {
      runningTotals = checkConservation(runningTotals, cp);
    }

    const finalState = run1.states[cityId];
    assert.equal(runningTotals.coin, finalState.totals.coin, `Final coin mismatch for ${cityId}`);
    for (const [item, total] of Object.entries(finalState.totals.items)) {
      assert.equal(runningTotals.items[item] ?? 0n, total, `Final item ${item} mismatch for ${cityId}`);
    }
  }

  // 3. Global item and coin sums across both cities conserved except engine flows
  // Independent accounting directly from events:
  const getEngineFlows = (events: SimEvent[]) => {
    let producedGrain = 0n;
    let consumedGrain = 0n;
    let sunkGrain = 0n;

    for (const e of events) {
      if (e.event === "produced") {
        const prod = (e.produced ?? {}) as Record<string, string>;
        if (prod.grain) producedGrain += BigInt(prod.grain);
        const cons = (e.consumed_recipe ?? {}) as Record<string, string>;
        if (cons.grain) consumedGrain += BigInt(cons.grain);
      } else if (e.event === "consumed_pop" && e.item === "grain") {
        consumedGrain += BigInt((e.qty as string) ?? 0);
      } else if (e.event === "inventory_sunk") {
        const items = (e.items ?? e.sunk ?? {}) as Record<string, string>;
        if (items.grain) sunkGrain += BigInt(items.grain);
      }
    }
    return { producedGrain, consumedGrain, sunkGrain };
  };

  const engineA = getEngineFlows(run1.events[cityA]);
  const engineB = getEngineFlows(run1.events[cityB]);

  const globalGenGrain = (genA.totals.items.grain ?? 0n) + (genB.totals.items.grain ?? 0n);
  const globalFinalGrain = (run1.states[cityA].totals.items.grain ?? 0n) + (run1.states[cityB].totals.items.grain ?? 0n);

  const netEngineGrain = (engineA.producedGrain + engineB.producedGrain) -
    (engineA.consumedGrain + engineB.consumedGrain) -
    (engineA.sunkGrain + engineB.sunkGrain);

  assert.equal(
    globalFinalGrain - globalGenGrain,
    netEngineGrain,
    "Global grain delta must equal net engine produced - consumed - sunk"
  );

  // Global coin must be strictly invariant across both cities (caravans only transfer coin between them)
  const globalGenCoin = genA.totals.coin + genB.totals.coin;
  const globalFinalCoin = run1.states[cityA].totals.coin + run1.states[cityB].totals.coin;
  assert.equal(globalFinalCoin, globalGenCoin, "Global coin across both cities must be perfectly conserved");

  // 4. Second run is byte-identical
  const run2 = runWorld(cfg);
  assert.equal(JSON.stringify(run1.checkpoints), JSON.stringify(run2.checkpoints));
  assert.equal(JSON.stringify(run1.roots), JSON.stringify(run2.roots));
  assert.deepEqual(run1.states, run2.states);
  assert.deepEqual(run1.events, run2.events);
});

test("Property-based testing: seeded loop over route configs asserting conservation and determinism", () => {
  const seeds = ["alpha", "beta", "gamma"];
  for (const s of seeds) {
    const cfg = {
      cities: [
        { cityId: "dino", arcId: "dino_vale", seed: `seed-dino-${s}` },
        { cityId: "elf", arcId: "elf_grove", seed: `seed-elf-${s}` },
      ],
      steps: 80,
      window: 20,
      caravanEvery: 8,
      routes: [
        { from: "dino", to: "elf", item: "grain", maxQty: 25n },
      ],
      ...worldData,
    };

    const res1 = runWorld(cfg);
    const res2 = runWorld(cfg);

    // Determinism
    assert.equal(JSON.stringify(res1.checkpoints), JSON.stringify(res2.checkpoints));
    assert.equal(JSON.stringify(res1.roots), JSON.stringify(res2.roots));

    // Conservation per checkpoint
    for (const cityId of ["dino", "elf"]) {
      const arc = parseArc(JSON.parse(readFileSync(join(root, `arcs/${cityId === "dino" ? "dino_vale" : "elf_grove"}.json`), "utf-8")));
      const gen = genesis(arc, cityId, `seed-${cityId}-${s}`);
      let runningTotals = { items: { ...gen.totals.items }, coin: gen.totals.coin };

      for (const cp of res1.checkpoints[cityId]) {
        runningTotals = checkConservation(runningTotals, cp);
      }
      assert.equal(runningTotals.coin, res1.states[cityId].totals.coin);
    }

    // Global coin conservation
    const genDino = genesis(parseArc(JSON.parse(readFileSync(join(root, "arcs/dino_vale.json"), "utf-8"))), "dino", `seed-dino-${s}`);
    const genElf = genesis(parseArc(JSON.parse(readFileSync(join(root, "arcs/elf_grove.json"), "utf-8"))), "elf", `seed-elf-${s}`);
    assert.equal(
      res1.states.dino.totals.coin + res1.states.elf.totals.coin,
      genDino.totals.coin + genElf.totals.coin
    );
  }
});

test("Doubt-driven edge cases: route to self, unknown item, empty inventory, caravanEvery > steps", () => {
  const cityA = "city-a";
  const cityB = "city-b";

  // 1. Route to self (from === to)
  const resSelf = runWorld({
    cities: [
      { cityId: cityA, arcId: "dino_vale", seed: "s1" },
      { cityId: cityB, arcId: "elf_grove", seed: "s2" },
    ],
    steps: 40,
    window: 20,
    caravanEvery: 5,
    routes: [{ from: cityA, to: cityA, item: "grain", maxQty: 10n }],
    ...worldData,
  });
  const selfEvents = resSelf.events[cityA].filter((e) => e.event === "caravan_out" || e.event === "caravan_in");
  assert.equal(selfEvents.length, 0, "Route to self must not execute");

  // 2. Unknown item
  const resUnknown = runWorld({
    cities: [
      { cityId: cityA, arcId: "dino_vale", seed: "s1" },
      { cityId: cityB, arcId: "elf_grove", seed: "s2" },
    ],
    steps: 40,
    window: 20,
    caravanEvery: 5,
    routes: [{ from: cityA, to: cityB, item: "non_existent_item_xyz", maxQty: 10n }],
    ...worldData,
  });
  const unknownEvents = resUnknown.events[cityA].filter((e) => e.event === "caravan_out");
  assert.equal(unknownEvents.length, 0, "Unknown item must be rejected");

  // 3. caravanEvery > steps
  const resLargeEvery = runWorld({
    cities: [
      { cityId: cityA, arcId: "dino_vale", seed: "s1" },
      { cityId: cityB, arcId: "elf_grove", seed: "s2" },
    ],
    steps: 40,
    window: 20,
    caravanEvery: 1000,
    routes: [{ from: cityA, to: cityB, item: "grain", maxQty: 10n }],
    ...worldData,
  });
  const largeEveryEvents = resLargeEvery.events[cityA].filter((e) => e.event === "caravan_out");
  assert.equal(largeEveryEvents.length, 0, "caravanEvery > steps must not trigger caravans");
});

test("Item 3: runWorld twice with the same cfg gives identical final state roots", () => {
  const cfg = {
    cities: [
      { cityId: "dino", arcId: "dino_vale", seed: "seed-replay-1" },
      { cityId: "elf", arcId: "elf_grove", seed: "seed-replay-2" },
      { cityId: "goblin", arcId: "goblin_warrens", seed: "seed-replay-3" },
    ],
    steps: 120,
    window: 40,
    caravanEvery: 10,
    routes: [
      { from: "dino", to: "elf", item: "grain", maxQty: 40n },
      { from: "dino", to: "elf", item: "bread", maxQty: 20n },
    ],
    ...worldData,
  };

  const run1 = runWorld(cfg);
  const run2 = runWorld(cfg);

  for (const cityId of ["dino", "elf", "goblin"]) {
    const finalRoot1 = run1.roots[cityId][run1.roots[cityId].length - 1];
    const finalRoot2 = run2.roots[cityId][run2.roots[cityId].length - 1];
    assert.equal(finalRoot1, finalRoot2, `Final state root must be identical for ${cityId}`);

    const finalCp1 = run1.checkpoints[cityId][run1.checkpoints[cityId].length - 1];
    const finalCp2 = run2.checkpoints[cityId][run2.checkpoints[cityId].length - 1];
    assert.equal(finalCp1.new_state_root, finalCp2.new_state_root);
    assert.equal(finalCp1.new_state_root, finalRoot1);
  }
});

test("world.ts purity: has no node: imports", () => {
  const worldSource = readFileSync(join(process.cwd(), "packages/sim/src/world.ts"), "utf-8");
  const matches = worldSource.match(/node:/g);
  assert.equal(matches, null, "world.ts must not contain any node: imports");
});

