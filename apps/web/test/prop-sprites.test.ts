import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { relativeLuminance, getTheme, type RoadStyle } from "../src/lib/iso/theme.ts";
import {
  buildHueRamp,
  propOutlineColor,
  ditherStep,
  pickSeededVariant,
  pickTreeVariant,
  maskToRoadEdges,
  isPurpleHue,
} from "../src/lib/iso/prop-helpers.ts";
import {
  bakeTreePixels,
  TREE_MAX_W,
  TREE_MAX_H,
} from "../src/lib/iso/prop-trees.ts";
import {
  SMALL_PROP_KINDS,
  bakeSmallPropPixels,
  type SmallPropKind,
} from "../src/lib/iso/prop-small.ts";
import {
  bakeRoadPixels,
  bakeBridgePixels,
  ROAD_TILE_W,
  ROAD_TILE_H,
} from "../src/lib/iso/prop-roads.ts";
import {
  PropTextureCache,
  drawTreeGraphics,
  getElfTreeFoliage,
} from "../src/lib/iso/sprites-props.ts";
import {
  GroundTextureCache,
  drawTileGraphics,
} from "../src/lib/iso/sprites-ground.ts";

const ARCS = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"] as const;
const ROAD_STYLES: RoadStyle[] = ["dirt", "cobble", "flagstone", "root_path", "mine_rails"];

