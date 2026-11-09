import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampTooltipPosition,
  formatLevelLabel,
  getNextLevelHint,
  calcBuildingHoverData,
  resolveTouchTap,
} from "../src/lib/iso/inspect.ts";
import type { Sector } from "../src/data/mock-city.ts";

describe("Building Hover & Inspect Pure Helpers (TDD) - Item 1", () => {
  describe("clampTooltipPosition", () => {
    it("offsets position from pointer when well within viewport bounds", () => {
      const pos = clampTooltipPosition({
        pointerX: 100,
        pointerY: 100,
        cardWidth: 160,
        cardHeight: 80,
        viewportWidth: 800,
        viewportHeight: 600,
        offset: 12,
      });
      assert.equal(pos.x, 112);
      assert.equal(pos.y, 112);
    });

    it("clamps position when pointer is near the right or bottom edge", () => {
      const pos = clampTooltipPosition({
        pointerX: 750,
        pointerY: 580,
        cardWidth: 160,
        cardHeight: 80,
        viewportWidth: 800,
        viewportHeight: 600,
        offset: 12,
      });
      // Should flip or clamp so it stays inside [0, 800 - 160] = [0, 640] and [0, 600 - 80] = [0, 520]
      assert.ok(pos.x <= 640, `pos.x ${pos.x} should be <= 640`);
      assert.ok(pos.y <= 520, `pos.y ${pos.y} should be <= 520`);
      assert.ok(pos.x >= 0, `pos.x ${pos.x} should be >= 0`);
      assert.ok(pos.y >= 0, `pos.y ${pos.y} should be >= 0`);
    });

    it("flips offset to left of pointer when overflowing right", () => {
      const pos = clampTooltipPosition({
        pointerX: 700,
        pointerY: 100,
        cardWidth: 150,
        cardHeight: 80,
        viewportWidth: 800,
        viewportHeight: 600,
        offset: 10,
      });
      // 700 + 10 + 150 = 860 > 800 -> flips to 700 - 10 - 150 = 540
      assert.equal(pos.x, 540);
      assert.equal(pos.y, 110);
    });

    it("clamps to zero if pointer is negative or off-screen left", () => {
      const pos = clampTooltipPosition({
        pointerX: -10,
        pointerY: -20,
        cardWidth: 150,
        cardHeight: 80,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      assert.ok(pos.x >= 0);
      assert.ok(pos.y >= 0);
    });
  });

  describe("formatLevelLabel & getNextLevelHint", () => {
    it("formats level labels cleanly without emojis", () => {
      assert.equal(formatLevelLabel(0), "Level 0");
      assert.equal(formatLevelLabel(1, "food"), "Level 1 • Settlement");
      assert.equal(formatLevelLabel(2, "forge"), "Level 2 • Workshop");
      assert.equal(formatLevelLabel(3, "tower"), "Level 3 • Landmark");
    });

    it("returns actionable next level hint", () => {
      const hint0 = getNextLevelHint("food", 0);
      assert.ok(hint0.length > 0, "Hint should not be empty");
      assert.match(hint0, /level 1/i);

      const hintMax = getNextLevelHint("forge", 3);
      assert.match(hintMax, /maximum|fully developed/i);
    });
  });

  describe("calcBuildingHoverData", () => {
    const mockSector: Sector = {
      idx: 2,
      kind: "forge",
      name: "Ironworks Guild",
      description: "Hammers beat against iron anvils.",
      businesses: [
        {
          id: "b1",
          name: "Iron Smelter",
          recipe: "ore_to_iron",
          open: true,
          coin: 150,
          inventory: { iron: 10 },
          insolvent_steps: 0,
        },
        {
          id: "b2",
          name: "Blade Smith",
          recipe: "iron_to_tools",
          open: true,
          coin: 280,
          inventory: { tools: 4 },
          insolvent_steps: 0,
        },
        {
          id: "b3",
          name: "Rusted Foundry",
          recipe: "scrap_refine",
          open: false,
          coin: 10,
          inventory: {},
          insolvent_steps: 5,
        },
      ],
    };

    it("calculates open, insolvent, and today's coin totals accurately", () => {
      const data = calcBuildingHoverData(mockSector, 2);
      assert.equal(data.sectorIdx, 2);
      assert.equal(data.name, "Ironworks Guild");
      assert.equal(data.kind, "forge");
      assert.equal(data.level, 2);
      assert.equal(data.openCount, 2);
      assert.equal(data.insolventCount, 1);
      assert.equal(data.totalCoin, 440); // 150 + 280 + 10
      assert.equal(data.activeRevenue, 430); // 150 + 280
    });
  });

  describe("resolveTouchTap (Item 1 Touch interaction)", () => {
    it("returns inspect on first tap", () => {
      const state = { lastTappedId: null, lastTappedTime: 0 };
      const res = resolveTouchTap(state, "bldg-1", 1000, 500);
      assert.equal(res.action, "inspect");
      assert.equal(res.nextState.lastTappedId, "bldg-1");
      assert.equal(res.nextState.lastTappedTime, 1000);
    });

    it("returns open on second tap on same target within window", () => {
      const state = { lastTappedId: "bldg-1", lastTappedTime: 1000 };
      const res = resolveTouchTap(state, "bldg-1", 1300, 500);
      assert.equal(res.action, "open");
      assert.equal(res.nextState.lastTappedId, null);
    });

    it("returns inspect if second tap is on different target", () => {
      const state = { lastTappedId: "bldg-1", lastTappedTime: 1000 };
      const res = resolveTouchTap(state, "bldg-2", 1200, 500);
      assert.equal(res.action, "inspect");
      assert.equal(res.nextState.lastTappedId, "bldg-2");
      assert.equal(res.nextState.lastTappedTime, 1200);
    });

    it("returns inspect if second tap is on same target but after timeout", () => {
      const state = { lastTappedId: "bldg-1", lastTappedTime: 1000 };
      const res = resolveTouchTap(state, "bldg-1", 1800, 500);
      assert.equal(res.action, "inspect");
      assert.equal(res.nextState.lastTappedId, "bldg-1");
      assert.equal(res.nextState.lastTappedTime, 1800);
    });
  });
});
