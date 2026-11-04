import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MOCK_CITY } from "../src/data/mock-city.ts";

describe("mock city data", () => {
  it("exports valid goblin warrens at step 480 (year 120)", () => {
    assert.equal(MOCK_CITY.arc_id, "goblin_warrens");
    assert.equal(MOCK_CITY.step, 480);
    assert.equal(MOCK_CITY.year, 120);
    assert.equal(MOCK_CITY.season, "Spring");
    assert.equal(MOCK_CITY.stage_id, "village");
  });

  it("contains exactly 6 sectors from the arc file with 2 to 3 businesses each", () => {
    assert.equal(MOCK_CITY.sectors.length, 6);
    const expectedKinds = ["food", "ore", "forge", "alchemy", "harbor", "tower"];
    for (let i = 0; i < 6; i++) {
      assert.equal(MOCK_CITY.sectors[i].idx, i);
      assert.equal(MOCK_CITY.sectors[i].kind, expectedKinds[i]);
      assert.ok(MOCK_CITY.sectors[i].businesses.length >= 2);
      assert.ok(MOCK_CITY.sectors[i].businesses.length <= 3);
    }
  });

  it("contains closed / insolvent businesses", () => {
    const closed = MOCK_CITY.sectors
      .flatMap((s) => s.businesses)
      .filter((b) => !b.open || b.insolvent_steps > 0);
    assert.ok(closed.length >= 2, "Expected at least 2 closed/insolvent businesses");
  });

  it("contains all 12 items with valid prices, stocks, and explanations", () => {
    assert.equal(MOCK_CITY.market.length, 12);
    for (const item of MOCK_CITY.market) {
      assert.ok(item.price >= 1);
      assert.ok(item.stock >= 0);
      assert.ok(item.target > 0);
      assert.ok(item.explanation);
      assert.equal(item.explanation.item, item.id);
    }
  });

  it("contains a chronicle of 12 events", () => {
    assert.equal(MOCK_CITY.chronicle.length, 12);
  });
});
