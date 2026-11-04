import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { runSteps } from "../src/run.ts";
import type { CityState } from "../src/types.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const arcs = readdirSync(join(root, "data/arcs"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => parseArc(JSON.parse(readFileSync(join(root, "data/arcs", f), "utf-8"))));

function coin(s: CityState): bigint {
  let t = s.citizens.purse + s.treasury;
  for (const sec of s.sectors) for (const b of sec.businesses) t += b.coin;
  return t;
}
function nonNegative(s: CityState): void {
  assert.ok(s.citizens.purse >= 0n && s.treasury >= 0n && s.citizens.population >= 1n);
  for (const sec of s.sectors) for (const b of sec.businesses) {
    assert.ok(b.coin >= 0n, `coin of ${b.id} negative`);
    for (const [item, q] of Object.entries(b.inventory)) assert.ok(q >= 0n, `${b.id} ${item} negative`);
  }
}

for (const arc of arcs) {
  test(`full run ${arc.id}: 400 steps keep coin conserved, values non-negative, and are deterministic`, () => {
    const a = genesis(arc, `city-${arc.id}`, "seed-full");
    const start = coin(a);
    const r1 = runSteps(a, 400, { arc, pricing, growth });
    nonNegative(r1.state);
    assert.equal(coin(r1.state), start, "total coin must be conserved");
    const r2 = runSteps(genesis(arc, `city-${arc.id}`, "seed-full"), 400, { arc, pricing, growth });
    assert.deepEqual(r2.roots, r1.roots, "same seed must give the same state roots");
  });
}
