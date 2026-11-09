import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSupplyStatus,
  calculateSpread,
  buildGlobalMarketRows,
  getBestTrades,
} from "../src/lib/global-market.ts";
import { createWorld, advanceWorld } from "../src/lib/sim-adapter.ts";
import { stateToCityView, type CityView } from "../src/lib/sim-view.ts";

describe("global market engine", () => {
  describe("calculateSupplyStatus", () => {
    it("returns 'short' when stock is below 80% of consumption target", () => {
      assert.equal(calculateSupplyStatus(50, 100), "short");
      assert.equal(calculateSupplyStatus(79, 100), "short");
      assert.equal(calculateSupplyStatus(0, 100), "short");
    });

    it("returns 'balanced' when stock is between 80% and 120% of target", () => {
      assert.equal(calculateSupplyStatus(80, 100), "balanced");
      assert.equal(calculateSupplyStatus(100, 100), "balanced");
      assert.equal(calculateSupplyStatus(120, 100), "balanced");
    });

    it("returns 'plenty' when stock exceeds 120% of target", () => {
      assert.equal(calculateSupplyStatus(121, 100), "plenty");
      assert.equal(calculateSupplyStatus(250, 100), "plenty");
    });

    it("handles zero or non-positive targets gracefully", () => {
      assert.equal(calculateSupplyStatus(0, 0), "short");
      assert.equal(calculateSupplyStatus(10, 0), "plenty");
    });
  });

  describe("calculateSpread", () => {
    it("calculates percentage spread accurately", () => {
      // 10 to 30: +20 on 10 = 200%
      assert.equal(calculateSpread(10, 30), 200);
      // 10 to 15: +5 on 10 = 50%
      assert.equal(calculateSpread(10, 15), 50);
    });

    it("returns 0 spread for identical prices", () => {
      assert.equal(calculateSpread(25, 25), 0);
    });

    it("returns 0 when minPrice is zero or invalid", () => {
      assert.equal(calculateSpread(0, 50), 0);
    });
  });

  describe("buildGlobalMarketRows with simulated worlds", () => {
    // Generate deterministic 4 worlds at step 40
    const arcIds = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"] as const;
    const views: Record<string, CityView> = {};

    for (const arcId of arcIds) {
      let w = createWorld(arcId, "market-test-seed");
      w = advanceWorld(w, 40);
      views[arcId] = stateToCityView(w.state, w.arc, w.pricing);
    }

    it("produces rows for all canonical goods", () => {
      const rows = buildGlobalMarketRows(views);
      assert.ok(rows.length >= 18, `Expected at least 18 items, got ${rows.length}`);

      // Must include staple goods like bread, fish, ore, crystal
      const itemIds = rows.map((r) => r.id);
      assert.ok(itemIds.includes("bread"));
      assert.ok(itemIds.includes("grain"));
      assert.ok(itemIds.includes("ore"));
      assert.ok(itemIds.includes("crystal"));
      assert.ok(itemIds.includes("gadget")); // goblin unique
      assert.ok(itemIds.includes("totem")); // cave unique
      assert.ok(itemIds.includes("fossil")); // dino unique
      assert.ok(itemIds.includes("stave")); // elf unique
    });

    it("identifies cheapest and dearest realms for shared goods", () => {
      const rows = buildGlobalMarketRows(views);
      const breadRow = rows.find((r) => r.id === "bread");
      assert.ok(breadRow, "bread row must exist");

      // Verify bread exists across all 4 worlds
      for (const arcId of arcIds) {
        assert.ok(breadRow.worlds[arcId], `bread must have data for ${arcId}`);
        assert.ok(breadRow.worlds[arcId].price !== null, `bread price in ${arcId} should not be null`);
        assert.ok(breadRow.worlds[arcId].supplyStatus !== null);
      }

      assert.ok(breadRow.cheapest, "bread must have a cheapest realm");
      assert.ok(breadRow.dearest, "bread must have a dearest realm");
      assert.ok(breadRow.cheapest.price <= breadRow.dearest.price);
      assert.ok(breadRow.spreadPct >= 0);
      assert.ok(breadRow.recommendation.buyHere);
      assert.ok(breadRow.recommendation.sellHere);
      assert.ok(breadRow.recommendation.summary.length > 0);
    });

    it("handles signature goods present in only one world", () => {
      const rows = buildGlobalMarketRows(views);
      const gadgetRow = rows.find((r) => r.id === "gadget");
      assert.ok(gadgetRow, "gadget row must exist");

      assert.ok(gadgetRow.worlds.goblin_warrens.price !== null);
      assert.equal(gadgetRow.worlds.cave_hold.price, null);
      assert.equal(gadgetRow.worlds.dino_vale.price, null);
      assert.equal(gadgetRow.worlds.elf_grove.price, null);

      assert.equal(gadgetRow.spreadPct, 0);
      assert.equal(gadgetRow.isExclusive, true);
    });

    it("categorizes items into raw vs processed goods", () => {
      const rows = buildGlobalMarketRows(views);
      const oreRow = rows.find((r) => r.id === "ore");
      const breadRow = rows.find((r) => r.id === "bread");

      assert.equal(oreRow?.category, "raw");
      assert.equal(breadRow?.category, "processed");
    });

    it("extracts best trade opportunities sorted by spread descending", () => {
      const rows = buildGlobalMarketRows(views);
      const best = getBestTrades(rows, 5);

      assert.equal(best.length, 5);
      for (let i = 0; i < best.length - 1; i++) {
        assert.ok(
          best[i].spreadPct >= best[i + 1].spreadPct,
          `best trade ${i} spread (${best[i].spreadPct}%) must be >= trade ${i + 1} (${best[i + 1].spreadPct}%)`
        );
      }
    });

    it("is 100% deterministic across multiple invocations", () => {
      const run1 = buildGlobalMarketRows(views);
      const run2 = buildGlobalMarketRows(views);
      assert.deepEqual(run1, run2);
    });
  });
});
