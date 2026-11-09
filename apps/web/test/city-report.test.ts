import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCityReport,
  getOverlayBadge,
  getOverlayLegends,
  type OverlayMode,
} from "../src/lib/city-report.ts";
import { MOCK_CITY } from "../src/data/mock-city.ts";
import type { CityView } from "../src/lib/sim-view.ts";
import type { Sector } from "../src/data/mock-city.ts";

describe("City Report & Map Progress Overlays Pure Logic (TDD) - Item 3", () => {
  const mockCityView: CityView = {
    ...MOCK_CITY,
    stateRoot: "0xroot123",
  };

  describe("computeCityReport", () => {
    it("computes citizens, new buildings, open/closed businesses, and treasury metrics", () => {
      const report = computeCityReport(mockCityView);

      // Citizens
      assert.equal(typeof report.citizens.count, "number");
      assert.ok(report.citizens.count > 0);
      assert.ok(["up", "down", "flat"].includes(report.citizens.direction));
      assert.ok(report.citizens.label.includes("citizens"));

      // Buildings in last 100 years
      assert.equal(typeof report.buildings100y.count, "number");
      assert.ok(report.buildings100y.label.includes("100 years"));

      // Businesses open/closed
      assert.equal(typeof report.businesses.open, "number");
      assert.equal(typeof report.businesses.closed, "number");
      assert.ok(report.businesses.label.includes("open"));
      assert.ok(report.businesses.label.includes("closed"));

      // Treasury change
      assert.equal(typeof report.treasury.change, "number");
      assert.ok(["up", "down", "flat"].includes(report.treasury.direction));
      assert.ok(report.treasury.label.includes("coin"));
    });

    it("accurately reflects treasury delta when initial baseline is provided", () => {
      const baseline = 1000;
      const report = computeCityReport(mockCityView, { initialTreasury: baseline });
      const currentTreasury = mockCityView.sectors.reduce(
        (sum, s) => sum + s.businesses.reduce((bSum, b) => bSum + b.coin, 0),
        0
      );
      assert.equal(report.treasury.change, currentTreasury - baseline);
    });
  });

  describe("getOverlayBadge (shape plus colour, never colour alone)", () => {
    const prosperousSector: Sector = {
      idx: 0,
      kind: "food",
      name: "Granary Mills",
      description: "Grain processing",
      businesses: [
        { id: "b1", name: "Mill", recipe: "grain", open: true, coin: 400, inventory: {}, insolvent_steps: 0 },
        { id: "b2", name: "Bakery", recipe: "bread", open: true, coin: 350, inventory: {}, insolvent_steps: 0 },
      ],
    };

    const distressedSector: Sector = {
      idx: 1,
      kind: "forge",
      name: "Cold Foundry",
      description: "Closed smithies",
      businesses: [
        { id: "b3", name: "Foundry", recipe: "iron", open: false, coin: 20, inventory: {}, insolvent_steps: 10 },
      ],
    };

    it("assigns distinct shape and color for Prosperity mode", () => {
      const badgeP = getOverlayBadge("prosperity", prosperousSector);
      assert.equal(badgeP.shape, "circle");
      assert.equal(badgeP.color, 0x6bc785); // moss green
      assert.ok(badgeP.label.length > 0);

      const badgeD = getOverlayBadge("prosperity", distressedSector);
      assert.equal(badgeD.shape, "triangle");
      assert.equal(badgeD.color, 0xf26868); // alert red
    });

    it("assigns distinct shape and color for Contentment mode", () => {
      const badgeP = getOverlayBadge("contentment", prosperousSector);
      assert.equal(badgeP.shape, "circle");
      assert.equal(badgeP.color, 0x6bc785);

      const badgeD = getOverlayBadge("contentment", distressedSector);
      assert.equal(badgeD.shape, "triangle");
      assert.equal(badgeD.color, 0xf26868);
    });

    it("assigns distinct shape and color for Activity mode", () => {
      const badgeP = getOverlayBadge("activity", prosperousSector);
      assert.equal(badgeP.shape, "square");
      assert.equal(badgeP.color, 0xe5b358); // brass/gold for 2 businesses

      const badgeD = getOverlayBadge("activity", distressedSector);
      assert.equal(badgeD.shape, "triangle");
      assert.equal(badgeD.color, 0xf26868);
    });

    it("never relies on color alone (always provides non-empty shape and textual label)", () => {
      const modes: OverlayMode[] = ["normal", "prosperity", "contentment", "activity"];
      for (const mode of modes) {
        const badge1 = getOverlayBadge(mode, prosperousSector);
        assert.ok(badge1.shape.length > 0, `Mode ${mode} must have a shape`);
        assert.ok(badge1.label.length > 0, `Mode ${mode} must have text`);

        const badge2 = getOverlayBadge(mode, distressedSector);
        assert.ok(badge2.shape.length > 0, `Mode ${mode} must have a shape`);
        assert.ok(badge2.label.length > 0, `Mode ${mode} must have text`);
      }
    });
  });

  describe("getOverlayLegends", () => {
    it("returns textual legend items with both shape and color for every mode", () => {
      const modes: OverlayMode[] = ["normal", "prosperity", "contentment", "activity"];
      for (const mode of modes) {
        const legend = getOverlayLegends(mode);
        assert.ok(legend.length >= 2, `Legend for ${mode} must have at least 2 entries`);
        for (const item of legend) {
          assert.ok(item.label.length > 0);
          assert.ok(item.shape.length > 0);
          assert.ok(item.color.length > 0);
        }
      }
    });
  });
});
