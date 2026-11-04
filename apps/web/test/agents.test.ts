import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseAgent } from "../../../packages/rules/src/schema.ts";
import { getArc } from "../src/lib/sim-adapter.ts";
import {
  PRESET_AGENTS,
  runAgentBacktest,
  verifyEntry,
  rankEntries,
  loadLeaderboard,
  saveLeaderboard,
  type LeaderboardEntry,
  type StorageLike,
} from "../src/lib/agents.ts";

describe("Agents Pure Logic & Leaderboard (TDD)", () => {
  const arcIds = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"] as const;

  test("every preset parses on all four arcs", () => {
    const presetKeys = Object.keys(PRESET_AGENTS) as (keyof typeof PRESET_AGENTS)[];
    assert.ok(presetKeys.length >= 4, "must contain at least 4 presets");
    assert.ok(PRESET_AGENTS["bread-trader"], "bread-trader preset exists");
    assert.ok(PRESET_AGENTS["grain-hoarder"], "grain-hoarder preset exists");
    assert.ok(PRESET_AGENTS["crystal-flipper"], "crystal-flipper preset exists");
    assert.ok(PRESET_AGENTS["idle"], "idle preset exists");

    for (const arcId of arcIds) {
      const arc = getArc(arcId);
      for (const [key, jsonStr] of Object.entries(PRESET_AGENTS)) {
        const parsed = JSON.parse(jsonStr);
        const agent = parseAgent(parsed, arc);
        assert.ok(agent.name, `preset ${key} on ${arcId} has name`);
      }
    }
  });

  test("determinism: same inputs yield exact same entry", async () => {
    const opts = {
      arcId: "goblin_warrens",
      seed: "leaderboard_seed_alpha",
      agentJson: PRESET_AGENTS["grain-hoarder"],
      steps: 100,
      startCoin: 2000n,
    };

    const res1 = await runAgentBacktest(opts);
    const res2 = await runAgentBacktest(opts);

    assert.equal(res1.ok, true);
    assert.equal(res2.ok, true);
    if (res1.ok && res2.ok) {
      assert.deepEqual(res1.entry, res2.entry);
      assert.equal(typeof res1.entry.id, "string");
      assert.equal(typeof res1.entry.stateRoot, "string");
      assert.equal(typeof res1.entry.agentHash, "string");
      assert.equal(typeof res1.entry.score, "bigint");
      assert.equal(typeof res1.entry.trades, "number");
    }
  });

  test("deliberately invalid agent returns friendly errors without throwing", async () => {
    // 1. Unknown item
    const unknownItemAgent = JSON.stringify({
      version: 1,
      name: "Bad Item Agent",
      rules: [
        {
          id: "r1",
          when: [{ kind: "price", item: "quantum_core_99", op: "lte", value: "10" }],
          do: { kind: "buy", item: "quantum_core_99", qty: "1", max_price: "10" },
        },
      ],
    });
    const resUnknown = await runAgentBacktest({
      arcId: "goblin_warrens",
      seed: "seed_1",
      agentJson: unknownItemAgent,
      steps: 100,
      startCoin: 2000n,
    });
    assert.equal(resUnknown.ok, false);
    if (!resUnknown.ok) {
      assert.ok(resUnknown.errors.length > 0);
      assert.match(resUnknown.errors[0], /quantum_core_99/i);
    }

    // 2. Exceeds max rules (9 rules)
    const nineRules = Array.from({ length: 9 }, (_, i) => ({
      id: `rule_${i}`,
      when: [],
      do: { kind: "buy", item: "grain", qty: "1", max_price: "10" },
    }));
    const nineRulesAgent = JSON.stringify({
      version: 1,
      name: "Too Many Rules",
      rules: nineRules,
    });
    const resNine = await runAgentBacktest({
      arcId: "goblin_warrens",
      seed: "seed_1",
      agentJson: nineRulesAgent,
      steps: 100,
      startCoin: 2000n,
    });
    assert.equal(resNine.ok, false);
    if (!resNine.ok) {
      assert.ok(resNine.errors.length > 0);
      assert.match(resNine.errors[0], /rules.*maximum/i);
    }

    // 3. Bad op
    const badOpAgent = JSON.stringify({
      version: 1,
      name: "Bad Op Agent",
      rules: [
        {
          id: "r1",
          when: [{ kind: "price", item: "grain", op: "approximately_equal", value: "10" }],
          do: { kind: "buy", item: "grain", qty: "1", max_price: "10" },
        },
      ],
    });
    const resBadOp = await runAgentBacktest({
      arcId: "goblin_warrens",
      seed: "seed_1",
      agentJson: badOpAgent,
      steps: 100,
      startCoin: 2000n,
    });
    assert.equal(resBadOp.ok, false);
    if (!resBadOp.ok) {
      assert.ok(resBadOp.errors.length > 0);
      assert.match(resBadOp.errors[0], /op/i);
    }

    // 4. Broken JSON syntax
    const resSyntax = await runAgentBacktest({
      arcId: "goblin_warrens",
      seed: "seed_1",
      agentJson: "this is not json {",
      steps: 100,
      startCoin: 2000n,
    });
    assert.equal(resSyntax.ok, false);
    if (!resSyntax.ok) {
      assert.ok(resSyntax.errors.length > 0);
      assert.match(resSyntax.errors[0], /json/i);
    }
  });

  test("verifyEntry true for honest entry and false after changing one rule", async () => {
    const honestOpts = {
      arcId: "goblin_warrens",
      seed: "verify_seed_42",
      agentJson: PRESET_AGENTS["grain-hoarder"],
      steps: 80,
      startCoin: 2000n,
    };

    const runRes = await runAgentBacktest(honestOpts);
    assert.equal(runRes.ok, true);
    if (!runRes.ok) return;

    // Honest verification
    const honestVerify = await verifyEntry(runRes.entry, honestOpts.agentJson);
    assert.equal(honestVerify.verified, true);
    assert.equal(honestVerify.scoreMatches, true);
    assert.equal(honestVerify.rootMatches, true);

    // Tampered agent JSON (change qty from 15 to 25)
    const tamperedObj = JSON.parse(honestOpts.agentJson);
    tamperedObj.rules[0].do.qty = "25";
    const tamperedJson = JSON.stringify(tamperedObj);

    const tamperedVerify = await verifyEntry(runRes.entry, tamperedJson);
    assert.equal(tamperedVerify.verified, false);
  });

  test("rankEntries orders by score descending, then fewer trades, then name, stably", () => {
    const e1: LeaderboardEntry = {
      id: "id_1",
      name: "Alpha",
      arcId: "goblin_warrens",
      seed: "seed_1",
      steps: 100,
      startCoin: 2000n,
      score: 500n,
      trades: 10,
      stateRoot: "root_1",
      agentHash: "hash_1",
    };
    const e2: LeaderboardEntry = {
      id: "id_2",
      name: "Beta",
      arcId: "goblin_warrens",
      seed: "seed_1",
      steps: 100,
      startCoin: 2000n,
      score: 1000n,
      trades: 20,
      stateRoot: "root_2",
      agentHash: "hash_2",
    };
    const e3: LeaderboardEntry = {
      id: "id_3",
      name: "Gamma",
      arcId: "goblin_warrens",
      seed: "seed_1",
      steps: 100,
      startCoin: 2000n,
      score: 500n,
      trades: 5, // fewer trades than e1 -> should rank higher than e1
      stateRoot: "root_3",
      agentHash: "hash_3",
    };
    const e4: LeaderboardEntry = {
      id: "id_4",
      name: "Zeta",
      arcId: "goblin_warrens",
      seed: "seed_1",
      steps: 100,
      startCoin: 2000n,
      score: 500n,
      trades: 10, // same score and trades as e1, but Alpha < Zeta -> e1 ranks before e4
      stateRoot: "root_4",
      agentHash: "hash_4",
    };

    const ranked = rankEntries([e1, e2, e3, e4]);
    assert.deepEqual(ranked.map((e) => e.name), ["Beta", "Gamma", "Alpha", "Zeta"]);
  });

  test("localStorage persistence helpers serialize BigInt, cap at 20, and handle errors", () => {
    const memoryStore: Record<string, string> = {};
    const mockStorage: StorageLike = {
      getItem: (key: string) => memoryStore[key] ?? null,
      setItem: (key: string, val: string) => {
        memoryStore[key] = val;
      },
    };

    // Empty initially
    assert.deepEqual(loadLeaderboard(mockStorage), []);

    // Create 25 entries
    const entries: LeaderboardEntry[] = Array.from({ length: 25 }, (_, i) => ({
      id: `entry_${i}`,
      name: `Agent ${i}`,
      arcId: "goblin_warrens",
      seed: "seed",
      steps: 100,
      startCoin: 2000n,
      score: BigInt(i * 10),
      trades: i,
      stateRoot: `root_${i}`,
      agentHash: `hash_${i}`,
    }));

    saveLeaderboard(entries, mockStorage);
    const loaded = loadLeaderboard(mockStorage);
    assert.equal(loaded.length, 20, "capped at 20 entries");
    assert.equal(typeof loaded[0].score, "bigint");
    assert.equal(typeof loaded[0].startCoin, "bigint");
    assert.equal(loaded[0].score, 0n);
    assert.equal(loaded[19].score, 190n);

    // Corrupted JSON in storage doesn't throw and returns empty array
    const corruptStorage: StorageLike = {
      getItem: () => "invalid json {{",
      setItem: () => {},
    };
    assert.deepEqual(loadLeaderboard(corruptStorage), []);

    // Faulty storage doesn't throw
    const throwingStorage: StorageLike = {
      getItem: () => {
        throw new Error("QuotaExceeded / SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded / SecurityError");
      },
    };

    assert.doesNotThrow(() => {
      saveLeaderboard(entries, throwingStorage);
      const res = loadLeaderboard(throwingStorage);
      assert.deepEqual(res, []);
    });
  });
});
