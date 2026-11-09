import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MOCK_CITY } from "../src/data/mock-city.ts";
import { computeCityNeeds } from "../src/lib/city-needs.ts";
import type { CityView } from "../src/lib/sim-view.ts";

describe("city needs calculations", () => {
  const mockCityView: CityView = {
    ...MOCK_CITY,
    stateRoot: "0123456789abcdef",
  };

  it("computes all four citizen needs as 0..100 coverage with shortfall items", () => {
    const res = computeCityNeeds(mockCityView);
    assert.equal(res.needs.length, 4);

    const needKeys = res.needs.map((n) => n.need);
    assert.deepEqual(needKeys, ["food", "housing", "work", "goods"]);

    for (const need of res.needs) {
      assert.ok(need.coverage >= 0 && need.coverage <= 100, `Coverage ${need.coverage} out of range 0..100`);
      assert.ok(need.label.length > 0);
      assert.ok(need.formula.length > 0, "Needs should document formula");
      if (need.coverage < 100) {
        assert.ok(typeof need.shortfallItem === "string" && need.shortfallItem.length > 0);
      }
    }
  });

  it("uses existing simulation satisfaction directly without inventing a new formula", () => {
    const res = computeCityNeeds(mockCityView);
    assert.equal(res.satisfactionBps, mockCityView.citizens.satisfaction_bps);
    assert.equal(res.satisfactionPct, Math.round(mockCityView.citizens.satisfaction_bps / 100));
  });

  it("identifies in-demand commodities where price > base or stock < target", () => {
    const res = computeCityNeeds(mockCityView);
    assert.ok(res.inDemand.length > 0, "Should have in-demand items in mock city");

    for (const item of res.inDemand) {
      assert.ok(
        item.price > item.basePrice || item.stock < item.target,
        `Item ${item.id} should meet in-demand criteria (price: ${item.price}, base: ${item.basePrice}, stock: ${item.stock}, target: ${item.target})`
      );
      assert.ok(item.reason.length > 0);
    }
  });

  it("identifies oversupplied commodities where stock is far above target/consumption", () => {
    const res = computeCityNeeds(mockCityView);
    assert.ok(res.oversupplied.length > 0, "Should have oversupplied items in mock city");

    for (const item of res.oversupplied) {
      assert.ok(
        item.stock > item.target,
        `Item ${item.id} should have surplus stock above target (stock: ${item.stock}, target: ${item.target})`
      );
      assert.ok(item.reason.length > 0);
    }
  });

  it("handles empty or zeroed city data gracefully without NaN or throwing", () => {
    const emptyCity: CityView = {
      ...mockCityView,
      citizens: { population: 0, satisfaction_bps: 0, purse: 0 },
      market: [],
      sectors: [],
    };
    const res = computeCityNeeds(emptyCity);
    assert.equal(res.satisfactionBps, 0);
    assert.equal(res.satisfactionPct, 0);
    assert.equal(res.inDemand.length, 0);
    assert.equal(res.oversupplied.length, 0);
    for (const need of res.needs) {
      assert.ok(!Number.isNaN(need.coverage));
      assert.ok(need.coverage >= 0 && need.coverage <= 100);
    }
  });

  it("correctly flags shortfall item when specific commodities are depleted", () => {
    const starvedCity: CityView = {
      ...mockCityView,
      market: mockCityView.market.map((m) =>
        m.id === "bread" || m.id === "fish" ? { ...m, stock: 0 } : m
      ),
    };
    const res = computeCityNeeds(starvedCity);
    const foodNeed = res.needs.find((n) => n.need === "food");
    assert.ok(foodNeed);
    assert.equal(foodNeed.coverage, 0);
    assert.equal(foodNeed.shortfallItem, "bread");
  });

  it("calculates city needs cleanly for all four world arcs", async () => {
    const { createWorld } = await import("../src/lib/sim-adapter.ts");
    const { stateToCityView } = await import("../src/lib/sim-view.ts");
    const arcIds = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"];

    for (const arcId of arcIds) {
      const world = createWorld(arcId, `test_seed_${arcId}`);
      const view = stateToCityView(world.state, world.arc, world.pricing);
      const res = computeCityNeeds(view);

      assert.equal(res.needs.length, 4);
      assert.ok(res.satisfactionPct >= 0 && res.satisfactionPct <= 100);
      for (const need of res.needs) {
        assert.ok(need.coverage >= 0 && need.coverage <= 100);
      }
    }
  });
});
