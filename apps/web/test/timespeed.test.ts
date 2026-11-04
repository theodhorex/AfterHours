import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FREE_TIERS,
  PREVIEW_TIERS,
  PREVIEW_PRICE_BASE,
  isFreeTier,
  isPreviewTier,
  pricePreview,
  canUse,
  buyTicket,
  effectiveSeasonsPerSecond,
  calculateCalendarClock,
  getActiveSpeed,
  clampWalletBalance,
  parseStoredWallet,
  serializeWallet,
  DEFAULT_WALLET_BALANCE,
  type SpeedWallet,
} from "../src/lib/timespeed.ts";

describe("Time Speed Pure Logic (TDD)", () => {
  it("tiers classification: free tiers vs preview tiers", () => {
    assert.deepEqual(FREE_TIERS, ["1x", "3x", "30x", "timelapse"]);
    assert.deepEqual(PREVIEW_TIERS, ["60x", "120x", "240x", "480x", "960x"]);

    for (const tier of FREE_TIERS) {
      assert.equal(isFreeTier(tier), true, `${tier} should be free`);
      assert.equal(isPreviewTier(tier), false, `${tier} should not be preview`);
    }

    for (const tier of PREVIEW_TIERS) {
      assert.equal(isPreviewTier(tier), true, `${tier} should be preview`);
      assert.equal(isFreeTier(tier), false, `${tier} should not be free`);
    }
  });

  it("prices monotonic and doubling per preview tier, free tiers cost 0", () => {
    for (const tier of FREE_TIERS) {
      assert.equal(pricePreview(tier), 0, `Free tier ${tier} must cost 0 bread`);
    }

    assert.equal(pricePreview("60x"), PREVIEW_PRICE_BASE);
    assert.equal(pricePreview("60x"), 100);
    assert.equal(pricePreview("120x"), 200);
    assert.equal(pricePreview("240x"), 400);
    assert.equal(pricePreview("480x"), 800);
    assert.equal(pricePreview("960x"), 1600);

    for (let i = 0; i < PREVIEW_TIERS.length - 1; i++) {
      const current = pricePreview(PREVIEW_TIERS[i]);
      const next = pricePreview(PREVIEW_TIERS[i + 1]);
      assert.ok(
        next > current,
        `Expected ${PREVIEW_TIERS[i + 1]} (${next}) > ${PREVIEW_TIERS[i]} (${current})`
      );
    }
  });

  it("no purchase when bread balance is short", () => {
    const poorWallet: SpeedWallet = {
      bread: 50,
      activeTicket: null,
      sinkLog: [],
    };
    const now = 1000;
    const result = buyTicket(poorWallet, "60x", now);

    assert.equal(result.success, false);
    assert.equal(result.wallet.bread, 50);
    assert.equal(result.wallet.activeTicket, null);
    assert.equal(result.wallet.sinkLog.length, 0);
    assert.match(result.error ?? "", /insufficient/i);
  });

  it("buying a ticket deducts bread, sets active ticket, and logs a sink entry", () => {
    const initialWallet: SpeedWallet = {
      bread: 350,
      activeTicket: null,
      sinkLog: [],
    };
    const now = 50000;
    const durationMs = 600000; // 10 minutes

    const result = buyTicket(initialWallet, "60x", now, durationMs);
    assert.equal(result.success, true);
    assert.equal(result.wallet.bread, 250); // 350 - 100
    assert.ok(result.ticket);
    assert.equal(result.ticket?.tier, "60x");
    assert.equal(result.ticket?.purchasedAt, now);
    assert.equal(result.ticket?.expiresAt, now + durationMs);
    assert.equal(result.ticket?.costBread, 100);

    assert.equal(result.wallet.sinkLog.length, 1);
    const log = result.wallet.sinkLog[0];
    assert.equal(log.tier, "60x");
    assert.equal(log.cost, 100);
    assert.equal(log.timestamp, now);
  });

  it("expiry check with injected now: active while valid, reverts to 30x upon expiry", () => {
    const now = 10000;
    const expiresAt = now + 600000;
    const walletWithPass: SpeedWallet = {
      bread: 100,
      activeTicket: {
        tier: "120x",
        purchasedAt: now,
        expiresAt,
        costBread: 200,
      },
      sinkLog: [],
    };

    // Free tiers always allowed
    assert.equal(canUse(walletWithPass, "30x", now), true);
    assert.equal(canUse(walletWithPass, "1x", now), true);

    // Active tier allowed while now < expiresAt
    assert.equal(canUse(walletWithPass, "120x", now), true);
    assert.equal(canUse(walletWithPass, "120x", expiresAt - 1), true);

    // Other unpurchased preview tier not allowed
    assert.equal(canUse(walletWithPass, "240x", now), false);

    // Expired tier not allowed at or after expiresAt
    assert.equal(canUse(walletWithPass, "120x", expiresAt), false);
    assert.equal(canUse(walletWithPass, "120x", expiresAt + 1000), false);

    // getActiveSpeed returns requested speed when valid, reverts to 30x when expired
    assert.equal(getActiveSpeed("120x", walletWithPass, now), "120x");
    assert.equal(getActiveSpeed("120x", walletWithPass, expiresAt), "30x");
    assert.equal(getActiveSpeed("120x", walletWithPass, expiresAt + 5000), "30x");
    assert.equal(getActiveSpeed("30x", walletWithPass, expiresAt + 5000), "30x");
  });

  it("effectiveSeasonsPerSecond returns proportional pace across tiers", () => {
    const pace1x = effectiveSeasonsPerSecond("1x");
    const pace3x = effectiveSeasonsPerSecond("3x");
    const pace30x = effectiveSeasonsPerSecond("30x");
    const pace60x = effectiveSeasonsPerSecond("60x");
    const pace120x = effectiveSeasonsPerSecond("120x");

    assert.ok(pace1x > 0);
    assert.ok(Math.abs(pace3x - pace1x * 3) < 1e-12);
    assert.ok(Math.abs(pace30x - pace1x * 30) < 1e-12);
    assert.ok(Math.abs(pace60x - pace30x * 2) < 1e-12);
    assert.ok(Math.abs(pace120x - pace60x * 2) < 1e-12);

    // Timelapse animates selectable steps per second
    const timelapsePace = effectiveSeasonsPerSecond("timelapse", 4);
    assert.equal(timelapsePace, 4);
  });

  it("in-world calendar clock calculates (year, season, day) from step and dayOffset", () => {
    // 1 step = 1 season = 91.25 days, 4 steps = 1 year = 365 days
    const c0 = calculateCalendarClock(0, 0);
    assert.equal(c0.year, 0);
    assert.equal(c0.season, "Spring");
    assert.equal(c0.day, 1);
    assert.equal(c0.totalDays, 0);

    const c1 = calculateCalendarClock(1, 0);
    assert.equal(c1.year, 0);
    assert.equal(c1.season, "Summer");
    assert.equal(c1.day, 1);
    assert.equal(c1.totalDays, 91.25);

    const c3 = calculateCalendarClock(3, 10);
    assert.equal(c3.year, 0);
    assert.equal(c3.season, "Winter");
    assert.equal(c3.day, 11);

    const c4 = calculateCalendarClock(4, 0);
    assert.equal(c4.year, 1);
    assert.equal(c4.season, "Spring");
    assert.equal(c4.day, 1);

    // Step 10000 = 2500 years
    const cFinal = calculateCalendarClock(10000, 0);
    assert.equal(cFinal.year, 2500);
    assert.equal(cFinal.season, "Spring");
  });

  it("security & hardening: clamp balance and safe JSON parse fallback", () => {
    assert.equal(clampWalletBalance(-100), 0);
    assert.equal(clampWalletBalance(NaN), 0);
    assert.equal(clampWalletBalance(Infinity), 1_000_000);
    assert.equal(clampWalletBalance(42.8), 42);
    assert.equal(clampWalletBalance(2_000_000), 1_000_000);

    // Corrupt data fallback
    const fallback = parseStoredWallet("invalid json {{");
    assert.equal(fallback.bread, DEFAULT_WALLET_BALANCE);
    assert.equal(fallback.activeTicket, null);
    assert.deepEqual(fallback.sinkLog, []);

    // Valid serialization and parsing roundtrip
    const validWallet: SpeedWallet = {
      bread: 220,
      activeTicket: {
        tier: "60x",
        purchasedAt: 1000,
        expiresAt: 2000,
        costBread: 100,
      },
      sinkLog: [
        {
          id: "sink_1",
          timestamp: 1000,
          tier: "60x",
          cost: 100,
          description: "60x pass",
        },
      ],
    };
    const json = serializeWallet(validWallet);
    const parsed = parseStoredWallet(json);
    assert.equal(parsed.bread, 220);
    assert.equal(parsed.activeTicket?.tier, "60x");
    assert.equal(parsed.sinkLog.length, 1);
  });
});
