import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildCaravanView } from "../src/lib/caravan-view.ts";

describe("Caravan View Pure Logic (TDD)", () => {
  test("deterministic: multiple runs produce identical rows and balances", () => {
    const run1 = buildCaravanView(400, 10, "bread");
    const run2 = buildCaravanView(400, 10, "bread");

    assert.deepEqual(run1.rows, run2.rows);
    assert.deepEqual(run1.finalTreasury, run2.finalTreasury);
    assert.deepEqual(run1.finalItems, run2.finalItems);
    assert.equal(run1.conservationOk, run2.conservationOk);
  });

  test("conservation: all checkpoints pass checkConservation without failure", () => {
    const result = buildCaravanView(400, 10, "bread");
    assert.equal(result.conservationOk, true, "Conservation should be true across all checkpoints");
    assert.equal(result.cityConservation["city-dino_vale"], true);
    assert.equal(result.cityConservation["city-elf_grove"], true);
  });

  test("trade execution: produces at least one caravan with qty > 0 within 400 steps", () => {
    const result = buildCaravanView(400, 10, "bread");
    assert.ok(result.rows.length > 0, "Should have at least one caravan row");
    const positiveRows = result.rows.filter((r) => r.qty > 0n);
    assert.ok(positiveRows.length > 0, "Should have at least one caravan with qty > 0");

    for (const row of positiveRows) {
      assert.equal(row.fromCity, "city-dino_vale");
      assert.equal(row.toCity, "city-elf_grove");
      assert.ok(row.step > 0);
      assert.ok(row.unitPrice > 0n);
      assert.equal(row.coin, row.qty * row.unitPrice);
      assert.equal(row.sunkA, row.qty);
      assert.equal(row.sourcedB, row.qty);
    }
  });

  test("handles default parameters cleanly (400 steps, every 10, bread)", () => {
    const result = buildCaravanView();
    assert.ok(result.rows.length > 0);
    assert.equal(result.conservationOk, true);
    assert.ok(result.finalTreasury["city-dino_vale"] > 0n);
    assert.ok(result.finalTreasury["city-elf_grove"] >= 0n);
  });

  test("food price spread validation: bread spread allows positive trades between dino and elf", () => {
    // Bread in dino_vale has base price 13, in elf_grove has base price 48 (positive spread of 35)
    const result = buildCaravanView(400, 10, "bread");
    assert.ok(result.totalExported > 0n, "Dino Vale should have exported bread");
    assert.ok(result.totalImported > 0n, "Elf Grove should have imported bread");
    assert.equal(result.totalExported, result.totalImported, "Total exported must equal total imported");
  });
});
