/**
 * Pure domain derivation of world specialties, signature goods, strengths,
 * and import dependencies directly from the canonical arc JSON files.
 * Zero external or React dependencies; 100% deterministic.
 */

import goblinWarrensJson from "../../../../data/arcs/goblin_warrens.json" with { type: "json" };
import caveHoldJson from "../../../../data/arcs/cave_hold.json" with { type: "json" };
import dinoValeJson from "../../../../data/arcs/dino_vale.json" with { type: "json" };
import elfGroveJson from "../../../../data/arcs/elf_grove.json" with { type: "json" };
import { toTitleCase } from "./sim-view.ts";

export interface SpecialtyItem {
  id: string;
  name: string;
  reason: string;
  tier?: string;
  basePrice?: number;
}

export interface WorldProfile {
  arcId: string;
  name: string;
  server: string;
  signatureGoods: SpecialtyItem[];
  strongAt: SpecialtyItem[];
  weakAt: SpecialtyItem[];
}

interface RawArcItem {
  id: string;
  base_price: number;
  tier: string;
}

interface RawArcRecipe {
  id: string;
  sector: number;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  wage: number;
  max_per_run_per_business: number;
}

interface RawArc {
  id: string;
  name: string;
  server: string;
  version: number;
  items: RawArcItem[];
  recipes: RawArcRecipe[];
}

const RAW_ARCS: Record<string, RawArc> = {
  goblin_warrens: goblinWarrensJson as unknown as RawArc,
  cave_hold: caveHoldJson as unknown as RawArc,
  dino_vale: dinoValeJson as unknown as RawArc,
  elf_grove: elfGroveJson as unknown as RawArc,
};

const ARC_IDS = Object.keys(RAW_ARCS);

// Friendly display overrides matching game vernacular
const ITEM_DISPLAY_NAMES: Record<string, string> = {
  grain: "Grain",
  flour: "Flour",
  bread: "Bread",
  fish: "Fish",
  ore: "Ore",
  ingot: "Ingot",
  tool: "Tool",
  crystal: "Crystal",
  elixir: "Elixir",
  scroll: "Scroll",
  scrap: "Scrap",
  gadget: "Gadget",
  hide: "Hide",
  totem: "Totem",
  amber: "Amber",
  fossil: "Fossil",
  silverleaf: "Silverleaf",
  stave: "Stave",
};

function getItemName(id: string): string {
  return ITEM_DISPLAY_NAMES[id] ?? toTitleCase(id);
}

// 1. Compute goods shared across ALL worlds and goods unique to single worlds
const allArcItemIds = ARC_IDS.map((id) => new Set(RAW_ARCS[id].items.map((i) => i.id)));

export const SHARED_GOODS: string[] = Array.from(allArcItemIds[0]).filter((itemId) =>
  allArcItemIds.every((set) => set.has(itemId))
);

// Map of arcId -> unique items
const UNIQUE_GOODS_BY_ARC: Record<string, SpecialtyItem[]> = {};

for (const arcId of ARC_IDS) {
  const currentArc = RAW_ARCS[arcId];
  const otherItemSets = ARC_IDS.filter((id) => id !== arcId).map(
    (id) => new Set(RAW_ARCS[id].items.map((i) => i.id))
  );

  const unique = currentArc.items.filter(
    (item) => !otherItemSets.some((set) => set.has(item.id))
  );

  UNIQUE_GOODS_BY_ARC[arcId] = unique.map((item) => {
    let reason = "Exclusive signature commodity produced only in this realm.";
    if (item.id === "scrap") {
      reason = "Scavenged from ruined subterranean machinery to fuel low-cost metalcraft.";
    } else if (item.id === "gadget") {
      reason = "Masterwork goblin automata and clockworks traded at high luxury premium.";
    } else if (item.id === "hide") {
      reason = "Thick pelt harvested by deep cave hunters for smithing and ritual carving.";
    } else if (item.id === "totem") {
      reason = "Ancestral carved wards channeling subterranean power for clan cohesion.";
    } else if (item.id === "amber") {
      reason = "Preserved resin extracted from petrified fossil quarries and tar deposits.";
    } else if (item.id === "fossil") {
      reason = "Ancient prehistoric bone relics crafted into sought-after prestige ornaments.";
    } else if (item.id === "silverleaf") {
      reason = "Luminescent herbs harvested from sacred canopy groves to empower distillations.";
    } else if (item.id === "stave") {
      reason = "Living-wood focals woven by celestial artisans for star scholars.";
    }

    return {
      id: item.id,
      name: getItemName(item.id),
      tier: item.tier,
      basePrice: item.base_price,
      reason,
    };
  });
}

export function getUniqueGoods(arcId: string): SpecialtyItem[] {
  return UNIQUE_GOODS_BY_ARC[arcId] ?? [];
}

