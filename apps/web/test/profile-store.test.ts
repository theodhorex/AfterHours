import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  validateUsername,
  validateCityIds,
  validateProfile,
  suggestUsername,
  loadProfile,
  saveProfile,
  clearProfile,
  HONEST_PROFILE_STORAGE_LABEL,
  MAX_CITIES_PER_ACCOUNT,
} from "../src/lib/account/profile-store.ts";
import type { AccountProfile } from "../src/lib/account/types.ts";

describe("profile-store: validation helpers", () => {
  it("validates username length and allowed characters", () => {
    // Valid usernames (3-20 chars: letters, digits, underscore, hyphen)
    assert.equal(validateUsername("theo").valid, true);
    assert.equal(validateUsername("Brassy-Goblin-42").valid, true);
    assert.equal(validateUsername("abc").valid, true);
    assert.equal(validateUsername("user_name_123").valid, true);
    assert.equal(validateUsername("a".repeat(20)).valid, true);

    // Too short (< 3 chars)
    const shortRes = validateUsername("ab");
    assert.equal(shortRes.valid, false);
    assert.match(shortRes.error ?? "", /between 3 and 20/i);

    // Too long (> 20 chars)
    const longRes = validateUsername("a".repeat(21));
    assert.equal(longRes.valid, false);
    assert.match(longRes.error ?? "", /between 3 and 20/i);

    // Invalid characters (spaces, special symbols, emojis)
    const spaceRes = validateUsername("user name");
    assert.equal(spaceRes.valid, false);
    assert.match(spaceRes.error ?? "", /letters, digits, underscore, or hyphen/i);

    const emojiRes = validateUsername("theo🚀");
    assert.equal(emojiRes.valid, false);
  });

  it("validates city IDs enforcing max 2 cities and no duplicates", () => {
    assert.equal(MAX_CITIES_PER_ACCOUNT, 2);

    // 0, 1, or 2 distinct cities are valid
    assert.equal(validateCityIds([]).valid, true);
    assert.equal(validateCityIds(["city-goblin_warrens"]).valid, true);
    assert.equal(validateCityIds(["city-goblin_warrens", "city-cave_hold"]).valid, true);

    // > 2 cities is invalid
    const excessRes = validateCityIds(["city-goblin_warrens", "city-cave_hold", "city-dino_vale"]);
    assert.equal(excessRes.valid, false);
    assert.match(excessRes.error ?? "", /at most 2/i);

    // Duplicates are invalid
    const dupRes = validateCityIds(["city-goblin_warrens", "city-goblin_warrens"]);
    assert.equal(dupRes.valid, false);
    assert.match(dupRes.error ?? "", /duplicate/i);
  });

  it("validates complete profile shape", () => {
    const validProfile: AccountProfile = {
      accountId: "theo.testnet",
      username: "Brassy-Goblin-42",
      cityIds: ["city-goblin_warrens"],
    };
    assert.equal(validateProfile(validProfile).valid, true);

    const invalidAccount: AccountProfile = {
      accountId: "",
      username: "Brassy-Goblin-42",
      cityIds: [],
    };
    assert.equal(validateProfile(invalidAccount).valid, false);

    const invalidUser: AccountProfile = {
      accountId: "theo.testnet",
      username: "x",
      cityIds: [],
    };
    assert.equal(validateProfile(invalidUser).valid, false);
  });
});

describe("profile-store: suggestUsername determinism", () => {
  it("generates deterministic fun names from accountId hash without Math.random", () => {
    const name1 = suggestUsername("alice.testnet");
    const name2 = suggestUsername("alice.testnet");
    assert.equal(name1, name2);

    const nameOther = suggestUsername("bob.testnet");
    assert.notEqual(name1, nameOther);

    // Matches style "Brassy-Goblin-42"
    assert.match(name1, /^[A-Z][a-zA-Z]+-[A-Z][a-zA-Z]+-\d+$/);

    // The suggested name itself is valid
    assert.equal(validateUsername(name1).valid, true);
    assert.equal(validateUsername(nameOther).valid, true);
  });

  it("handles various account formats deterministically", () => {
    const s1 = suggestUsername("user1.near");
    const s2 = suggestUsername("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
    assert.equal(validateUsername(s1).valid, true);
    assert.equal(validateUsername(s2).valid, true);
  });
});

describe("profile-store: localStorage persistence and failure safety", () => {
  let fakeStorage: Record<string, string>;

  beforeEach(() => {
    fakeStorage = {};
    // Mock global localStorage in Node test environment
    const storageMock = {
      getItem: (key: string) => fakeStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        fakeStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete fakeStorage[key];
      },
      clear: () => {
        fakeStorage = {};
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      configurable: true,
      writable: true,
    });
  });

  it("saves and loads profile for account", () => {
    const profile: AccountProfile = {
      accountId: "theo.testnet",
      username: "Theo-Goblin-99",
      cityIds: ["city-goblin_warrens", "city-cave_hold"],
    };

    const saved = saveProfile(profile);
    assert.equal(saved, true);

    const loaded = loadProfile("theo.testnet");
    assert.deepEqual(loaded, profile);
  });

  it("returns null when profile does not exist", () => {
    const loaded = loadProfile("unknown.testnet");
    assert.equal(loaded, null);
  });

  it("clears profile", () => {
    const profile: AccountProfile = {
      accountId: "theo.testnet",
      username: "Theo-Goblin-99",
      cityIds: [],
    };
    saveProfile(profile);
    assert.notEqual(loadProfile("theo.testnet"), null);

    clearProfile("theo.testnet");
    assert.equal(loadProfile("theo.testnet"), null);
  });

  it("swallows storage failures without throwing", () => {
    // Simulate quota exceeded or storage disabled
    const brokenStorage = {
      getItem: () => {
        throw new Error("QuotaExceededError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
      clear: () => {},
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: brokenStorage,
      configurable: true,
      writable: true,
    });

    const profile: AccountProfile = {
      accountId: "theo.testnet",
      username: "Theo-Goblin-99",
      cityIds: [],
    };

    // None of these should throw
    assert.doesNotThrow(() => {
      const saved = saveProfile(profile);
      assert.equal(saved, false);
    });

    assert.doesNotThrow(() => {
      const loaded = loadProfile("theo.testnet");
      assert.equal(loaded, null);
    });

    assert.doesNotThrow(() => {
      const cleared = clearProfile("theo.testnet");
      assert.equal(cleared, false);
    });
  });

  it("swallows corrupted JSON in storage gracefully", () => {
    fakeStorage["afterhours_profile_corrupt.testnet"] = "not-json{";
    assert.doesNotThrow(() => {
      const loaded = loadProfile("corrupt.testnet");
      assert.equal(loaded, null);
    });
  });

  it("exports honest UI label matching specification", () => {
    assert.equal(
      HONEST_PROFILE_STORAGE_LABEL,
      "Your profile is stored in this browser, not on-chain."
    );
  });
});
