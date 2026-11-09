import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMapA11yItems,
  formatDistrictLabel,
  type MapA11yItem,
} from "../src/lib/a11y/map-items.ts";
import { MOCK_CITY } from "../src/data/mock-city.ts";
import type { CityView } from "../src/lib/sim-view.ts";

describe("Map Object List Pure Logic (TDD) - Item 3", () => {
  const mockCityView: CityView = {
    ...MOCK_CITY,
    stateRoot: "0xroot123",
  };

  it("formatDistrictLabel formats district name, total businesses, and closed count", () => {
    const label1 = formatDistrictLabel("Bakery district", 3, 1);
    assert.equal(label1, "Bakery district, 3 businesses, 1 closed");

    const label2 = formatDistrictLabel("Smith Quarter", 1, 0);
    assert.equal(label2, "Smith Quarter, 1 business, 0 closed");

    const label3 = formatDistrictLabel("Alchemist Tower", 4, 2);
    assert.equal(label3, "Alchemist Tower, 4 businesses, 2 closed");
  });

  it("buildMapA11yItems produces districts first, then bubbles", () => {
    const items: MapA11yItem[] = buildMapA11yItems(mockCityView);

    assert.ok(items.length > 0, "Should generate map a11y items");

    // Count districts and bubbles
    const districtItems = items.filter((it) => it.kind === "district");
    const bubbleItems = items.filter((it) => it.kind === "bubble");

    assert.equal(districtItems.length, mockCityView.sectors.length);
    assert.ok(bubbleItems.length > 0, "Mock city with closed businesses should produce bubbles");

    // Verify ordering: all districts appear before any bubble
    const firstBubbleIdx = items.findIndex((it) => it.kind === "bubble");
    if (firstBubbleIdx !== -1) {
      for (let i = 0; i < firstBubbleIdx; i++) {
        assert.equal(items[i].kind, "district", `Item ${i} must be a district`);
      }
      for (let i = firstBubbleIdx; i < items.length; i++) {
        assert.equal(items[i].kind, "bubble", `Item ${i} must be a bubble`);
      }
    }
  });

  it("every district item has valid sectorIdx, id, kind, and descriptive aria-label", () => {
    const items = buildMapA11yItems(mockCityView);
    const districts = items.filter((it) => it.kind === "district");

    for (const d of districts) {
      assert.equal(d.kind, "district");
      assert.ok(typeof d.sectorIdx === "number");
      assert.ok(d.id.startsWith("district-"));
      assert.match(d.label, /.+,\s*\d+\s+business(es)?,\s*\d+\s+closed/i);
    }
  });

  it("every bubble item has valid sectorIdx, id, kind, and aria-label", () => {
    const items = buildMapA11yItems(mockCityView);
    const bubbles = items.filter((it) => it.kind === "bubble");

    for (const b of bubbles) {
      assert.equal(b.kind, "bubble");
      assert.ok(typeof b.sectorIdx === "number");
      assert.ok(b.id.length > 0);
      assert.ok(b.label.length > 0);
    }
  });

  it("handles null or empty city gracefully", () => {
    assert.deepEqual(buildMapA11yItems(null), []);
    assert.deepEqual(buildMapA11yItems(undefined), []);
    assert.deepEqual(buildMapA11yItems({} as unknown as CityView), []);
  });
});
