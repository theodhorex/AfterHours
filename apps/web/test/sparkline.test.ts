import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateSparklinePoints,
  describeSparklineTrend,
} from "../src/lib/iso/sparkline.ts";

describe("Trend Sparkline Pure Helper (TDD) - Item 2", () => {
  it("generates valid SVG coordinate points for an array of numbers", () => {
    const values = [10, 20, 15, 30, 25, 40];
    const { points, min, max } = generateSparklinePoints(values, {
      width: 100,
      height: 20,
      padding: 2,
    });

    assert.equal(min, 10);
    assert.equal(max, 40);
    assert.ok(points.length > 0);
    const coords = points.split(" ");
    assert.equal(coords.length, values.length);
    for (const c of coords) {
      const [x, y] = c.split(",").map(Number);
      assert.ok(!isNaN(x) && x >= 0 && x <= 100);
      assert.ok(!isNaN(y) && y >= 0 && y <= 20);
    }
  });

  it("handles flat array without dividing by zero", () => {
    const values = [50, 50, 50, 50];
    const { points, min, max } = generateSparklinePoints(values, {
      width: 100,
      height: 20,
    });
    assert.equal(min, 50);
    assert.equal(max, 50);
    assert.ok(points.length > 0);
  });

  it("produces an accessible text alternative", () => {
    const values = [100, 120, 110, 150];
    const text = describeSparklineTrend(values, "coin");
    assert.ok(text.includes("100"));
    assert.ok(text.includes("150"));
    assert.ok(text.includes("coin"));
    assert.ok(text.includes("up") || text.includes("increasing"));
  });
});
