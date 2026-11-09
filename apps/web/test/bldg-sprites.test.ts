import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { relativeLuminance, getTheme } from "../src/lib/iso/theme.ts";
import {
  materialRamp,
  selectiveOutline,
  ditherBand,
  pickVariantChoice,
  getArcMaterials,
} from "../src/lib/iso/bldg-ramp.ts";
import { bakeHousePixels, HOUSE_CANVAS_SIZE } from "../src/lib/iso/bldg-houses.ts";
import { bakeBuildingPixels, BUILDING_CANVAS_SIZE } from "../src/lib/iso/bldg-business.ts";
import {
  BuildingTextureCache,
  drawHouseGraphics,
  drawSectorBuildingGraphics,
} from "../src/lib/iso/sprites-buildings.ts";

const ARCS = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"] as const;
const SECTORS = ["food", "ore", "forge", "alchemy", "harbor", "tower"] as const;

describe("Rich Pixel-Art Building Sprites & Pure Helpers (G2)", () => {
  describe("Pure Color Ramps, Dithering & Seeded Choice (Item 3)", () => {
    it("materialRamp generates 5 to 6 hue-shifted steps that are strictly monotonic in luminance", () => {
      const sampleBases = [0x6a5536, 0x5c7285, 0x8a4b38, 0x4d7538, 0x7c5268];
      for (const base of sampleBases) {
        for (const steps of [5, 6] as const) {
          const r1 = materialRamp(base, steps, false);
          const r2 = materialRamp(base, steps, false);
          assert.deepEqual(r1, r2, "materialRamp must be deterministic");
          assert.equal(r1.length, steps);

          for (let i = 1; i < r1.length; i++) {
            const lumPrev = relativeLuminance(r1[i - 1]);
            const lumCurr = relativeLuminance(r1[i]);
            assert.ok(
              lumCurr > lumPrev,
              `Ramp step ${i} (${lumCurr.toFixed(4)}) must be brighter than step ${i - 1} (${lumPrev.toFixed(4)}) for base 0x${base.toString(16)}`
            );
          }
        }
      }
    });

    it("getArcMaterials returns 5-6 step monotonic ramps for wall, roof, wood, and stone across all arcs", () => {
      for (const arcId of ARCS) {
        for (let season = 0; season < 4; season++) {
          const mat = getArcMaterials(arcId, season, false);
          for (const key of ["wall", "roof", "wood", "stone"] as const) {
            const ramp = mat[key];
            assert.ok(ramp.length >= 5 && ramp.length <= 6, `${arcId} ${key} ramp length must be 5..6`);
            for (let i = 1; i < ramp.length; i++) {
              assert.ok(
                relativeLuminance(ramp[i]) > relativeLuminance(ramp[i - 1]),
                `${arcId} s${season} ${key} ramp must be strictly monotonic in luminance`
              );
            }
          }
        }
      }
    });

    it("selectiveOutline is darker than local color and never pure black (0x000000)", () => {
      const colors = [0x8b7355, 0x4a6b53, 0x6d7580, 0x9a4f3a, 0x2a2420];
      for (const c of colors) {
        const out = selectiveOutline(c);
        assert.equal( selectiveOutline(c), out, "selectiveOutline must be deterministic");
        assert.ok(out > 0x000000, "selectiveOutline must never be pure black 0x000000");
        assert.ok(
          relativeLuminance(out) < relativeLuminance(c),
          `Outline luminance (${relativeLuminance(out).toFixed(4)}) must be darker than base (${relativeLuminance(c).toFixed(4)})`
        );
      }
    });

    it("ditherBand is deterministic and spans at most 3 bands for a fixed base tone", () => {
      for (const v of [0.2, 0.45, 0.75]) {
        const seen = new Set<number>();
        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const b1 = ditherBand(v, 6, px, py);
            const b2 = ditherBand(v, 6, px, py);
            assert.equal(b1, b2, "ditherBand must be deterministic");
            assert.ok(b1 >= 0 && b1 < 6, `Band index out of range: ${b1}`);
            seen.add(b1);
          }
        }
        const indices = [...seen].sort((a, b) => a - b);
        const span = indices[indices.length - 1] - indices[0] + 1;
        assert.ok(span <= 3, `Dither band span (${span}) must be at most 3 bands`);
      }
    });

    it("pickVariantChoice is deterministic for same inputs and varies across seeds", () => {
      const options = ["gable", "dome", "hipped", "shed"] as const;
      for (const arc of ARCS) {
        for (let level = 0; level <= 3; level++) {
          for (let variant = 0; variant < 4; variant++) {
            const c1 = pickVariantChoice(arc, level, variant, "roof", options);
            const c2 = pickVariantChoice(arc, level, variant, "roof", options);
            assert.equal(c1, c2, "Same inputs must give the exact same choice");
            assert.ok(options.includes(c1));
          }
        }
      }
      const distinct = new Set<string>();
      for (const arc of ARCS) {
        for (let v = 0; v < 4; v++) {
          distinct.add(pickVariantChoice(arc, 2, v, "detail", options));
        }
      }
      assert.ok(distinct.size >= 2, "Seeded choice should produce multiple options across variants/arcs");
    });
  });

  describe("House Sprites (Item 1)", () => {
    it("bakes deterministic 80x80 max house sprites for 4 variants x levels 0..3 per arc", () => {
      assert.ok(HOUSE_CANVAS_SIZE <= 80, "House canvas size must be <= 80px");
      for (const arc of ARCS) {
        for (let variant = 0; variant < 4; variant++) {
          const levelCounts: number[] = [];
          for (let level = 0; level <= 3; level++) {
            const p1 = bakeHousePixels(variant, level, arc, 0);
            const p2 = bakeHousePixels(variant, level, arc, 0);
            assert.equal(p1.width, HOUSE_CANVAS_SIZE);
            assert.equal(p1.height, HOUSE_CANVAS_SIZE);
            assert.deepEqual(p1.rgba, p2.rgba, `House (${arc}, v${variant}, l${level}) must be deterministic`);
            assert.ok(p1.opaqueCount > 200, `House (${arc}, v${variant}, l${level}) must have rich pixel count`);
            levelCounts.push(p1.bounds.maxY - p1.bounds.minY);
          }
          assert.ok(
            levelCounts[3] >= levelCounts[0],
            `House (${arc}, v${variant}) level 3 height (${levelCounts[3]}) should be >= level 0 (${levelCounts[0]})`
          );
        }
      }
    });

    it("includes soft blue-tinted cast shadow (alpha ~0.25), lit amber windows on odd variants, garden/fence on level >= 1, chimney on level >= 2", () => {
      for (const arc of ARCS) {
        const oddHouse = bakeHousePixels(1, 2, arc, 0);
        const evenHouse = bakeHousePixels(0, 0, arc, 0);
        const lvl1House = bakeHousePixels(0, 1, arc, 0);
        const lvl2House = bakeHousePixels(0, 2, arc, 0);

        assert.ok(oddHouse.hasCastShadow, `${arc} house must have soft cast shadow baked at base`);
        assert.ok(oddHouse.litWindowPixels > 0, `${arc} odd variant house must have lit amber window pixels`);
        assert.equal(evenHouse.hasChimney, false, `${arc} level 0 house should not have chimney`);
        assert.equal(lvl2House.hasChimney, true, `${arc} level 2 house must have chimney`);
        assert.equal(evenHouse.hasGardenOrFence, false, `${arc} level 0 house should not have garden/fence`);
        assert.equal(lvl1House.hasGardenOrFence, true, `${arc} level 1 house must have garden/fence detail`);
      }
    });
  });

  describe("Business Buildings (Item 2)", () => {
    it("bakes deterministic <=112x112 sector buildings that are clearly larger than houses and grow across levels 0..3", () => {
      assert.ok(BUILDING_CANVAS_SIZE <= 112, "Building canvas size must be <= 112px");
      for (const arc of ARCS) {
        const houseSample = bakeHousePixels(0, 2, arc, 0);
        for (const sector of SECTORS) {
          const b0 = bakeBuildingPixels(sector, 0, false, arc, 0);
          const b0Dup = bakeBuildingPixels(sector, 0, false, arc, 0);
          const b3 = bakeBuildingPixels(sector, 3, false, arc, 0);

          assert.equal(b0.width, BUILDING_CANVAS_SIZE);
          assert.equal(b0.height, BUILDING_CANVAS_SIZE);
          assert.deepEqual(b0.rgba, b0Dup.rgba, `Building (${sector}, ${arc}) must be deterministic`);

          // Business buildings must be clearly larger than houses
          assert.ok(
            b3.opaqueCount > houseSample.opaqueCount * 1.35,
            `Business ${sector} (${b3.opaqueCount} px) must be clearly larger than house (${houseSample.opaqueCount} px)`
          );

          // Level 3 must be taller / richer than level 0
          const h0 = b0.bounds.maxY - b0.bounds.minY;
          const h3 = b3.bounds.maxY - b3.bounds.minY;
          assert.ok(
            h3 > h0 || b3.opaqueCount > b0.opaqueCount,
            `Business ${sector} level 3 must grow in height or detail over level 0`
          );
        }
      }
    });

    it("gives each sector a distinct silhouette and handles ruined state (no lit windows, cracks/broken roof)", () => {
      const hashes = new Set<number>();
      for (const sector of SECTORS) {
        const okBldg = bakeBuildingPixels(sector, 2, false, "goblin_warrens", 0);
        const ruinBldg = bakeBuildingPixels(sector, 2, true, "goblin_warrens", 0);

        hashes.add(okBldg.silhouetteHash);
        assert.equal(ruinBldg.litWindowPixels, 0, `Ruined ${sector} must have zero lit windows`);
        assert.notDeepEqual(okBldg.rgba, ruinBldg.rgba, `Ruined ${sector} must visually differ from intact`);
      }
      assert.equal(hashes.size, SECTORS.length, "All 6 sectors must have clearly distinct silhouettes");
    });

    it("preserves existing exported signatures in sprites-buildings.ts and enforces non-black outlines and lit-left/shaded-right walls", () => {
      assert.equal(typeof drawHouseGraphics, "function");
      assert.equal(typeof drawSectorBuildingGraphics, "function");
      assert.equal(typeof BuildingTextureCache, "function");
      const theme = getTheme("goblin_warrens", 0);
      assert.ok(theme);

      const arcHashes = new Set<number>();
      for (const arc of ARCS) {
        const h = bakeHousePixels(0, 2, arc, 0);
        arcHashes.add(h.silhouetteHash);

        // Verify no pure black (0x000000) opaque pixel exists
        let leftLumSum = 0;
        let leftCount = 0;
        let rightLumSum = 0;
        let rightCount = 0;

        for (let y = 0; y < h.height; y++) {
          for (let x = 0; x < h.width; x++) {
            const idx = y * h.width + x;
            const o = idx * 4;
            if (h.rgba[o + 3] > 0) {
              const hex = (h.rgba[o] << 16) | (h.rgba[o + 1] << 8) | h.rgba[o + 2];
              assert.notEqual(hex, 0x000000, `Sprite in ${arc} must not contain pure black 0x000000`);
              if (h.group[idx] === 2) {
                leftLumSum += relativeLuminance(hex);
                leftCount++;
              } else if (h.group[idx] === 3) {
                rightLumSum += relativeLuminance(hex);
                rightCount++;
              }
            }
          }
        }
        assert.ok(
          leftLumSum / leftCount > rightLumSum / rightCount,
          `${arc} lit left wall luminance must exceed shaded right wall luminance`
        );
      }
      assert.ok(arcHashes.size >= 3, "Arc house styles must produce distinct silhouettes");
    });
  });
});
