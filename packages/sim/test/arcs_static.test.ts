import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArc } from "../src/arc.ts";
import type { ArcFile } from "../src/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARCS_DIR = path.resolve(__dirname, "../../../data/arcs");

export const SHARED_ITEM_IDS = [
  "grain",
  "flour",
  "bread",
  "fish",
  "ore",
  "ingot",
  "tool",
  "crystal",
  "elixir",
  "scroll",
] as const;

export const EXPECTED_ARC_FILES = [
  "goblin_warrens.json",
  "cave_hold.json",
  "dino_vale.json",
  "elf_grove.json",
] as const;

/**
 * 1. parseArc check
 */
export function checkParseArc(raw: unknown): ArcFile {
  return parseArc(raw);
}

/**
 * 2. Shared item IDs exist and every item is produced by some recipe
 */
export function checkSharedItems(arc: ArcFile): void {
  const itemMap = new Map(arc.items.map((it) => [it.id, it]));
  for (const sharedId of SHARED_ITEM_IDS) {
    if (!itemMap.has(sharedId)) {
      throw new Error(`Arc '${arc.id}' is missing required shared item '${sharedId}'`);
    }
  }

  const producedItems = new Set<string>();
  for (const r of arc.recipes) {
    for (const [outItem, qty] of Object.entries(r.outputs)) {
      if (qty > 0n) {
        producedItems.add(outItem);
      }
    }
  }

  for (const item of arc.items) {
    if (!producedItems.has(item.id)) {
      throw new Error(`Arc '${arc.id}' item '${item.id}' is not produced by any recipe`);
    }
  }
}

/**
 * 3. Every recipe has a profit margin of at least 20%:
 * outputValue >= (inputCost + wage) * 12 / 10 (bigint integer arithmetic)
 */
export function checkRecipeProfitMargins(arc: ArcFile): void {
  const priceMap = new Map<string, bigint>();
  for (const item of arc.items) {
    priceMap.set(item.id, item.base_price);
  }

  for (const r of arc.recipes) {
    let inputCost = 0n;
    for (const [inItem, qty] of Object.entries(r.inputs)) {
      const p = priceMap.get(inItem);
      if (p === undefined) {
        throw new Error(`Recipe '${r.id}' references unknown input item '${inItem}'`);
      }
      inputCost += p * qty;
    }

    let outputValue = 0n;
    for (const [outItem, qty] of Object.entries(r.outputs)) {
      const p = priceMap.get(outItem);
      if (p === undefined) {
        throw new Error(`Recipe '${r.id}' references unknown output item '${outItem}'`);
      }
      outputValue += p * qty;
    }

    const minRequired = ((inputCost + r.wage) * 12n) / 10n;
    if (outputValue < minRequired) {
      throw new Error(
        `Recipe '${r.id}' in arc '${arc.id}' fails 20% margin check: ` +
          `outputValue (${outputValue}) < minRequired (${minRequired}) with inputCost ${inputCost} and wage ${r.wage}`
      );
    }
  }
}

/**
 * 4. Every citizens.needs item and every alt item exists
 */
export function checkCitizensNeeds(arc: ArcFile): void {
  const itemSet = new Set(arc.items.map((it) => it.id));
  for (const need of arc.citizens.needs) {
    if (!itemSet.has(need.item)) {
      throw new Error(`Arc '${arc.id}' need item '${need.item}' not found in items`);
    }
    for (const altItem of need.alt) {
      if (!itemSet.has(altItem)) {
        throw new Error(`Arc '${arc.id}' need alt item '${altItem}' not found in items`);
      }
    }
  }
}

/**
 * Recursive capacity for a given item from the starting businesses.
 */
export function computeItemCapacity(
  item: string,
  arc: ArcFile,
  visited: Set<string> = new Set<string>()
): bigint {
  if (visited.has(item)) {
    throw new Error(`Cycle detected in recipe chain for item '${item}' in arc '${arc.id}'`);
  }
  const nextVisited = new Set(visited);
  nextVisited.add(item);

  const recipe = arc.recipes.find((r) => (r.outputs[item] ?? 0n) > 0n);
  if (!recipe) {
    return 0n;
  }

  const startingCount = arc.genesis.starting_businesses[recipe.id] ?? 0n;
  const runsAvail = startingCount * recipe.max_per_run_per_business;
  const outQty = recipe.outputs[item]!;

  let maxRuns = runsAvail;
  for (const [inItem, inQty] of Object.entries(recipe.inputs)) {
    if (inQty > 0n) {
      const upstreamCap = computeItemCapacity(inItem, arc, nextVisited);
      const runsAllowed = upstreamCap / inQty;
      if (runsAllowed < maxRuns) {
        maxRuns = runsAllowed;
      }
    }
  }

  return maxRuns * outQty;
}

/**
 * Checks whether `units` of `item` can be produced recursively:
 * runs needed = ceil(units / output qty), then inputs recursively.
 */
