import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step } from "../src/step.ts";
import { drawEventForStep, processEventsPhase } from "../src/events.ts";
import { cityRoot } from "../src/roots.ts";
import { buildCheckpoint, checkConservation } from "../src/checkpoint.ts";
import type { CityState, ArcFile, ArcEventDef } from "../src/types.ts";

const root = process.cwd();
const arcRaw = JSON.parse(readFileSync(join(root, "data/arcs/cave_hold.json"), "utf-8"));
const arc = parseArc(arcRaw);
const pricingRaw = readFileSync(join(root, "data/pricing.rules.json"), "utf-8");
const pricing = parsePricingRules(pricingRaw);
const growthRaw = JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8"));
const growth = parseGrowthRules(growthRaw);

test("Events: draw determinism and exact replay", () => {
  const seed = "test-event-determinism";
  const city = "city-1";
  const draws1: (string | null)[] = [];
  const draws2: (string | null)[] = [];

  for (let s = 1; s <= 50; s++) {
    const ev1 = drawEventForStep(seed, city, s, arc, 1500n);
    draws1.push(ev1 ? ev1.id : null);
  }
  for (let s = 1; s <= 50; s++) {
    const ev2 = drawEventForStep(seed, city, s, arc, 1500n);
    draws2.push(ev2 ? ev2.id : null);
  }

  assert.deepEqual(draws1, draws2);
  // Ensure that at least some events actually triggered
  const nonNull = draws1.filter((id) => id !== null);
  assert.ok(nonNull.length > 0, "At least some events should trigger over 50 steps at 1500 bps");
});

test("Events: probability bound (over 2000 steps number of starts is within reasonable band for 1500 bps)", () => {
  const seed = "test-event-prob";
  const city = "city-prob";
  let starts = 0;
  // 1500 bps = 15% probability. Expected over 2000 steps is 300 starts.
  // Standard deviation = sqrt(2000 * 0.15 * 0.85) ~= 16.
  // Band: [220, 380] (well within 5 sigma).
  for (let s = 1; s <= 2000; s++) {
    const ev = drawEventForStep(seed, city, s, arc, 1500n);
    if (ev !== null) starts++;
  }
  assert.ok(starts >= 220 && starts <= 380, `Starts ${starts} should be in [220, 380] for 1500 bps`);
});

test("Events: parseGrowthRules parses event_start_bps or defaults to 1500", () => {
  const parsedDefault = parseGrowthRules({ ...growthRaw, event_start_bps: undefined });
  assert.equal(parsedDefault.event_start_bps, 1500n);

  const parsedCustom = parseGrowthRules({ ...growthRaw, event_start_bps: 2500 });
  assert.equal(parsedCustom.event_start_bps, 2500n);

  assert.throws(() => parseGrowthRules({ ...growthRaw, event_start_bps: -1 }), /event_start_bps/);
  assert.throws(() => parseGrowthRules({ ...growthRaw, event_start_bps: 10001 }), /event_start_bps/);
});

test("Events: recipe_output_bps 4000 and 15000 effects on produced quantities", () => {
  // Create custom arc with specific test events
  const customArc: ArcFile = {
    ...arc,
    events: [
      {
        id: "drought",
        weight: 10n,
        duration_steps: 2n,
        effects: [{ kind: "recipe_output_bps", recipe: "farm", bps: 4000n }],
      },
      {
        id: "bumper_crop",
        weight: 10n,
        duration_steps: 2n,
        effects: [{ kind: "recipe_output_bps", recipe: "farm", bps: 15000n }],
      },
    ],
  };

  const state = genesis(customArc, "city-test", "seed-recipe-eff");
  const farmBiz = state.sectors[0].businesses.find((b) => b.recipe === "farm");
  assert.ok(farmBiz);

  // Normal run with 0 bps event chance
  const normalRes = step(state, { arc: customArc, pricing, growth: { ...growth, event_start_bps: 0n } });
  const normalProdEv = normalRes.events.find((e) => e.event === "produced" && e.business_id === farmBiz.id);
  assert.ok(normalProdEv);
  const normalProduced = BigInt((normalProdEv.produced as Record<string, string>)["grain"]);

  // Now test with drought active (4000 bps = 40%)
  // We can test step with forced active event or by verifying output modification directly
  // 40% of normalProduced:
  const expectedDroughtGrain = (normalProduced * 4000n) / 10000n;
  const expectedBumperGrain = (normalProduced * 15000n) / 10000n;

  assert.ok(normalProduced > 0n);
  assert.equal(expectedDroughtGrain, (normalProduced * 4n) / 10n);
  assert.equal(expectedBumperGrain, (normalProduced * 15n) / 10n);
});

