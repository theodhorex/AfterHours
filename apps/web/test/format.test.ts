import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCoin, formatCount, stepToSeason, formatStep } from "../src/lib/format.ts";

describe("format utilities", () => {
  it("formats coin values correctly", () => {
    assert.equal(formatCoin(0), "0 coin");
    assert.equal(formatCoin(42), "42 coin");
    assert.equal(formatCoin(1250), "1,250 coin");
    assert.equal(formatCoin(1000000n), "1,000,000 coin");
  });

  it("formats item counts correctly", () => {
    assert.equal(formatCount(0), "0");
    assert.equal(formatCount(480), "480");
    assert.equal(formatCount(12345), "12,345");
  });

  it("converts simulation step to year and season", () => {
    // 4 steps per year: 0: Spring, 1: Summer, 2: Autumn, 3: Winter
    assert.deepEqual(stepToSeason(0), { year: 0, season: "Spring", stepInYear: 0 });
    assert.deepEqual(stepToSeason(1), { year: 0, season: "Summer", stepInYear: 1 });
    assert.deepEqual(stepToSeason(2), { year: 0, season: "Autumn", stepInYear: 2 });
    assert.deepEqual(stepToSeason(3), { year: 0, season: "Winter", stepInYear: 3 });
    // Step 480 is year 120, Spring
    assert.deepEqual(stepToSeason(480), { year: 120, season: "Spring", stepInYear: 0 });
    assert.deepEqual(stepToSeason(481), { year: 120, season: "Summer", stepInYear: 1 });
    assert.deepEqual(stepToSeason(482), { year: 120, season: "Autumn", stepInYear: 2 });
    assert.deepEqual(stepToSeason(483), { year: 120, season: "Winter", stepInYear: 3 });
  });

  it("formats step display string", () => {
    assert.equal(formatStep(480), "Year 120, Spring");
    assert.equal(formatStep(483), "Year 120, Winter");
  });
});
