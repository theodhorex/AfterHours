import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateLightCurve,
  getLightTint,
  getLightBrightness,
  getLightPoolIntensity,
  getPhaseName,
  blendTints,
  updateClock,
  findLightPoolOrigins,
  cullLightPools,
  MAX_LIGHT_POOLS,
  DAY_DURATION_SEC,
  REDUCED_MOTION_T,
} from "../src/lib/iso/light-curve.ts";
import {
  getWeatherParticleCounts,
  computeCrossFadeAlpha,
  getSeasonWeatherSpec,
  IsoWeatherSystem,
  MAX_WEATHER_PARTICLES,
  CROSSFADE_DURATION_SEC,
} from "../src/lib/iso/weather-system.ts";
import { IsoLightSystem } from "../src/lib/iso/light-system.ts";
import { Container } from "pixi.js";

describe("Day/Night Light Curve Pure Helpers (N1 Item 1 & 4)", () => {
  it("DAY_DURATION_SEC is configured to 120 seconds", () => {
    assert.equal(DAY_DURATION_SEC, 120);
  });

  it("light curve wraps continuously at 0 and 1 without discontinuity", () => {
    const atZero = evaluateLightCurve(0.0);
    const atOne = evaluateLightCurve(1.0);
    const nearOne = evaluateLightCurve(0.9999);

    assert.ok(Math.abs(atZero.r - atOne.r) < 0.001);
    assert.ok(Math.abs(atZero.g - atOne.g) < 0.001);
    assert.ok(Math.abs(atZero.b - atOne.b) < 0.001);

    assert.ok(Math.abs(atZero.r - nearOne.r) < 0.01);
    assert.ok(Math.abs(atZero.g - nearOne.g) < 0.01);
    assert.ok(Math.abs(atZero.b - nearOne.b) < 0.01);
  });

  it("brightness floor never drops below 55% across all 24 hours of the cycle", () => {
    const samples = 240;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const rgb = evaluateLightCurve(t);
      const brightness = getLightBrightness(rgb);
      assert.ok(
        brightness >= 0.55,
        `Brightness at t=${t.toFixed(3)} was ${brightness.toFixed(3)}, must be >= 0.55`
      );
      assert.ok(rgb.r >= 0 && rgb.r <= 1.01, `R channel in range [0, 1] at ${t}`);
      assert.ok(rgb.g >= 0 && rgb.g <= 1.01, `G channel in range [0, 1] at ${t}`);
      assert.ok(rgb.b >= 0 && rgb.b <= 1.01, `B channel in range [0, 1] at ${t}`);
    }
  });

  it("distinctive palettes: dawn is warm pink, day is neutral, dusk is orange, night is cool blue", () => {
    // Dawn around t = 0.05
    const dawn = evaluateLightCurve(0.05);
    assert.equal(getPhaseName(0.05), "dawn");
    assert.ok(dawn.r > dawn.b, "Dawn has warm/red-dominant component");
    assert.ok(dawn.r > 0.85 && dawn.b > 0.65, "Dawn has warm pink tones");

    // Day around t = 0.3
    const day = evaluateLightCurve(0.3);
    assert.equal(getPhaseName(0.3), "day");
    assert.ok(day.r >= 0.95 && day.g >= 0.95 && day.b >= 0.95, "Day is bright neutral light");

    // Dusk around t = 0.6
    const dusk = evaluateLightCurve(0.6);
    assert.equal(getPhaseName(0.6), "dusk");
    assert.ok(dusk.r > dusk.g && dusk.g > dusk.b, "Dusk has strong warm orange gradient (R > G > B)");
    assert.ok(dusk.r - dusk.b > 0.25, "Dusk orange warmth stands out clearly from cool night");

    // Night around t = 0.8
    const night = evaluateLightCurve(0.8);
    assert.equal(getPhaseName(0.8), "night");
    assert.ok(night.b > night.r, "Night has cool blue-dominant tone (B > R)");
    assert.ok(night.b >= 0.70, "Night retains blue luminosity");
  });

  it("light pools fade in at dusk, stay lit at night, and fade out at dawn", () => {
    // Day: no light pools
    assert.equal(getLightPoolIntensity(0.3), 0.0);

    // Dusk: fading in
    const duskStart = getLightPoolIntensity(0.52);
    const duskMid = getLightPoolIntensity(0.62);
    assert.ok(duskStart >= 0 && duskStart <= duskMid);
    assert.ok(duskMid > 0.5);

    // Night: full intensity
    assert.equal(getLightPoolIntensity(0.8), 1.0);

    // Dawn: fading out
    const dawnIntensity = getLightPoolIntensity(0.05);
    assert.ok(dawnIntensity < 0.5);
    assert.equal(getLightPoolIntensity(0.15), 0.0);
  });

  it("reduced motion daytime constant provides warm dusk-free daytime", () => {
    assert.equal(getPhaseName(REDUCED_MOTION_T), "day");
    assert.equal(getLightPoolIntensity(REDUCED_MOTION_T), 0.0);
    const rgb = evaluateLightCurve(REDUCED_MOTION_T);
    assert.ok(rgb.r >= 0.95 && rgb.g >= 0.95);
  });

  it("blendTints multiplies base theme ambient tint with light curve tint", () => {
    const base = 0xfffef6;
    const light = 0x8899bb;
    const blended = blendTints(base, light);
    // Should be valid 24-bit hex number
    assert.ok(typeof blended === "number");
    assert.ok(blended >= 0 && blended <= 0xffffff);

    // Neutral daylight (0xffffff) with base tint preserves base tint
    const neutral = blendTints(base, 0xffffff);
    assert.equal(neutral, base);
  });

  it("getLightTint returns correct 24-bit hex color", () => {
    const tint = getLightTint(0.3);
    assert.ok(typeof tint === "number");
    assert.ok(tint >= 0 && tint <= 0xffffff);
  });

  it("updateClock advances with dt, wraps cleanly, pauses when hidden, and fixes midday on reduced motion", () => {
    // Normal advance: dt = 12s -> advance by 12/120 = 0.10
    const nextT = updateClock(0.1, 12.0, false, false);
    assert.ok(Math.abs(nextT - 0.2) < 0.0001);

    // Wrapping past 1.0
    const wrapped = updateClock(0.95, 12.0, false, false);
    assert.ok(Math.abs(wrapped - 0.05) < 0.0001);

    // Paused (e.g. document.hidden)
    const paused = updateClock(0.4, 5.0, true, false);
    assert.equal(paused, 0.4, "Clock must freeze when paused/hidden");

    // Reduced motion -> always fixed at REDUCED_MOTION_T
    const reduced = updateClock(0.8, 5.0, false, true);
    assert.equal(reduced, REDUCED_MOTION_T, "Clock must lock to midday daytime on reduced motion");
  });

  it("findLightPoolOrigins extracts origins from layout and strictly caps at MAX_LIGHT_POOLS (<= 40)", () => {
    const dummyLayout = {
      roads: [],
      sectors: [{ idx: 0, name: "Forge", kind: "forge" as const }],
      buildings: [
        { id: "b1", sectorIdx: 0, tileX: 5, tileY: 5, level: 1, open: true, ruined: false, name: "Forge 1" },
        { id: "b2", sectorIdx: 0, tileX: 7, tileY: 7, level: 2, open: true, ruined: false, name: "Forge 2" },
      ],
      houses: Array.from({ length: 60 }, (_, i) => ({
        id: `h_${i}`,
        tileX: i % 10,
        tileY: Math.floor(i / 10),
        level: (i % 3) + 1,
      })),
      plaza: { x: 0, y: 0 },
    };

    const pools = findLightPoolOrigins(dummyLayout);
    assert.ok(pools.length <= MAX_LIGHT_POOLS, `Pool count ${pools.length} must be <= ${MAX_LIGHT_POOLS}`);
    assert.equal(MAX_LIGHT_POOLS, 40);
    assert.ok(pools.length > 0);
    // Plaza or forge should be prioritized
    assert.ok(pools.some((p) => p.kind === "plaza" || p.kind === "forge" || p.kind === "building"));
  });

  it("cullLightPools accurately flags pools inside or outside viewport with margin", () => {
    const pools = [
      { x: 0, y: 0 }, // Center: in view
      { x: 1000, y: 1000 }, // Far out: culled
      { x: 450, y: 250 }, // Near boundary: in view with margin
    ];
    const bounds = { minX: -400, maxX: 400, minY: -200, maxY: 200 };
    const culled = cullLightPools(pools, bounds, 64);

    assert.equal(culled[0], true);
    assert.equal(culled[1], false);
    assert.equal(culled[2], true);
  });
});