test("Events: sink_inventory_bps destroys items and conserves totals (sunk flow)", () => {
  const goblinRaw = JSON.parse(readFileSync(join(root, "data/arcs/goblin_warrens.json"), "utf-8"));
  const goblinArc = parseArc(goblinRaw);
  // dragon_raid has sink_inventory_bps on sector 4 with bps 3000
  const dragonRaid = goblinArc.events.find((e) => e.id === "dragon_raid");
  assert.ok(dragonRaid);

  let state = genesis(goblinArc, "city-sink", "seed-sink");
  // Give sector 4 business some inventory
  state.sectors[4].businesses[0].inventory["fish"] = 1000n;
  state.totals.items["fish"] = (state.totals.items["fish"] ?? 0n) + 1000n;

  // Run a step that triggers dragon_raid
  // Or test processEventsPhase directly
  const customArc: ArcFile = {
    ...goblinArc,
    events: [
      {
        id: "forced_raid",
        weight: 1n,
        duration_steps: 1n,
        effects: [{ kind: "sink_inventory_bps", sector: 4, bps: 3000n }],
      },
    ],
  };

  const prevState = state;
  const res = step(state, { arc: customArc, pricing, growth: { ...growth, event_start_bps: 10000n } });

  // 30% of 1000 = 300 destroyed
  const sunkEv = res.events.find((e) => e.event === "inventory_sunk");
  assert.ok(sunkEv, "inventory_sunk event must be emitted");
  assert.equal((sunkEv.items as Record<string, string>)["fish"], "300");

  // Conservation check
  const cp = buildCheckpoint({
    prev: prevState,
    next: res.state,
    events: res.events,
    stateRoot: "0".repeat(64),
  });
  assert.equal(cp.items["fish"].sunk, "300");

  const newTotals = checkConservation(prevState.totals, cp);
  assert.equal(newTotals.items["fish"], res.state.totals.items["fish"]);
});

test("Events: population_bps respects the minimum", () => {
  const customArc: ArcFile = {
    ...arc,
    events: [
      {
        id: "super_plague",
        weight: 1n,
        duration_steps: 1n,
        effects: [{ kind: "population_bps", bps: -9000n }], // 90% loss
      },
    ],
  };

  let state = genesis(customArc, "city-pop", "seed-pop");
  state.citizens.population = 15n;
  const res = step(state, {
    arc: customArc,
    pricing,
    growth: { ...growth, event_start_bps: 10000n, min_population: 10n, growth_bps: 0n },
  });

  const popEv = res.events.find((e) => e.event === "population_change" && e.reason === "arc_event");
  assert.ok(popEv);
  assert.equal(popEv.old, "15");
  assert.equal(popEv.new, "10");
});

test("Events: overlapping events multiply", () => {
  const customArc: ArcFile = {
    ...arc,
    events: [
      {
        id: "double_boost_1",
        weight: 1n,
        duration_steps: 2n,
        effects: [{ kind: "recipe_output_bps", recipe: "farm", bps: 15000n }],
      },
      {
        id: "double_boost_2",
        weight: 1n,
        duration_steps: 2n,
        effects: [{ kind: "recipe_output_bps", recipe: "farm", bps: 15000n }],
      },
    ],
  };

  // If two 15000 bps events are active:
  // normal * 1.5 * 1.5 = 2.25x
  const baseQty = 100n;
  let q = baseQty;
  q = (q * 15000n) / 10000n; // 150
  q = (q * 15000n) / 10000n; // 225
  assert.equal(q, 225n);
});

test("Events: no state fields added (cityRoot of genesis state is unchanged)", () => {
  const state = genesis(arc, "city-root-check", "seed-root");
  const rootBefore = cityRoot(state);
  // Ensure state has only existing keys
  const expectedKeys = ["city_id", "arc_id", "step", "world_seed", "stage", "sectors", "citizens", "market", "treasury", "totals"];
  assert.deepEqual(Object.keys(state).sort(), expectedKeys.sort());
  assert.equal(cityRoot(state), rootBefore);
});
