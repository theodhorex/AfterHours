import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interpolateTickNumber,
  seedStampRotation,
  hexToRgb,
  relativeLuminance,
  contrastRatio,
} from "../src/lib/ui-math.ts";

describe("ui-math: count-up interpolation", () => {
  it("returns start at progress 0 and end at progress 1", () => {
    assert.equal(interpolateTickNumber(0, 100, 0), 0);
    assert.equal(interpolateTickNumber(0, 100, 1), 100);
    assert.equal(interpolateTickNumber(50, 250, 0), 50);
    assert.equal(interpolateTickNumber(50, 250, 1), 250);
  });

  it("is strictly monotonic for increasing values", () => {
    const start = 10;
    const end = 1000;
    let prev = interpolateTickNumber(start, end, 0);

    for (let i = 1; i <= 50; i++) {
      const progress = i / 50;
      const current = interpolateTickNumber(start, end, progress);
      assert.ok(
        current >= prev,
        `Expected ${current} >= ${prev} at progress ${progress}`,
      );
      prev = current;
    }
    assert.equal(prev, end);
  });

  it("is strictly monotonic for decreasing values", () => {
    const start = 500;
    const end = 50;
    let prev = interpolateTickNumber(start, end, 0);

    for (let i = 1; i <= 50; i++) {
      const progress = i / 50;
      const current = interpolateTickNumber(start, end, progress);
      assert.ok(
        current <= prev,
        `Expected ${current} <= ${prev} at progress ${progress}`,
      );
      prev = current;
    }
    assert.equal(prev, end);
  });

  it("clamps progress outside [0, 1]", () => {
    assert.equal(interpolateTickNumber(10, 100, -0.5), 10);
    assert.equal(interpolateTickNumber(10, 100, 1.5), 100);
  });
});

describe("ui-math: deterministic stamp rotation seed", () => {
  it("produces deterministic rotation for identical id", () => {
    const rot1 = seedStampRotation("city-audit-01");
    const rot2 = seedStampRotation("city-audit-01");
    assert.equal(rot1, rot2);
  });

  it("stays bounded within the maximum degrees (default 4 degrees)", () => {
    const sampleIds = [
      "audit-1",
      "audit-2",
      "city-goblin",
      "city-elf",
      "tx-0x4a9b",
      "seal-verified",
      "seal-mismatch",
      "ledger-entry-99",
    ];

    for (const id of sampleIds) {
      const rot = seedStampRotation(id, 4);
      assert.ok(
        rot >= -4 && rot <= 4,
        `Rotation ${rot} for id '${id}' exceeds range [-4, 4]`,
      );
    }
  });

  it("produces variance across different ids", () => {
    const rotA = seedStampRotation("city-alpha");
    const rotB = seedStampRotation("city-beta");
    assert.notEqual(rotA, rotB);
  });
});

describe("ui-math: contrast ratio and token verification", () => {
  it("converts hex to rgb and computes relative luminance", () => {
    const rgb = hexToRgb("#ffffff");
    assert.deepEqual(rgb, [255, 255, 255]);
    const lum = relativeLuminance(rgb);
    assert.equal(Math.round(lum), 1);
  });

  it("calculates accurate contrast ratios", () => {
    assert.equal(Math.round(contrastRatio("#ffffff", "#000000")), 21);
    assert.equal(Math.round(contrastRatio("#000000", "#000000")), 1);
  });

  it("verifies ink (#2a1d14) on paper (#f1e4c8) meets WCAG AAA normal text (>= 7:1)", () => {
    const inkOnPaper = contrastRatio("#2a1d14", "#f1e4c8");
    assert.ok(
      inkOnPaper >= 7.0,
      `Expected ink on paper >= 7.0, got ${inkOnPaper.toFixed(2)}:1`,
    );
  });

  it("verifies ink-faded (#6b5640) on paper (#f1e4c8) meets WCAG AA normal text (>= 4.5:1)", () => {
    const inkFadedOnPaper = contrastRatio("#6b5640", "#f1e4c8");
    assert.ok(
      inkFadedOnPaper >= 4.5,
      `Expected ink-faded on paper >= 4.5, got ${inkFadedOnPaper.toFixed(2)}:1`,
    );
  });
});
