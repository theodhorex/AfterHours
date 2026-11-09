import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_KNOWN_CITY_IDS,
  getKnownCityIds,
  nearToYocto,
  yoctoToNear,
  formatNear,
  formatShortAccountId,
  formatShortRoot,
  mapExchangeError,
  EXCHANGE_ERROR_MESSAGES,
  verifyCityHistory,
} from "../src/lib/exchange.ts";
import { TESTNET_CITIES } from "../src/data/testnet.ts";

describe("Exchange Pure Helpers & Formatter Logic (TDD)", () => {
  describe("getKnownCityIds", () => {
    it("returns default 4 published testnet cities when no profile ids provided", () => {
      const ids = getKnownCityIds();
      assert.deepEqual(ids, [
        "city-goblin_warrens",
        "city-cave_hold",
        "city-dino_vale",
        "city-elf_grove",
      ]);
    });

    it("merges and deduplicates profile city ids while preserving published order", () => {
      const profileIds = ["city-cave_hold", "city-custom_realm", "city-goblin_warrens"];
      const ids = getKnownCityIds(profileIds);
      assert.deepEqual(ids, [
        "city-goblin_warrens",
        "city-cave_hold",
        "city-dino_vale",
        "city-elf_grove",
        "city-custom_realm",
      ]);
    });

    it("handles empty or malformed profile arrays gracefully", () => {
      assert.deepEqual(getKnownCityIds([]), DEFAULT_KNOWN_CITY_IDS);
      assert.deepEqual(getKnownCityIds(["", "   "]), DEFAULT_KNOWN_CITY_IDS);
    });
  });

  describe("nearToYocto (strict BigInt conversion)", () => {
    it("converts whole NEAR values accurately without floats", () => {
      assert.equal(nearToYocto("1"), "1000000000000000000000000");
      assert.equal(nearToYocto("10"), "10000000000000000000000000");
      assert.equal(nearToYocto("0"), "0");
      assert.equal(nearToYocto("1000000"), "1000000000000000000000000000000");
    });

    it("converts decimal NEAR values with up to 24 decimals accurately", () => {
      assert.equal(nearToYocto("0.1"), "100000000000000000000000");
      assert.equal(nearToYocto("1.5"), "1500000000000000000000000");
      assert.equal(nearToYocto("0.0001"), "100000000000000000000");
      assert.equal(nearToYocto("0.000000000000000000000001"), "1");
      assert.equal(nearToYocto(".5"), "500000000000000000000000");
    });

    it("trims surrounding whitespace", () => {
      assert.equal(nearToYocto("  2.25  "), "2250000000000000000000000");
    });

    it("rejects negative amounts", () => {
      assert.throws(() => nearToYocto("-1"), /negative/i);
      assert.throws(() => nearToYocto("-0.5"), /negative/i);
    });

    it("rejects non-numeric characters", () => {
      assert.throws(() => nearToYocto("abc"), /invalid/i);
      assert.throws(() => nearToYocto("1.2.3"), /invalid/i);
      assert.throws(() => nearToYocto("1e18"), /invalid/i);
      assert.throws(() => nearToYocto("0x10"), /invalid/i);
    });

    it("rejects empty or whitespace-only inputs", () => {
      assert.throws(() => nearToYocto(""), /empty/i);
      assert.throws(() => nearToYocto("   "), /empty/i);
    });

    it("rejects fractional amounts exceeding 24 decimals", () => {
      const tooManyDecimals = "0." + "1".repeat(25);
      assert.throws(() => nearToYocto(tooManyDecimals), /24 decimals/i);
    });
  });

  describe("yoctoToNear & formatNear", () => {
    it("formats 1 NEAR (10^24 yocto) to 4 decimal string", () => {
      assert.equal(formatNear("1000000000000000000000000"), "1.0000");
      assert.equal(yoctoToNear("1000000000000000000000000"), "1");
    });

    it("formats 0 yocto correctly", () => {
      assert.equal(formatNear("0"), "0.0000");
      assert.equal(yoctoToNear("0"), "0");
      assert.equal(formatNear(0n), "0.0000");
    });

    it("formats fractional yocto with 4 decimals rounding or truncation", () => {
      // 1.5 NEAR
      assert.equal(formatNear("1500000000000000000000000"), "1.5000");
      // 0.0005 NEAR
      assert.equal(formatNear("500000000000000000000"), "0.0005");
      // less than 0.0001 NEAR (e.g. 1 yocto) -> 0.0000
      assert.equal(formatNear("1"), "0.0000");
    });

    it("formats large amounts with thousands separators if needed or plain string", () => {
      assert.equal(formatNear("25000000000000000000000000"), "25.0000");
    });

    it("handles invalid or empty yocto gracefully", () => {
      assert.equal(formatNear(""), "0.0000");
      assert.equal(formatNear("invalid"), "0.0000");
    });
  });

  describe("formatShortAccountId & formatShortRoot", () => {
    it("shortens long account IDs cleanly", () => {
      assert.equal(
        formatShortAccountId("afterhours-11042120-theo.testnet"),
        "afterhours...testnet"
      );
      assert.equal(formatShortAccountId("theo.testnet"), "theo.testnet");
    });

    it("handles short or empty account IDs", () => {
      assert.equal(formatShortAccountId(""), "—");
      assert.equal(formatShortAccountId("alice"), "alice");
    });

    it("truncates 64-character state roots", () => {
      const root = "22adb8808d9e0b7b3f4dfc1e1cac49a09c52ff1c975cc6c643045cac7c92bd6b";
      assert.equal(formatShortRoot(root), "22adb8...bd6b");
      assert.equal(formatShortRoot(""), "—");
      assert.equal(formatShortRoot("abc"), "abc");
    });
  });

  describe("mapExchangeError", () => {
    it("maps all required contract error codes to plain user-facing messages", () => {
      for (const [code, message] of Object.entries(EXCHANGE_ERROR_MESSAGES)) {
        assert.equal(mapExchangeError(code), message);
        assert.equal(mapExchangeError(new Error(`Execution failed: ${code}`)), message);
        assert.equal(mapExchangeError(`Smart contract panicked: ${code}`), message);
      }
    });

    it("handles unknown or missing errors with friendly fallback", () => {
      assert.equal(
        mapExchangeError(new Error("Network connection dropped")),
        "Network connection dropped"
      );
      assert.equal(
        mapExchangeError(null),
        "An unexpected error occurred during the transaction."
      );
      assert.equal(
        mapExchangeError(""),
        "An unexpected error occurred during the transaction."
      );
    });
  });

  describe("verifyCityHistory (Audit Before You Buy)", () => {
    it("returns mismatch if chainCity is null or not found", () => {
      const res = verifyCityHistory("city-goblin_warrens", null);
      assert.equal(res.ok, false);
      assert.equal(res.status, "mismatch");
      assert.equal(res.cityRoot, null);
    });

    it("verifies honest published testnet city replay successfully", () => {
      const goblin = TESTNET_CITIES["city-goblin_warrens"];
      const mockChainCity = {
        city_id: "city-goblin_warrens",
        step: goblin.steps,
        state_root: goblin.finalStateRoot,
        city_root: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      };

      const res = verifyCityHistory("city-goblin_warrens", mockChainCity);
      assert.equal(res.ok, true);
      assert.equal(res.status, "verified");
      assert.equal(res.cityRoot, mockChainCity.city_root);
    });

    it("detects state root mismatch and rejects verification", () => {
      const goblin = TESTNET_CITIES["city-goblin_warrens"];
      const tamperedChainCity = {
        city_id: "city-goblin_warrens",
        step: goblin.steps,
        state_root: "0000000000000000000000000000000000000000000000000000000000000000",
        city_root: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      };

      const res = verifyCityHistory("city-goblin_warrens", tamperedChainCity);
      assert.equal(res.ok, false);
      assert.equal(res.status, "mismatch");
      assert.equal(res.cityRoot, null);
    });
  });
});
