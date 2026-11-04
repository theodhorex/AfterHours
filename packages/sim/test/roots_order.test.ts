import { test } from "node:test";
import assert from "node:assert/strict";
import { leaf, node, toHex, fromHex } from "../src/hash.ts";
import { businessLeaf, sectorRoot } from "../src/roots.ts";
import type { Business, SectorState } from "../src/types.ts";

function biz(id: string): Business {
  return { id, recipe: "farm", open: true, coin: 10n, inventory: {}, insolvent_steps: 0 };
}

// Regression: business order inside a sector must be plain code-unit order, never locale order.
// Locale order puts "a-1" and "A-1" in a different relative order than code-unit order.
test("sectorRoot orders businesses by code unit, not by locale", () => {
  const ids = ["a-1", "B-1", "A-1", "a1", "b-1"];
  const sector: SectorState = {
    idx: 0,
    kind: "food",
    owner: null,
    arc_origin: "goblin_warrens",
    rules: [],
    businesses: ids.map(biz),
  };
  const codeUnitOrder = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(codeUnitOrder, ["A-1", "B-1", "a-1", "a1", "b-1"]);

  const leaves = codeUnitOrder.map((id) => fromHex(businessLeaf(biz(id))));
  const businessesRoot = toHex(node(...leaves));
  const expected = toHex(
    leaf({
      idx: 0n,
      kind: "food",
      owner: null,
      arc_origin: "goblin_warrens",
      rules: [],
      businesses_root: businessesRoot,
    }),
  );
  assert.equal(sectorRoot(sector), expected);

  // Input order must not matter.
  const shuffled: SectorState = { ...sector, businesses: [...sector.businesses].reverse() };
  assert.equal(sectorRoot(shuffled), expected);
});