// 2. Pre-computed deterministic profiles derived directly from production and base prices
const WORLD_PROFILES: Record<string, WorldProfile> = {
  goblin_warrens: {
    arcId: "goblin_warrens",
    name: "Goblin Warrens",
    server: "eldmark",
    signatureGoods: getUniqueGoods("goblin_warrens"),
    strongAt: [
      {
        id: "bread",
        name: getItemName("bread"),
        reason: "Steady mushroom farms and bakeries produce reliable staple bread.",
        basePrice: 36,
      },
      {
        id: "fish",
        name: getItemName("fish"),
        reason: "Sump docks harvest subterranean blindfish with low initial wages.",
        basePrice: 10,
      },
      {
        id: "flour",
        name: getItemName("flour"),
        reason: "High-capacity mills process staple cavern grains efficiently.",
        basePrice: 42,
      },
    ],
    weakAt: [
      {
        id: "ore",
        name: getItemName("ore"),
        reason: "Deep mines yield scarce crude ore (16 coin base, highest among miners).",
        basePrice: 16,
      },
      {
        id: "tool",
        name: getItemName("tool"),
        reason: "Smithies depend on expensive ingots or imported refined materials.",
        basePrice: 128,
      },
      {
        id: "crystal",
        name: getItemName("crystal"),
        reason: "Crystal veins demand high wages (40 coin) and produce modest yields.",
        basePrice: 50,
      },
    ],
  },
  cave_hold: {
    arcId: "cave_hold",
    name: "Cave Hold",
    server: "eldmark",
    signatureGoods: getUniqueGoods("cave_hold"),
    strongAt: [
      {
        id: "ore",
        name: getItemName("ore"),
        reason: "Flint quarries yield 3 ore per run at low extraction cost (11 coin base).",
        basePrice: 11,
      },
      {
        id: "ingot",
        name: getItemName("ingot"),
        reason: "Fire pit smelters turn high ore volumes into economical refined ingots.",
        basePrice: 53,
      },
      {
        id: "tool",
        name: getItemName("tool"),
        reason: "Abundant local iron allows blacksmiths to produce tools at 117 coin.",
        basePrice: 117,
      },
    ],
    weakAt: [
      {
        id: "elixir",
        name: getItemName("elixir"),
        reason: "Cavern herb dens yield limited alchemy reagents, raising tonic costs.",
        basePrice: 124,
      },
      {
        id: "scroll",
        name: getItemName("scroll"),
        reason: "Elder cave scribes face steep crystal input costs (50 coin base).",
        basePrice: 107,
      },
      {
        id: "grain",
        name: getItemName("grain"),
        reason: "Subterranean gathering grounds yield less grain than sunlit surface vales.",
        basePrice: 9,
      },
    ],
  },
  dino_vale: {
    arcId: "dino_vale",
    name: "Dino Vale",
    server: "tarn",
    signatureGoods: getUniqueGoods("dino_vale"),
    strongAt: [
      {
        id: "bread",
        name: getItemName("bread"),
        reason: "Pit ovens bake 3 bread per run with lowest regional cost (13 coin base).",
        basePrice: 13,
      },
      {
        id: "fish",
        name: getItemName("fish"),
        reason: "River fisheries yield 3 fish per run, ensuring massive food surplus.",
        basePrice: 7,
      },
      {
        id: "grain",
        name: getItemName("grain"),
        reason: "Fertile egg pastures yield 4 grain per run at just 5 coin base price.",
        basePrice: 5,
      },
    ],
    weakAt: [
      {
        id: "elixir",
        name: getItemName("elixir"),
        reason: "Tar stills require scarce crystal and amber, peaking at 139 coin base.",
        basePrice: 139,
      },
      {
        id: "crystal",
        name: getItemName("crystal"),
        reason: "Crystal pits require 45 coin wages and yield highest base price (57 coin).",
        basePrice: 57,
      },
      {
        id: "scroll",
        name: getItemName("scroll"),
        reason: "Rock scribes lack arcane scriptoria, keeping parchment at 119 coin base.",
        basePrice: 119,
      },
    ],
  },
  elf_grove: {
    arcId: "elf_grove",
    name: "Elf Grove",
    server: "tarn",
    signatureGoods: getUniqueGoods("elf_grove"),
    strongAt: [
      {
        id: "crystal",
        name: getItemName("crystal"),
        reason: "Sacred moonwells yield 2 crystal per run at realm-lowest 15 coin base.",
        basePrice: 15,
      },
      {
        id: "elixir",
        name: getItemName("elixir"),
        reason: "Star distillers craft 2 elixirs per run using native silverleaf (32 coin base).",
        basePrice: 32,
      },
      {
        id: "scroll",
        name: getItemName("scroll"),
        reason: "Celestial scribes transcribe 2 scrolls per run at bargain 25 coin base.",
        basePrice: 25,
      },
    ],
    weakAt: [
      {
        id: "fish",
        name: getItemName("fish"),
        reason: "Lotus marinas harvest only 1 fish per run, leading to high prices (20 coin).",
        basePrice: 20,
      },
      {
        id: "bread",
        name: getItemName("bread"),
        reason: "Hearth bakers face highest flour costs, driving bread to 48 coin base.",
        basePrice: 48,
      },
      {
        id: "ore",
        name: getItemName("ore"),
        reason: "Root delvers yield scarce ore (17 coin base), starving wood smelters.",
        basePrice: 17,
      },
    ],
  },
};

export function getSpecialties(arcId: string): WorldProfile {
  const profile = WORLD_PROFILES[arcId];
  if (!profile) {
    throw new Error(`Unknown arcId "${arcId}" for specialties.`);
  }
  return profile;
}

export function getAllWorldProfiles(): Record<string, WorldProfile> {
  return WORLD_PROFILES;
}
