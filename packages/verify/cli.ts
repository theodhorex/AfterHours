#!/usr/bin/env node
/**
 * CLI interface for checkpoint replay and verification.
 * Usage: node packages/verify/cli.ts --arc <id> --seed <string> --city <id> --checkpoints <file.json>
 *        node packages/verify/cli.ts --rules-hash [--arc <id>]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyCheckpoints, computeRulesHash } from "./src/verify.ts";
import type { Checkpoint } from "../sim/src/checkpoint.ts";

function parseArgs(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        flags[key] = val;
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith("-")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    }
  }
  return flags;
}

function main(): void {
  const flags = parseArgs(process.argv.slice(2));

  if (flags["rules-hash"]) {
    const arcId = typeof flags.arc === "string" ? flags.arc : undefined;
    const hashes = computeRulesHash(arcId);
    console.log(`pricing:    ${hashes.pricing}`);
    console.log(`growth:     ${hashes.growth}`);
    if (hashes.arc) {
      console.log(`arc:        ${hashes.arc}`);
    }
    console.log(`rules_hash: ${hashes.combined}`);
    process.exit(0);
  }

  const arcId = flags.arc;
  const seed = flags.seed;
  const cityId = flags.city;
  const cpPath = flags.checkpoints;

  if (typeof arcId !== "string" || typeof seed !== "string" || typeof cityId !== "string" || typeof cpPath !== "string") {
    console.error("Usage: node packages/verify/cli.ts --arc <id> --seed <string> --city <id> --checkpoints <file.json>");
    console.error("       node packages/verify/cli.ts --rules-hash [--arc <id>]");
    process.exit(1);
  }

  let checkpoints: Checkpoint[];
  try {
    const raw = readFileSync(resolve(process.cwd(), cpPath), "utf-8");
    checkpoints = JSON.parse(raw);
  } catch (err) {
    console.error(`FAILED: unable to read checkpoints file ${cpPath}: ${(err as Error).message}`);
    process.exit(1);
  }

  const result = verifyCheckpoints({
    arcId,
    seed,
    cityId,
    checkpoints,
  });

  for (const line of result.lines) {
    console.log(line);
  }
  console.log(result.finalLine);

  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
