/**
 * Derives consistent base prices for an arc from its recipes, so that every recipe is
 * profitable: price(output) = (sum(input price * qty) + wage) * (1 + margin) / total output units,
 * rounded up. Primary producers (no inputs) are priced from their wage alone.
 * Without this, a recipe can lose money on every run (e.g. a mill paying more for grain than it
 * earns from flour) and the whole supply chain deadlocks.
 *
 * Usage: node scripts/derive_prices.ts [arc.json ...]   (default: every file in data/arcs)
 * Rewrites the files in place. Deterministic: same input, same output.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MARGIN_BPS = 2500n; // 25% margin over cost
const GENESIS_COIN_PER_BUSINESS = 1500; // working capital, sized to wages and input purchases
const GENESIS_COIN_CITIZENS = 10000;
const START_POPULATION = 80; // sized to the starting production capacity (see docs/data-contract.md)

type Recipe = { id: string; inputs: Record<string, number>; outputs: Record<string, number>; wage: number };
type Arc = { items: { id: string; base_price: number }[]; recipes: Recipe[]; citizens: { start_population: number }; genesis: { coin_per_business: number; coin_citizens: number } };

export function derivePrices(arc: Arc, marginBps: bigint = MARGIN_BPS): Record<string, number> {
  const price: Record<string, bigint> = {};
  let progress = true;
  while (progress) {
    progress = false;
    for (const r of arc.recipes) {
      const outs = Object.entries(r.outputs);
      if (outs.some(([id]) => price[id] !== undefined)) continue;
      const ins = Object.entries(r.inputs);
      if (ins.some(([id]) => price[id] === undefined)) continue;
      const cost = ins.reduce((a, [id, q]) => a + price[id] * BigInt(q), 0n) + BigInt(r.wage);
      const totalOut = outs.reduce((a, [, q]) => a + BigInt(q), 0n);
      let p = (cost * (10000n + marginBps) + 10000n * totalOut - 1n) / (10000n * totalOut);
      if (p < 1n) p = 1n;
      for (const [id] of outs) price[id] = p;
      progress = true;
    }
  }
  const result: Record<string, number> = {};
  for (const [id, p] of Object.entries(price)) result[id] = Number(p);
  return result;
}

/** Pretty JSON that keeps small objects/arrays on one line (readable diffs for data files). */
function compactJson(v: unknown, indent = 0): string {
  const one = JSON.stringify(v, null, 1).replace(/\n\s*/g, " ");
  const pad = "  ".repeat(indent);
  if (v === null || typeof v !== "object" || one.length + pad.length <= 110) return one.replace(/\[ /g, "[").replace(/ \]/g, "]");
  const inner = "  ".repeat(indent + 1);
  if (Array.isArray(v)) return "[\n" + v.map((x) => inner + compactJson(x, indent + 1)).join(",\n") + "\n" + pad + "]";
  return "{\n" + Object.entries(v).map(([k, x]) => inner + JSON.stringify(k) + ": " + compactJson(x, indent + 1)).join(",\n") + "\n" + pad + "}";
}

const dir = join(process.cwd(), "data/arcs");
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));
for (const file of files) {
  const arc = JSON.parse(readFileSync(file, "utf8")) as Arc;
  const prices = derivePrices(arc);
  for (const item of arc.items) {
    if (prices[item.id] === undefined) throw new Error(`${file}: item ${item.id} is not produced by any recipe`);
    item.base_price = prices[item.id];
  }
  arc.citizens.start_population = START_POPULATION;
  arc.genesis.coin_per_business = GENESIS_COIN_PER_BUSINESS;
  arc.genesis.coin_citizens = GENESIS_COIN_CITIZENS;
  writeFileSync(file, compactJson(arc) + "\n");
  console.log(`${file}: ${arc.items.map((i) => `${i.id}=${i.base_price}`).join(" ")}`);
}
