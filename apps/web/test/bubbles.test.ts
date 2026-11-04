import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MOCK_CITY } from "../src/data/mock-city.ts";
import type { CityView } from "../src/lib/sim-view.ts";
import { bubblesFor } from "../src/lib/iso/bubbles.ts";

describe("Icon Bubbles Pure Logic (TDD)", () => {
  const cityView: CityView = {
    ...MOCK_CITY,
    stateRoot: "0x1234567890abcdef",
  };

  it("bubblesFor returns an array of bubbles for valid cityView", () => {
    const bubbles = bubblesFor(cityView);
    assert.ok(Array.isArray(bubbles));
    assert.ok(bubbles.length > 0, "should produce at least one bubble");
    assert.ok(bubbles.length <= 12, "must be capped at max 12 visible at once");
  });

  it("produces zzz bubbles for sectors with closed/insolvent businesses", () => {
    const bubbles = bubblesFor(cityView);
    const zzzBubbles = bubbles.filter((b) => b.glyph === "zzz");
    assert.ok(zzzBubbles.length > 0, "should have zzz bubbles for insolvent businesses");
    for (const b of zzzBubbles) {
      assert.ok(b.ariaLabel.toLowerCase().includes("closed") || b.ariaLabel.toLowerCase().includes("idle"));
      assert.ok(b.sectorIdx >= 0 && b.sectorIdx < cityView.sectors.length);
    }
  });

  it("produces bread bubbles for food or hungry citizens", () => {
    const hungryCity: CityView = {
      ...cityView,
      citizens: {
        ...cityView.citizens,
        satisfaction_bps: 6500, // Hungry/dissatisfied
      },
    };
    const bubbles = bubblesFor(hungryCity);
    const breadBubbles = bubbles.filter((b) => b.glyph === "bread");
    assert.ok(breadBubbles.length > 0, "should produce bread bubble when hungry");
    assert.ok(breadBubbles[0].ariaLabel.toLowerCase().includes("bread") || breadBubbles[0].ariaLabel.toLowerCase().includes("hungry") || breadBubbles[0].ariaLabel.toLowerCase().includes("food"));
  });

  it("produces exclamation bubbles when notable chronicle events exist", () => {
    const bubbles = bubblesFor(cityView);
    const exclamationBubbles = bubbles.filter((b) => b.glyph === "exclamation");
    assert.ok(exclamationBubbles.length > 0, "should produce exclamation bubble for events");
    assert.ok(exclamationBubbles[0].ariaLabel.length > 0);
  });

  it("produces coin bubbles for active trade", () => {
    const bubbles = bubblesFor(cityView);
    const coinBubbles = bubbles.filter((b) => b.glyph === "coin");
    assert.ok(coinBubbles.length > 0, "should produce coin bubble for active trade");
  });

  it("respects max cap of 12 bubbles even with many businesses and events", () => {
    // City with many closed businesses and events
    const busyCity: CityView = {
      ...cityView,
      sectors: cityView.sectors.map((s) => ({
        ...s,
        businesses: [
          ...s.businesses,
          { id: `${s.idx}_extra1`, name: "Extra Closed", recipe: "tool", open: false, coin: 0, inventory: {}, insolvent_steps: 10 },
          { id: `${s.idx}_extra2`, name: "Extra Idle", recipe: "ore", open: false, coin: 0, inventory: {}, insolvent_steps: 5 },
          { id: `${s.idx}_extra3`, name: "Extra Trader", recipe: "bread", open: true, coin: 500, inventory: { bread: 10 }, insolvent_steps: 0 },
        ],
      })),
    };
    const bubbles = bubblesFor(busyCity);
    assert.ok(bubbles.length <= 12, `expected <= 12 bubbles, got ${bubbles.length}`);
  });

  it("determinism: repeated calls return identical bubbles in identical order", () => {
    const b1 = bubblesFor(cityView);
    const b2 = bubblesFor(cityView);
    assert.deepEqual(b1, b2);
  });

  it("every bubble has valid sectorIdx, glyph, and accessible ariaLabel", () => {
    const bubbles = bubblesFor(cityView);
    const validGlyphs = new Set(["bread", "zzz", "exclamation", "coin"]);
    for (const b of bubbles) {
      assert.ok(validGlyphs.has(b.glyph), `invalid glyph ${b.glyph}`);
      assert.ok(b.sectorIdx >= 0 && b.sectorIdx < cityView.sectors.length, `invalid sectorIdx ${b.sectorIdx}`);
      assert.ok(b.title && b.title.length > 0, "title must not be empty");
      assert.ok(b.description && b.description.length > 0, "description must not be empty");
      assert.ok(b.ariaLabel && b.ariaLabel.length > 0, "ariaLabel must not be empty");
    }
  });
});
