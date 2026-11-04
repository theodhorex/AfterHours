/**
 * Node.js-only data loader for AfterHours multi-city simulation.
 * Reads arcs, pricing rules, and growth rules from disk.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "./arc.ts";
import { parsePricingRules } from "./pricing.ts";
import { parseGrowthRules } from "./growth.ts";
import type { ArcFile } from "./types.ts";
import type { PricingRules } from "./pricing.ts";
import type { GrowthRules } from "./growth.ts";

export interface WorldData {
  pricing: PricingRules;
  growth: GrowthRules;
  arcs: Record<string, ArcFile>;
}

export function loadWorldData(dataDir: string): WorldData {
  const pricing = parsePricingRules(readFileSync(join(dataDir, "pricing.rules.json"), "utf-8"));
  const growth = parseGrowthRules(JSON.parse(readFileSync(join(dataDir, "growth.rules.json"), "utf-8")));

  const arcs: Record<string, ArcFile> = {};
  const arcsDir = join(dataDir, "arcs");
  for (const file of readdirSync(arcsDir)) {
    if (file.endsWith(".json")) {
      const arcId = file.replace(/\.json$/, "");
      const raw = JSON.parse(readFileSync(join(arcsDir, file), "utf-8"));
      arcs[arcId] = parseArc(raw);
    }
  }

  return { pricing, growth, arcs };
}