export function canProduceItemUnits(
  item: string,
  units: bigint,
  arc: ArcFile,
  visited: Set<string> = new Set<string>()
): boolean {
  if (units <= 0n) {
    return true;
  }
  if (visited.has(item)) {
    return false;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(item);

  const recipe = arc.recipes.find((r) => (r.outputs[item] ?? 0n) > 0n);
  if (!recipe) {
    return false;
  }

  const startingCount = arc.genesis.starting_businesses[recipe.id] ?? 0n;
  const runsAvail = startingCount * recipe.max_per_run_per_business;
  const outQty = recipe.outputs[item]!;
  const runsNeeded = (units + outQty - 1n) / outQty;

  if (runsNeeded > runsAvail) {
    return false;
  }

  for (const [inItem, inQty] of Object.entries(recipe.inputs)) {
    if (inQty > 0n) {
      const unitsNeeded = runsNeeded * inQty;
      if (!canProduceItemUnits(inItem, unitsNeeded, arc, nextVisited)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 5. Food capacity check:
 * bread capacity + fish capacity >= start_population * per_capita_milli / 1000
 */
export function checkFoodCapacity(arc: ArcFile): {
  breadCapacity: bigint;
  fishCapacity: bigint;
  foodCapacity: bigint;
  foodNeeded: bigint;
} {
  const breadNeed = arc.citizens.needs.find((n) => n.item === "bread");
  if (!breadNeed) {
    throw new Error(`Arc '${arc.id}' does not have 'bread' in citizens.needs`);
  }

  const foodNeeded = (arc.citizens.start_population * breadNeed.per_capita_milli) / 1000n;
  const breadCapacity = computeItemCapacity("bread", arc);
  const fishCapacity = computeItemCapacity("fish", arc);
  const foodCapacity = breadCapacity + fishCapacity;

  if (breadCapacity > 0n) {
    assert.ok(
      canProduceItemUnits("bread", breadCapacity, arc),
      `bread capacity ${breadCapacity} must be producible according to recursive demand check`
    );
  }
  if (fishCapacity > 0n) {
    assert.ok(
      canProduceItemUnits("fish", fishCapacity, arc),
      `fish capacity ${fishCapacity} must be producible according to recursive demand check`
    );
  }

  if (foodCapacity < foodNeeded) {
    throw new Error(
      `Arc '${arc.id}' insufficient food capacity: ` +
        `foodCapacity (${foodCapacity} = ${breadCapacity} bread + ${fishCapacity} fish) < foodNeeded (${foodNeeded})`
    );
  }

  return { breadCapacity, fishCapacity, foodCapacity, foodNeeded };
}

/**
 * 6. Starting businesses cover 12 distinct recipes and all exist in recipes
 */
export function checkStartingBusinesses(arc: ArcFile): void {
  const recipeSet = new Set(arc.recipes.map((r) => r.id));
  const startingKeys = Object.keys(arc.genesis.starting_businesses);

  if (startingKeys.length !== 12) {
    throw new Error(
      `Arc '${arc.id}' must have exactly 12 starting businesses, got ${startingKeys.length}`
    );
  }

  const seen = new Set<string>();
  for (const recId of startingKeys) {
    if (seen.has(recId)) {
      throw new Error(`Arc '${arc.id}' duplicate starting business recipe '${recId}'`);
    }
    seen.add(recId);

    if (!recipeSet.has(recId)) {
      throw new Error(
        `Arc '${arc.id}' starting business recipe '${recId}' does not exist in recipes`
      );
    }

    const count = arc.genesis.starting_businesses[recId];
    if (count <= 0n) {
      throw new Error(
        `Arc '${arc.id}' starting business recipe '${recId}' count must be positive, got ${count}`
      );
    }
  }

  if (seen.size !== 12) {
    throw new Error(`Arc '${arc.id}' starting businesses must cover 12 distinct recipes`);
  }
}

/**
 * 7. Genesis coin_per_business and coin_citizens are positive, and start_population is 80
 */
export function checkGenesisAndPopulation(arc: ArcFile): void {
  if (arc.genesis.coin_per_business <= 0n) {
    throw new Error(
      `Arc '${arc.id}' genesis.coin_per_business must be positive, got ${arc.genesis.coin_per_business}`
    );
  }
  if (arc.genesis.coin_citizens <= 0n) {
    throw new Error(
      `Arc '${arc.id}' genesis.coin_citizens must be positive, got ${arc.genesis.coin_citizens}`
    );
  }
  if (arc.citizens.start_population !== 80n) {
    throw new Error(
      `Arc '${arc.id}' citizens.start_population must be 80, got ${arc.citizens.start_population}`
    );
  }
}

/**
 * Runs all static checks (2)-(7) on a parsed arc.
 */
export function checkArcStatic(arc: ArcFile): void {
  checkSharedItems(arc);
  checkRecipeProfitMargins(arc);
  checkCitizensNeeds(arc);
  checkFoodCapacity(arc);
  checkStartingBusinesses(arc);
  checkGenesisAndPopulation(arc);
}

// =========================================================================
// Tests
// =========================================================================

test("TDD check: all required arc files exist in data/arcs", () => {
  for (const file of EXPECTED_ARC_FILES) {
    const fullPath = path.join(ARCS_DIR, file);
    assert.ok(fs.existsSync(fullPath), `Required arc file missing: ${file}`);
  }
});

// Run static checks over EVERY file in data/arcs/
const existingArcFiles = fs
  .readdirSync(ARCS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

for (const file of existingArcFiles) {
  test(`static check: data/arcs/${file}`, () => {
    const fullPath = path.join(ARCS_DIR, file);
    const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const arc = checkParseArc(raw);
    checkArcStatic(arc);
  });
}

// Negative tests using in-memory broken variants
test("negative test: checkSharedItems throws on missing shared item", () => {
  const caveHoldRaw = JSON.parse(fs.readFileSync(path.join(ARCS_DIR, "cave_hold.json"), "utf-8"));
  const arc = checkParseArc(caveHoldRaw);
  const brokenArc: ArcFile = {
    ...arc,
    items: arc.items.filter((it) => it.id !== "scroll"),
  };
  assert.throws(
    () => checkSharedItems(brokenArc),
    (err: Error) => err.message.includes("missing required shared item 'scroll'")
  );
});

test("negative test: checkSharedItems throws on unproduced item", () => {
  const caveHoldRaw = JSON.parse(fs.readFileSync(path.join(ARCS_DIR, "cave_hold.json"), "utf-8"));
  const arc = checkParseArc(caveHoldRaw);
  const brokenArc: ArcFile = {
    ...arc,
    recipes: arc.recipes.filter((r) => !r.outputs["scroll"]),
  };
  assert.throws(
    () => checkSharedItems(brokenArc),
    (err: Error) => err.message.includes("is not produced by any recipe")
  );
});

test("negative test: checkRecipeProfitMargins throws on recipe that loses money", () => {
  const caveHoldRaw = JSON.parse(fs.readFileSync(path.join(ARCS_DIR, "cave_hold.json"), "utf-8"));
  const arc = checkParseArc(caveHoldRaw);
  const brokenArc: ArcFile = {
    ...arc,
    recipes: arc.recipes.map((r) =>
      r.id === "mill" ? { ...r, wage: 1000n } : r
    ),
  };
  assert.throws(
    () => checkRecipeProfitMargins(brokenArc),
    (err: Error) => err.message.includes("fails 20% margin check")
  );
});

test("negative test: checkCitizensNeeds throws on missing need or alt item", () => {
  const caveHoldRaw = JSON.parse(fs.readFileSync(path.join(ARCS_DIR, "cave_hold.json"), "utf-8"));
  const arc = checkParseArc(caveHoldRaw);
  const brokenArc: ArcFile = {
    ...arc,
    citizens: {
      ...arc.citizens,
      needs: [
        ...arc.citizens.needs,
        { item: "non_existent_item", per_capita_milli: 10n, alt: [], satisfaction_weight: 100n },
      ],
    },
  };
  assert.throws(
    () => checkCitizensNeeds(brokenArc),
    (err: Error) => err.message.includes("not found in items")
  );
});

test("negative test: checkFoodCapacity throws when food capacity is insufficient", () => {
  const caveHoldRaw = JSON.parse(fs.readFileSync(path.join(ARCS_DIR, "cave_hold.json"), "utf-8"));
  const arc = checkParseArc(caveHoldRaw);
  const brokenArc: ArcFile = {
    ...arc,
    recipes: arc.recipes.map((r) =>
      r.id === "bakery" || r.id === "fisher"
        ? { ...r, max_per_run_per_business: 1n }
        : r
    ),
  };
  assert.throws(
    () => checkFoodCapacity(brokenArc),
    (err: Error) => err.message.includes("insufficient food capacity")
  );
});

test("negative test: checkStartingBusinesses throws when not 12 distinct recipes", () => {
  const caveHoldRaw = JSON.parse(fs.readFileSync(path.join(ARCS_DIR, "cave_hold.json"), "utf-8"));
  const arc = checkParseArc(caveHoldRaw);
  const brokenStarting = { ...arc.genesis.starting_businesses };
  delete brokenStarting["scribe"];
  const brokenArc: ArcFile = {
    ...arc,
    genesis: {
      ...arc.genesis,
      starting_businesses: brokenStarting,
    },
  };
  assert.throws(
    () => checkStartingBusinesses(brokenArc),
    (err: Error) => err.message.includes("must have exactly 12 starting businesses")
  );
});

test("negative test: checkGenesisAndPopulation throws on invalid population or capital", () => {
  const caveHoldRaw = JSON.parse(fs.readFileSync(path.join(ARCS_DIR, "cave_hold.json"), "utf-8"));
  const arc = checkParseArc(caveHoldRaw);
  const brokenArc: ArcFile = {
    ...arc,
    citizens: {
      ...arc.citizens,
      start_population: 75n,
    },
  };
  assert.throws(
    () => checkGenesisAndPopulation(brokenArc),
    (err: Error) => err.message.includes("citizens.start_population must be 80")
  );
});
