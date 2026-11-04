import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  advanceWorld,
  getArc,
  getPricingRules,
} from "../src/lib/sim-adapter.ts";
import {
  stateToCityView,
  eventsToChronicle,
  calculateItemTrend,
  toTitleCase,
} from "../src/lib/sim-view.ts";
import { explainPrice, explainText } from "../../../packages/sim/src/pricing.ts";
import type { SimEvent } from "../../../packages/sim/src/types.ts";

describe("sim-view and sim-adapter", () => {
  it("mapping of a genesis state", () => {
    const world = createWorld("goblin_warrens", "seed-alpha");
    const view = stateToCityView(world.state, world.arc, world.pricing, {
      stateRoot: world.stateRoot,
      events: world.events,
    });

    assert.equal(view.arc_id, "goblin_warrens");
    assert.equal(view.step, 0);
    assert.equal(view.year, 0);
    assert.equal(view.season, "Spring");
    assert.equal(view.sectors.length, 6);
    assert.equal(view.market.length, 12);
    assert.ok(view.citizens.population > 0);
    assert.ok(view.stateRoot);
    assert.equal(view.stateRoot.length, 64);
  });

  it("mapping after 20 steps", () => {
    const world0 = createWorld("goblin_warrens", "seed-twenty");
    const world20 = advanceWorld(world0, 20);

    const view = stateToCityView(world20.state, world20.arc, world20.pricing, {
      stateRoot: world20.stateRoot,
      events: world20.events,
      prevPrices: world20.prevPrices,
    });

    assert.equal(view.step, 20);
    assert.equal(view.year, 5); // 20 / 4
    assert.equal(view.season, "Spring"); // 20 % 4 === 0
    assert.equal(view.sectors.length, 6);
    assert.equal(view.market.length, 12);
    assert.ok(world20.events.length > 0);
  });

  it("trend sign", () => {
    assert.equal(calculateItemTrend(15n, 10n), "up");
    assert.equal(calculateItemTrend(8n, 12n), "down");
    assert.equal(calculateItemTrend(10n, 10n), "flat");
    assert.equal(calculateItemTrend(10n, undefined), "flat");
  });

  it("tooltip text equals explainText of the sim", () => {
    const world = createWorld("goblin_warrens", "seed-tooltip");
    const arc = world.arc;
    const pricing = world.pricing;
    const view = stateToCityView(world.state, arc, pricing);

    // Pick first item (grain)
    const grainItem = arc.items[0];
    const grainMarketView = view.market.find((m) => m.id === grainItem.id);
    assert.ok(grainMarketView, "Grain must be in market view");

    // Manually run sim explainPrice
    const expectedReason = explainPrice({
      item: grainItem.id,
      base: grainItem.base_price,
      stock: world.state.totals.items[grainItem.id] ?? 0n,
      dem_ema: world.state.market.demand_ema[grainItem.id] ?? 0n,
      pricing,
    });
    const expectedSentence = explainText(expectedReason, pricing);

    assert.equal(grainMarketView.tooltip, expectedSentence);
  });

  it("chronicle from synthetic events", () => {
    const syntheticEvents: SimEvent[] = [
      { event: "business_closed", city_id: "test", step: 4, business_id: "farm-0" },
      { event: "business_opened", city_id: "test", step: 5, business_id: "bakery-1" },
      { event: "stage_up", city_id: "test", step: 6, stage: 1 },
      { event: "population_change", city_id: "test", step: 7, delta: 50, new_population: 900 },
      { event: "step_end", city_id: "test", step: 8, city_root: "0123456789abcdef0123456789abcdef" },
    ];

    const chronicle = eventsToChronicle(syntheticEvents);
    assert.equal(chronicle.length, 5);

    // Newest step should be first
    assert.equal(chronicle[0].step, 8);
    assert.equal(chronicle[0].kind, "civic");
    assert.ok(chronicle[0].description.includes("0123456789ab"));

    const closedEvent = chronicle.find((e) => e.step === 4);
    assert.ok(closedEvent);
    assert.equal(closedEvent.kind, "business");
    assert.ok(closedEvent.title.toLowerCase().includes("closed") || closedEvent.title.toLowerCase().includes("insolvent"));

    const openedEvent = chronicle.find((e) => e.step === 5);
    assert.ok(openedEvent);
    assert.equal(openedEvent.kind, "business");

    const stageEvent = chronicle.find((e) => e.step === 6);
    assert.ok(stageEvent);
    assert.equal(stageEvent.kind, "stage");

    const popEvent = chronicle.find((e) => e.step === 7);
    assert.ok(popEvent);
    assert.equal(popEvent.kind, "civic");
  });

  it("determinism (same seed, same view)", () => {
    const arc = getArc("goblin_warrens");
    const pricing = getPricingRules();

    const worldA = advanceWorld(createWorld("goblin_warrens", "deterministic-seed-xyz"), 12);
    const viewA = stateToCityView(worldA.state, arc, pricing, {
      stateRoot: worldA.stateRoot,
      events: worldA.events,
      prevPrices: worldA.prevPrices,
    });

    const worldB = advanceWorld(createWorld("goblin_warrens", "deterministic-seed-xyz"), 12);
    const viewB = stateToCityView(worldB.state, arc, pricing, {
      stateRoot: worldB.stateRoot,
      events: worldB.events,
      prevPrices: worldB.prevPrices,
    });

    assert.deepEqual(viewA, viewB);
  });

  it("dynamic sector naming and title case fallback for elf_grove", () => {
    const world = createWorld("elf_grove", "seed-elf-test");
    const view = stateToCityView(world.state, world.arc, world.pricing);

    // Sector 0 name equals the arc's 'Sylvan Canopy'
    assert.equal(view.sectors[0].name, "Sylvan Canopy");
    assert.equal(view.sectors[0].kind, "food");

    // Title case fallback
    assert.equal(toTitleCase("crystal_mine"), "Crystal Mine");
    assert.equal(toTitleCase("hearth_baker"), "Hearth Baker");
  });
});
