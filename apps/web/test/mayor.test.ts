import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAYORS,
  MAYOR_DECREES,
  getMayorByArc,
  getMayorDecree,
  type Mayor,
} from "../src/data/mayors.ts";

describe("Meme Mayor Data & Pure Logic (TDD)", () => {
  it("contains a mayor for all 4 arcs", () => {
    const requiredArcs = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"];
    for (const arcId of requiredArcs) {
      const mayor = getMayorByArc(arcId);
      assert.ok(mayor, `Missing mayor for arc ${arcId}`);
      assert.equal(mayor.id, arcId);
    }
  });

  it("data has no empty fields and meets all constraints", () => {
    const mayorsList: Mayor[] = Object.values(MAYORS);
    assert.equal(mayorsList.length, 4);

    for (const mayor of mayorsList) {
      assert.ok(mayor.id.trim().length > 0, `Mayor id empty: ${mayor.id}`);
      assert.ok(mayor.name.trim().length > 0, `Mayor name empty: ${mayor.name}`);
      assert.ok(mayor.title.trim().length > 0, `Mayor title empty: ${mayor.title}`);
      assert.ok(mayor.tagline.trim().length > 0, `Mayor tagline empty: ${mayor.tagline}`);
      assert.ok(
        typeof mayor.charisma === "number" &&
          mayor.charisma >= 0 &&
          mayor.charisma <= 100,
        `Mayor charisma must be 0..100, got ${mayor.charisma}`
      );
      assert.equal(
        mayor.catchphrases.length,
        3,
        `Mayor ${mayor.name} must have exactly 3 catchphrases`
      );
      for (const phrase of mayor.catchphrases) {
        assert.ok(phrase.trim().length > 0, `Empty catchphrase in ${mayor.name}`);
      }

      // Procedural portrait spec check
      assert.ok(mayor.portraitSpec, `Missing portrait spec for ${mayor.name}`);
      assert.ok(mayor.portraitSpec.palette.skin.startsWith("#"));
      assert.ok(mayor.portraitSpec.palette.accent.startsWith("#"));
      assert.ok(mayor.portraitSpec.palette.eyes.startsWith("#"));
      assert.ok(mayor.portraitSpec.palette.background.startsWith("#"));
    }
  });

  it("decree selection is purely deterministic with no RNG", () => {
    const mayor = getMayorByArc("goblin_warrens");
    assert.ok(mayor);

    // Repeated calls with same year yield identical decree
    const decreeYear0A = getMayorDecree(mayor, 0);
    const decreeYear0B = getMayorDecree(mayor, 0);
    assert.equal(decreeYear0A, decreeYear0B);

    const decreeYear42A = getMayorDecree(mayor, 42);
    const decreeYear42B = getMayorDecree(mayor, 42);
    assert.equal(decreeYear42A, decreeYear42B);

    // Verify it cycles through decrees predictably
    const decrees = MAYOR_DECREES["goblin_warrens"];
    assert.ok(decrees && decrees.length >= 3);
    for (let yr = 0; yr < decrees.length * 2; yr++) {
      assert.equal(getMayorDecree(mayor, yr), decrees[yr % decrees.length]);
    }

    // Handles negative or fractional years cleanly
    assert.equal(getMayorDecree(mayor, -4), getMayorDecree(mayor, 4));
    assert.equal(getMayorDecree(mayor, 2.7), getMayorDecree(mayor, 2));
  });
});
