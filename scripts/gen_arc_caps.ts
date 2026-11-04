/**
 * Generator for arc_caps.json and checkpoint_sample.json fixtures.
 * Usage: node scripts/gen_arc_caps.ts [--check]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../packages/sim/src/arc.ts";
import { arcCaps, type ArcCapsResult } from "../packages/sim/src/checkpoint.ts";

const root = process.cwd();
const isCheck = process.argv.includes("--check");

function sortKeys<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys) as unknown as T;
  } else if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }
  return obj;
}

export function generateArcCapsJson(): string {
  const arcFiles = readdirSync(join(root, "data/arcs"))
    .filter((f) => f.endsWith(".json"))
    .sort();

  const arcsObj: Record<string, ArcCapsResult> = {};
  for (const file of arcFiles) {
    const raw = JSON.parse(readFileSync(join(root, "data/arcs", file), "utf-8"));
    const arc = parseArc(raw);
    arcsObj[arc.id] = arcCaps(arc);
  }

  const payload = { arcs: arcsObj };
  return JSON.stringify(sortKeys(payload), null, 2) + "\n";
}

export function generateCheckpointSampleJson(): string {
  const demoPath = join(root, "demo/checkpoints.json");
  const cps = JSON.parse(readFileSync(demoPath, "utf-8"));
  const sample = cps[0];
  return JSON.stringify(sortKeys(sample), null, 2) + "\n";
}

function main() {
  const arcCapsExpected = generateArcCapsJson();
  const sampleExpected = generateCheckpointSampleJson();

  const arcCapsPath = join(root, "data/fixtures/arc_caps.json");
  const samplePath = join(root, "data/fixtures/checkpoint_sample.json");

  if (isCheck) {
    if (!existsSync(arcCapsPath) || !existsSync(samplePath)) {
      console.error("Fixture files do not exist on disk.");
      process.exit(1);
    }
    const arcCapsActual = readFileSync(arcCapsPath, "utf-8");
    const sampleActual = readFileSync(samplePath, "utf-8");

    if (arcCapsActual !== arcCapsExpected) {
      console.error("data/fixtures/arc_caps.json is out of date.");
      process.exit(1);
    }
    if (sampleActual !== sampleExpected) {
      console.error("data/fixtures/checkpoint_sample.json is out of date.");
      process.exit(1);
    }
    console.log("Check passed: fixtures are up to date.");
    process.exit(0);
  }

  writeFileSync(arcCapsPath, arcCapsExpected, "utf-8");
  writeFileSync(samplePath, sampleExpected, "utf-8");
  console.log("Successfully generated data/fixtures/arc_caps.json and checkpoint_sample.json");
}

main();
