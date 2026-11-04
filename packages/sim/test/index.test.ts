import test from "node:test";
import assert from "node:assert/strict";
import * as sim from "../src/index.ts";

test("index.ts re-exports canonicalJson, hashing, prng, types, and parseArc", () => {
  assert.equal(typeof sim.canonicalJson, "function");
  assert.equal(typeof sim.leaf, "function");
  assert.equal(typeof sim.node, "function");
  assert.equal(typeof sim.toHex, "function");
  assert.equal(typeof sim.fromHex, "function");
  assert.equal(typeof sim.Pcg32, "function");
  assert.equal(typeof sim.seedStep, "function");
  assert.equal(typeof sim.parseArc, "function");
});
