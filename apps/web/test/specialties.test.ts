import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSpecialties,
  getAllWorldProfiles,
  getUniqueGoods,
  SHARED_GOODS,
} from "../src/lib/specialties.ts";

describe("world specialties", () => {
  const ARC_IDS = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"] as const;

  it("identifies exactly the 10 goods shared by all four worlds", () => {
    assert.equal(SHARED_GOODS.length, 10);
    const expected = [
      "bread",
      "crystal",
      "elixir",
      "fish",
      "flour",
      "grain",
      "ingot",
      "ore",
      "scroll",
      "tool",
    ].sort();
    assert.deepEqual([...SHARED_GOODS].sort(), expected);
  });

  it("matches unique goods from arc json definitions", () => {
    const goblinUnique = getUniqueGoods("goblin_warrens").map((g) => g.id).sort();
    assert.deepEqual(goblinUnique, ["gadget", "scrap"]);

    const caveUnique = getUniqueGoods("cave_hold").map((g) => g.id).sort();
    assert.deepEqual(caveUnique, ["hide", "totem"]);

    const dinoUnique = getUniqueGoods("dino_vale").map((g) => g.id).sort();
    assert.deepEqual(dinoUnique, ["amber", "fossil"]);

    const elfUnique = getUniqueGoods("elf_grove").map((g) => g.id).sort();
    assert.deepEqual(elfUnique, ["silverleaf", "stave"]);
  });

  it("produces deterministic WorldProfiles for all 4 arcs", () => {
    const all = getAllWorldProfiles();
    for (const arcId of ARC_IDS) {
      const p1 = getSpecialties(arcId);
      const p2 = getSpecialties(arcId);
      assert.deepEqual(p1, p2, `Determinism failure on ${arcId}`);
      assert.deepEqual(p1, all[arcId]);

      assert.equal(p1.arcId, arcId);
      assert.ok(p1.name.length > 0);
      assert.ok(p1.signatureGoods.length >= 1 && p1.signatureGoods.length <= 2);
      assert.ok(p1.strongAt.length >= 1 && p1.strongAt.length <= 3);
      assert.ok(p1.weakAt.length >= 1 && p1.weakAt.length <= 3);

      for (const item of p1.strongAt) {
        assert.ok(item.id);
        assert.ok(item.name);
        assert.ok(item.reason.length > 0);
      }
      for (const item of p1.weakAt) {
        assert.ok(item.id);
        assert.ok(item.name);
        assert.ok(item.reason.length > 0);
      }
    }
  });

  it("properly flags domain strengths and weaknesses based on production economics", () => {
    const dino = getSpecialties("dino_vale");
    const dinoStrongIds = dino.strongAt.map((s) => s.id);
    assert.ok(
      dinoStrongIds.includes("bread") || dinoStrongIds.includes("fish") || dinoStrongIds.includes("grain"),
      "Dino Vale should be strong in agriculture/food"
    );

    const elf = getSpecialties("elf_grove");
    const elfStrongIds = elf.strongAt.map((s) => s.id);
    assert.ok(
      elfStrongIds.includes("crystal") || elfStrongIds.includes("elixir") || elfStrongIds.includes("scroll"),
      "Elf Grove should be strong in arcane/elixirs"
    );
    const elfWeakIds = elf.weakAt.map((s) => s.id);
    assert.ok(
      elfWeakIds.includes("fish") || elfWeakIds.includes("bread") || elfWeakIds.includes("ore"),
      "Elf Grove should be weak at food/raw ore"
    );

    const cave = getSpecialties("cave_hold");
    const caveStrongIds = cave.strongAt.map((s) => s.id);
    assert.ok(
      caveStrongIds.includes("ore") || caveStrongIds.includes("ingot") || caveStrongIds.includes("tool"),
      "Cave Hold should be strong at mining and smelting"
    );
  });
});