describe("Shaded Pixel Trees, Props & Road Tiles (G3)", () => {
  describe("Item 4: Pure Helpers — Hue-Shifted Ramp, Seeded Choice & Mask-to-Edges", () => {
    it("buildHueRamp generates 5 to 6 hue-shifted steps strictly monotonic in luminance", () => {
      const bases = [0x4d7538, 0x3d6a2c, 0x6a5536, 0x6d7580, 0x5a9650, 0xb45309, 0x8a5a3c];
      for (const base of bases) {
        for (const steps of [5, 6] as const) {
          const r1 = buildHueRamp(base, steps);
          const r2 = buildHueRamp(base, steps);
          assert.deepEqual(r1, r2, "buildHueRamp must be deterministic");
          assert.equal(r1.length, steps);

          for (let i = 1; i < r1.length; i++) {
            const lumPrev = relativeLuminance(r1[i - 1]);
            const lumCurr = relativeLuminance(r1[i]);
            assert.ok(
              lumCurr > lumPrev,
              `Step ${i} (${lumCurr.toFixed(4)}) must have strictly higher luminance than step ${i - 1} (${lumPrev.toFixed(4)}) for base 0x${base.toString(16)}`
            );
          }
        }
      }
    });

    it("propOutlineColor is deterministic, darker than fill, and never pure black", () => {
      const samples = [0x4d7538, 0x6a5536, 0x7a7468, 0x3e5844, 0x261d16];
      for (const hex of samples) {
        const out = propOutlineColor(hex);
        assert.equal(propOutlineColor(hex), out);
        assert.ok(out > 0x000000, "Selective outline must never be pure black 0x000000");
        assert.ok(
          relativeLuminance(out) < relativeLuminance(hex),
          "Selective outline must have lower luminance than base fill"
        );
      }
    });

    it("ditherStep is deterministic and stays within adjacent ramp bands", () => {
      for (const val of [0.15, 0.5, 0.82]) {
        const seen = new Set<number>();
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const s1 = ditherStep(val, 6, x, y);
            const s2 = ditherStep(val, 6, x, y);
            assert.equal(s1, s2);
            assert.ok(s1 >= 0 && s1 < 6);
            seen.add(s1);
          }
        }
        const sorted = [...seen].sort((a, b) => a - b);
        assert.ok(sorted[sorted.length - 1] - sorted[0] <= 2, "Dither spread must stay within adjacent steps");
      }
    });

    it("pickSeededVariant and pickTreeVariant are deterministic and cover all variants", () => {
      const opts = ["bog_tree", "toadstool", "willow_cluster"] as const;
      for (const arc of ARCS) {
        for (let s = 0; s < 4; s++) {
          const a = pickSeededVariant(`${arc}_${s}`, opts);
          const b = pickSeededVariant(`${arc}_${s}`, opts);
          assert.equal(a, b, "pickSeededVariant must be deterministic");
          assert.ok(opts.includes(a));
        }
      }

      for (const arc of ARCS) {
        const seenVariants = new Set<number>();
        for (let t = 0; t < 6; t++) {
          const v1 = pickTreeVariant(t, arc, 0);
          const v2 = pickTreeVariant(t, arc, 0);
          assert.equal(v1, v2);
          assert.ok(v1 === 0 || v1 === 1 || v1 === 2);
          seenVariants.add(v1);
        }
        assert.equal(seenVariants.size, 3, `All 3 tree variants must be reachable for ${arc}`);
      }
    });

    it("maskToRoadEdges maps all masks 0..15 to the exact documented N(1), E(2), S(4), W(8) edge sets", () => {
      for (let mask = 0; mask <= 15; mask++) {
        const res1 = maskToRoadEdges(mask);
        const res2 = maskToRoadEdges(mask);
        assert.deepEqual(res1, res2, `maskToRoadEdges(${mask}) must be deterministic`);

        const expN = (mask & 1) !== 0;
        const expE = (mask & 2) !== 0;
        const expS = (mask & 4) !== 0;
        const expW = (mask & 8) !== 0;

        assert.equal(res1.connected.N, expN, `mask ${mask} N connected`);
        assert.equal(res1.connected.E, expE, `mask ${mask} E connected`);
        assert.equal(res1.connected.S, expS, `mask ${mask} S connected`);
        assert.equal(res1.connected.W, expW, `mask ${mask} W connected`);

        const expectedOpen: string[] = [];
        const expectedKerb: string[] = [];
        if (expN) expectedOpen.push("N"); else expectedKerb.push("N");
        if (expE) expectedOpen.push("E"); else expectedKerb.push("E");
        if (expS) expectedOpen.push("S"); else expectedKerb.push("S");
        if (expW) expectedOpen.push("W"); else expectedKerb.push("W");

        assert.deepEqual(res1.openEdges, expectedOpen, `mask ${mask} openEdges`);
        assert.deepEqual(res1.kerbEdges, expectedKerb, `mask ${mask} kerbEdges`);

        // Lit kerbs are unconnected edges on upper-left/upper-right (N, W); shaded kerbs on (E, S)
        const expectedLit = expectedKerb.filter((e) => e === "N" || e === "W");
        const expectedShaded = expectedKerb.filter((e) => e === "E" || e === "S");
        assert.deepEqual(res1.litKerbEdges, expectedLit, `mask ${mask} litKerbEdges`);
        assert.deepEqual(res1.shadedKerbEdges, expectedShaded, `mask ${mask} shadedKerbEdges`);
      }
    });
  });

  describe("Item 1: Shaded Pixel Trees (3 variants per arc, 4 seasons, <=56x72)", () => {
    it("bakes deterministic <=56x72 trees with soft blue-tinted shadow, trunk outline, and 3 distinct variants per arc", () => {
      assert.ok(TREE_MAX_W <= 56, "Tree max width must be <= 56");
      assert.ok(TREE_MAX_H <= 72, "Tree max height must be <= 72");

      const arcSilhouettes = new Set<number>();

      for (const arc of ARCS) {
        const variantHashes = new Set<number>();
        for (let v = 0; v < 3; v++) {
          const t1 = bakeTreePixels(v, arc, 0);
          const t2 = bakeTreePixels(v, arc, 0);
          assert.equal(t1.width, TREE_MAX_W);
          assert.equal(t1.height, TREE_MAX_H);
          assert.deepEqual(t1.rgba, t2.rgba, `Tree (${arc}, v${v}) must be deterministic`);
          assert.ok(t1.opaquePixels > 120, `Tree (${arc}, v${v}) must have dense pixel canopy & trunk`);
          assert.ok(t1.shadowPixels > 20, `Tree (${arc}, v${v}) must have baked soft blue-tinted shadow ellipse`);
          assert.ok(t1.canopyColors.size >= 5, `Tree (${arc}, v${v}) canopy must have >= 5 ramp tones, got ${t1.canopyColors.size}`);
          variantHashes.add(t1.silhouetteHash);
          if (v === 0) arcSilhouettes.add(t1.silhouetteHash);
        }
        assert.equal(variantHashes.size, 3, `Arc ${arc} must have 3 distinct tree variants`);
      }

      assert.equal(arcSilhouettes.size, 4, "All 4 arcs must have distinct primary tree silhouettes");
    });

    it("applies seasonal foliage changes across spring (0), summer (1), autumn (2), and winter (3)", () => {
      for (const arc of ARCS) {
        const spring = bakeTreePixels(1, arc, 0);
        const summer = bakeTreePixels(1, arc, 1);
        const autumn = bakeTreePixels(1, arc, 2);
        const winter = bakeTreePixels(1, arc, 3);

        assert.notDeepEqual(spring.rgba, autumn.rgba, `${arc} spring and autumn trees must differ`);
        assert.notDeepEqual(summer.rgba, winter.rgba, `${arc} summer and winter trees must differ`);
      }

      // Elf grove sort 1 has blossoms in spring and gold in autumn
      const elfFoliageSpring = getElfTreeFoliage(1, 0);
      const elfFoliageAutumn = getElfTreeFoliage(1, 2);
      assert.equal(elfFoliageSpring.isBlossom, true);
      assert.equal(elfFoliageAutumn.isAutumnGold, true);
    });
  });

  describe("Item 2: Small Props (bushes, boulders, fence, lamp_post, well, barrel, crate)", () => {
    it("bakes all 7 small prop kinds deterministically with soft shadow and shaded ramp", () => {
      const expectedKinds: SmallPropKind[] = [
        "bush",
        "boulder",
        "fence",
        "lamp_post",
        "well",
        "barrel",
        "crate",
      ];
      assert.deepEqual(SMALL_PROP_KINDS, expectedKinds);

      for (const kind of expectedKinds) {
        const p1 = bakeSmallPropPixels(kind, "goblin_warrens", 0, 0);
        const p2 = bakeSmallPropPixels(kind, "goblin_warrens", 0, 0);
        assert.deepEqual(p1.rgba, p2.rgba, `Small prop ${kind} must be deterministic`);
        assert.ok(p1.opaquePixels > 25, `Small prop ${kind} must have visible pixels (${p1.opaquePixels})`);
        assert.ok(p1.shadowPixels > 6, `Small prop ${kind} must have a baked base shadow (${p1.shadowPixels})`);
      }

      // Lamp post must have warm lit lantern head pixels
      const lamp = bakeSmallPropPixels("lamp_post", "goblin_warrens", 0, 0);
      assert.ok(lamp.warmGlowPixels > 4, "lamp_post must have warm lit lantern head pixels");
    });

    it("exposes cached texture getters for all small props on PropTextureCache", () => {
      assert.equal(typeof PropTextureCache.prototype.getBushTexture, "function");
      assert.equal(typeof PropTextureCache.prototype.getBoulderTexture, "function");
      assert.equal(typeof PropTextureCache.prototype.getFenceTexture, "function");
      assert.equal(typeof PropTextureCache.prototype.getLampPostTexture, "function");
      assert.equal(typeof PropTextureCache.prototype.getWellTexture, "function");
      assert.equal(typeof PropTextureCache.prototype.getBarrelTexture, "function");
      assert.equal(typeof PropTextureCache.prototype.getCrateTexture, "function");
      assert.equal(typeof PropTextureCache.prototype.getSmallPropTexture, "function");
    });
  });

  describe("Item 3: Road and Bridge Tiles (5 road styles, connection masks, kerbs, edge wear, earthy non-purple)", () => {
    it("bakes all 5 road styles with muted earthy colours (never purple) and distinct surface textures", () => {
      assert.equal(ROAD_TILE_W, 64);
      assert.ok(ROAD_TILE_H >= 32 && ROAD_TILE_H <= 40);

      const styleHashes = new Set<number>();
      for (const style of ROAD_STYLES) {
        const r1 = bakeRoadPixels(style, 0, 5, "goblin_warrens", 0);
        const r2 = bakeRoadPixels(style, 0, 5, "goblin_warrens", 0);
        assert.deepEqual(r1.rgba, r2.rgba, `Road style ${style} must be deterministic`);
        assert.ok(r1.opaquePixels > 700, `Road style ${style} must cover the 64x32 isometric diamond`);
        assert.equal(r1.purplePixels, 0, `Road style ${style} must never contain purple pixels`);
        styleHashes.add(r1.surfaceHash);
      }
      assert.equal(styleHashes.size, ROAD_STYLES.length, "All 5 road styles must have distinct surface patterns");
    });

    it("applies lighter lit kerbs on unconnected lit edges, darker kerbs on shaded edges, and edge wear", () => {
      // Mask 0: all 4 edges unconnected -> has both lit kerbs (N,W) and shaded kerbs (E,S) plus edge wear
      const isolated = bakeRoadPixels("cobble", 0, 0, "goblin_warrens", 0);
      // Mask 15: all 4 edges connected -> 0 kerb pixels
      const crossroad = bakeRoadPixels("cobble", 0, 15, "goblin_warrens", 0);

      assert.ok(isolated.litKerbPixels > 20, "Isolated road (mask 0) must have lit kerb pixels on N/W");
      assert.ok(isolated.shadedKerbPixels > 20, "Isolated road (mask 0) must have shaded kerb pixels on E/S");
      assert.ok(isolated.edgeWearPixels > 10, "Isolated road (mask 0) must have edge wear scatter");
      assert.equal(crossroad.litKerbPixels, 0, "Fully connected road (mask 15) must have no lit kerbs");
      assert.equal(crossroad.shadedKerbPixels, 0, "Fully connected road (mask 15) must have no shaded kerbs");
      assert.ok(
        isolated.avgLitKerbLum > isolated.avgShadedKerbLum,
        `Lit kerb luminance (${isolated.avgLitKerbLum.toFixed(3)}) must exceed shaded kerb luminance (${isolated.avgShadedKerbLum.toFixed(3)})`
      );
    });

    it("bakes timber plank bridge with rope rails over water and zero purple pixels", () => {
      const b1 = bakeBridgePixels(0, 5, "goblin_warrens", 0);
      const b2 = bakeBridgePixels(0, 5, "goblin_warrens", 0);
      assert.deepEqual(b1.rgba, b2.rgba, "Bridge tile must be deterministic");
      assert.ok(b1.plankPixels > 300, "Bridge must have timber plank pixels");
      assert.ok(b1.ropeRailPixels > 20, "Bridge must have rope rail pixels");
      assert.equal(b1.purplePixels, 0, "Bridge must never contain purple pixels");
      assert.equal(isPurpleHue(0x7c3aed), true);
      assert.equal(isPurpleHue(0x6a5536), false);
    });

    it("preserves existing exported signatures in sprites-props.ts and sprites-ground.ts", () => {
      assert.equal(typeof drawTreeGraphics, "function");
      assert.equal(typeof drawTileGraphics, "function");
      assert.equal(typeof PropTextureCache, "function");
      assert.equal(typeof GroundTextureCache, "function");
      const theme = getTheme("goblin_warrens", 0);
      assert.ok(theme);
    });
  });
});