describe("Season Weather Pure Logic & Particles (N1 Item 2 & 4)", () => {
  it("MAX_WEATHER_PARTICLES is strictly capped at 120 and crossfade is 2 seconds", () => {
    assert.equal(MAX_WEATHER_PARTICLES, 120);
    assert.equal(CROSSFADE_DURATION_SEC, 2.0);
  });

  it("reduced motion strictly yields zero particles for all seasons", () => {
    for (let season = 0; season < 4; season++) {
      const counts = getWeatherParticleCounts(season, false);
      assert.equal(counts.total, 0, `Season ${season} must yield 0 particles under reduced motion`);
      assert.equal(counts.primary, 0);
      assert.equal(counts.secondary, 0);
    }
  });

  it("particle counts per season strictly obey cap of <= 120", () => {
    // Spring (0)
    const spring = getWeatherParticleCounts(0, true, 0.3);
    assert.ok(spring.total > 0 && spring.total <= MAX_WEATHER_PARTICLES);
    assert.ok(spring.primary > 0, "Spring has rain particles");

    // Summer daytime (1)
    const summerDay = getWeatherParticleCounts(1, true, 0.3);
    assert.ok(summerDay.total > 0 && summerDay.total <= MAX_WEATHER_PARTICLES);

    // Summer dusk/night (1)
    const summerNight = getWeatherParticleCounts(1, true, 0.8);
    assert.ok(summerNight.total > 0 && summerNight.total <= MAX_WEATHER_PARTICLES);
    assert.ok(summerNight.secondary > 0, "Summer dusk/night includes fireflies");

    // Autumn (2)
    const autumn = getWeatherParticleCounts(2, true, 0.3);
    assert.ok(autumn.total > 0 && autumn.total <= MAX_WEATHER_PARTICLES);
    assert.ok(autumn.primary > 0, "Autumn has blowing leaves");
    assert.ok(autumn.secondary > 0, "Autumn has low fog band");

    // Winter (3)
    const winter = getWeatherParticleCounts(3, true, 0.3);
    assert.ok(winter.total > 0 && winter.total <= MAX_WEATHER_PARTICLES);
    assert.ok(winter.primary > 0, "Winter has snow flakes");
  });

  it("season weather specs provide correct particle types and aesthetics", () => {
    // Spring
    const spSpec = getSeasonWeatherSpec(0, 0.3);
    assert.equal(spSpec.primaryKind, "rain");
    assert.equal(spSpec.secondaryKind, "ripple");

    // Summer day vs dusk/night
    const suDay = getSeasonWeatherSpec(1, 0.3);
    assert.equal(suDay.primaryKind, "dust");
    assert.equal(suDay.secondaryKind, "none");

    const suNight = getSeasonWeatherSpec(1, 0.8);
    assert.equal(suNight.primaryKind, "dust");
    assert.equal(suNight.secondaryKind, "fireflies");

    // Autumn
    const auSpec = getSeasonWeatherSpec(2, 0.3);
    assert.equal(auSpec.primaryKind, "leaves");
    assert.equal(auSpec.secondaryKind, "fog");

    // Winter
    const wiSpec = getSeasonWeatherSpec(3, 0.3);
    assert.equal(wiSpec.primaryKind, "snow");
    assert.equal(wiSpec.secondaryKind, "none");
  });

  it("computeCrossFadeAlpha smoothly blends between outgoing and incoming seasons over 2.0s", () => {
    // At start (0.0s): 100% old season, 0% new season
    const atStart = computeCrossFadeAlpha(0.0, 2.0);
    assert.equal(atStart.fadeOutAlpha, 1.0);
    assert.equal(atStart.fadeInAlpha, 0.0);

    // At midpoint (1.0s): 50% each
    const atMid = computeCrossFadeAlpha(1.0, 2.0);
    assert.ok(Math.abs(atMid.fadeOutAlpha - 0.5) < 0.01);
    assert.ok(Math.abs(atMid.fadeInAlpha - 0.5) < 0.01);

    // At finish (2.0s): 0% old, 100% new
    const atEnd = computeCrossFadeAlpha(2.0, 2.0);
    assert.equal(atEnd.fadeOutAlpha, 0.0);
    assert.equal(atEnd.fadeInAlpha, 1.0);

    // Past finish (> 2.0s): clamped
    const past = computeCrossFadeAlpha(2.5, 2.0);
    assert.equal(past.fadeOutAlpha, 0.0);
    assert.equal(past.fadeInAlpha, 1.0);
  });

  it("scene rebuild stability: circadian clock and particles survive sim step rebuilds without reset or flicker", () => {
    const lightSystem = new IsoLightSystem();
    const weatherSystem = new IsoWeatherSystem();
    const mockRoot = new Container();

    // 1. Advance clock by 10s: timeT moves from 0.3 to ~0.3833
    lightSystem.update(10.0, mockRoot, 0xfffef6, undefined, true);
    const timeBeforeRebuild = lightSystem.timeT;
    assert.ok(Math.abs(timeBeforeRebuild - (0.3 + 10 / 120)) < 0.001);

    // 2. Simulate step rebuild: setLayout is called with new building layout
    lightSystem.setLayout({
      buildings: [{ tileX: 4, tileY: 4, open: true, ruined: false, sectorIdx: 0 }],
      houses: [{ tileX: 2, tileY: 2, level: 1 }],
      plaza: { x: 0, y: 0 },
    });

    // Clock MUST NOT reset!
    assert.equal(lightSystem.timeT, timeBeforeRebuild, "Circadian clock must survive scene rebuilds");

    // 3. Weather setup with Spring (0)
    weatherSystem.setSeason(0, true, lightSystem.timeT);
    weatherSystem.update(0.5, lightSystem.timeT, undefined, true);

    // Count active particles before simulated sim step
    const activeParticles = (weatherSystem as unknown as { particles: Array<{ active: boolean; isOutgoing: boolean }> })
      .particles.filter((p) => p.active);
    assert.ok(activeParticles.length > 0, "Weather particles must be active in spring");

    // Sim step happens: setSeason(0) is called again with the held season
    weatherSystem.setSeason(0, true, lightSystem.timeT);

    // Particles must NOT be marked outgoing or reset on same season step
    const hasOutgoing = (weatherSystem as unknown as { particles: Array<{ active: boolean; isOutgoing: boolean }> })
      .particles.some((p) => p.isOutgoing);
    assert.equal(hasOutgoing, false, "Particles must not be marked outgoing when season is unchanged across steps");

    // 4. Now change season to Summer (1) -> triggers 2s crossfade
    weatherSystem.setSeason(1, true, lightSystem.timeT);
    const hasOutgoingAfterChange = (weatherSystem as unknown as { particles: Array<{ active: boolean; isOutgoing: boolean }> })
      .particles.some((p) => p.isOutgoing);
    assert.equal(hasOutgoingAfterChange, true, "Season change must initiate crossfade with outgoing particles");

    lightSystem.destroy();
    weatherSystem.destroy();
    mockRoot.destroy({ children: true });
  });

  it("determinism: light evaluation and weather initializations are 100% reproducible", () => {
    // Light evaluation at exact timestamp gives identical colors
    for (let i = 0; i < 10; i++) {
      const t = i * 0.1;
      const c1 = evaluateLightCurve(t);
      const c2 = evaluateLightCurve(t);
      assert.deepEqual(c1, c2, `Light curve evaluation must be deterministic at t=${t}`);
    }

    // Weather spec counts are deterministic
    for (let season = 0; season < 4; season++) {
      const w1 = getWeatherParticleCounts(season, true, 0.3);
      const w2 = getWeatherParticleCounts(season, true, 0.3);
      assert.deepEqual(w1, w2, `Weather counts must be deterministic for season ${season}`);
    }
  });
});
