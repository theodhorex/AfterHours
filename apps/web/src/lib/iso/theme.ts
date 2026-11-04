/**
 * Pure theme token generator and color manipulation helpers.
 * Defines arc and season-specific palettes, building/tree/road styles, weather,
 * and ambient lighting for pixel-sharp rendering.
 * Pure functions only — zero sim mutation imports, fully deterministic.
 */

import type { ArcPalette } from "./sprites-ground.ts";

export const SEASON_NAMES = ["spring", "summer", "autumn", "winter"] as const;
export type SeasonName = (typeof SEASON_NAMES)[number];

export type RoadStyle = "dirt" | "cobble" | "root_path" | "flagstone" | "mine_rails";
export type TreeStyle = "mushroom" | "crystal" | "fern" | "great_tree";
export type WeatherType =
  | "rain"
  | "fog"
  | "falling_leaves"
  | "snow"
  | "fireflies"
  | "embers"
  | "dust"
  | "none";

export interface GroundColors {
  grass: number;
  grassDark: number;
  dirt: number;
  rock: number;
  water: number;
  waterDeep: number;
  waterFoam: number;
  sand: number;
  forest: number;
  road: number;
  roadCurb: number;
  bridge: number;
  accent: number;
}

export interface BuildingColors {
  wall: number;
  wallDark: number;
  roof: number;
  roofDark: number;
  accent: number;
  trim: number;
  windowLit: number;
  windowDark: number;
  chimneySmoke: number;
}

export interface ThemeTokens extends ArcPalette {
  arcId: string;
  seasonIndex: number;
  seasonName: SeasonName;
  ground: GroundColors;
  building: BuildingColors;
  roadStyle: RoadStyle;
  treeStyle: TreeStyle;
  props: string[];
  weather: WeatherType;
  ambientTint: number;
  windowGlowLevel: number;
  smokeThickness: number;
  isFrozenWater: boolean;
  hasSnowCaps: boolean;
}

/**
 * Adjusts color brightness deterministically by a factor.
 * factor > 1.0 lightens, factor < 1.0 darkens, factor === 0 returns black.
 * Clamps RGB channels strictly to [0, 255].
 */
export function shade(hex: number, factor: number): number;
export function shade(hex: string, factor: number): string;
export function shade(hex: number | string, factor: number): number | string {
  const isStr = typeof hex === "string";
  const num = isStr ? parseInt(hex.replace(/^#|^0x/, ""), 16) : hex;
  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((num & 0xff) * factor)));
  const res = (r << 16) | (g << 8) | b;
  return isStr ? `#${res.toString(16).padStart(6, "0")}` : res;
}

/**
 * Computes a crisp 1px dark outline color (darker shade of the fill).
 */
export function outlineColor(hex: number): number;
export function outlineColor(hex: string): string;
export function outlineColor(hex: number | string): number | string {
  if (typeof hex === "string") {
    return shade(hex, 0.42);
  }
  return shade(hex, 0.42);
}

/**
 * Calculates standard WCAG relative luminance for a 24-bit RGB hex color.
 * Result in [0.0, 1.0].
 */
export function relativeLuminance(hex: number): number {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

interface ArcBaseConfig {
  roadStyle: RoadStyle;
  treeStyle: TreeStyle;
  props: string[];
  basePrimary: number;
  baseSecondary: number;
  baseTrim: number;
  baseAccent: number;
  baseGrass: number;
  baseRock: number;
  baseWater: number;
  baseSand: number;
  baseSmoke: number;
  windowLit: number;
}

const ARC_CONFIGS: Record<string, ArcBaseConfig> = {
  goblin_warrens: {
    roadStyle: "root_path",
    treeStyle: "mushroom",
    props: ["giant_mushrooms", "lanterns", "purple_smoke", "moss_tufts", "spore_vats"],
    basePrimary: 0x6b4f7a, // Rich purple timber
    baseSecondary: 0x4d335c,
    baseTrim: 0x301d3b,
    baseAccent: 0xfbbf24, // Torch amber
    baseGrass: 0x7ea360, // Cheerful mossy purple-green
    baseRock: 0xa594ba, // Lighter lilac stone
    baseWater: 0x3daee3, // Bright subterranean water
    baseSand: 0xc4b4d6, // Light lilac silt
    baseSmoke: 0xc084fc, // Lively purple chimney smoke
    windowLit: 0xfcd34d,
  },
  cave_hold: {
    roadStyle: "mine_rails",
    treeStyle: "crystal",
    props: ["ore_carts", "mine_entrances", "crystals", "mine_rails", "forge_sparks"],
    basePrimary: 0x475b70, // Slate-blue masonry
    baseSecondary: 0x334455,
    baseTrim: 0x212d38,
    baseAccent: 0xf97316, // Lava orange
    baseGrass: 0xb8a28c, // Warm cavern gravel & stone dust
    baseRock: 0x889eb2, // Slate-blue bedrock
    baseWater: 0x38a0d0, // Bright underground river
    baseSand: 0xc8b296,
    baseSmoke: 0xfb923c, // Ember-tinted smoke
    windowLit: 0xfbbf24, // Warm lamp-lit forge windows
  },
  dino_vale: {
    roadStyle: "dirt",
    treeStyle: "fern",
    props: ["giant_ferns", "bone_fences", "eggs", "nests", "amber_shards"],
    basePrimary: 0x6b5c47, // Primitive thatch & heavy timber
    baseSecondary: 0x4d4130,
    baseTrim: 0x2e251a,
    baseAccent: 0xd94f38, // Red earth
    baseGrass: 0x68ac48, // Lush fern green
    baseRock: 0x9c9480, // Prehistoric limestone
    baseWater: 0x2ea898, // Rich jungle water
    baseSand: 0xd4c28c, // Sunlit ochre sand
    baseSmoke: 0xc8b49e,
    windowLit: 0xf59e0b,
  },
  elf_grove: {
    roadStyle: "root_path",
    treeStyle: "great_tree",
    props: ["great_trees", "big_trees", "houses_in_trunks", "leaf_huts", "flower_beds", "rope_bridges"],
    basePrimary: 0x3e5844, // Living bark & arched boughs
    baseSecondary: 0x2a3e30,
    baseTrim: 0x1a281e,
    baseAccent: 0xf472b6, // Cherry-blossom pink in spring, gold in autumn
    baseGrass: 0x48a855, // Emerald moss
    baseRock: 0x98a8a0, // Silver quartz
    baseWater: 0x3eaed4, // Moon-blue clear water
    baseSand: 0xb8c8b4,
    baseSmoke: 0xa8c4ba,
    windowLit: 0xfef08a,
  },
};

const WEATHER_BY_ARC_SEASON: Record<string, WeatherType[]> = {
  goblin_warrens: ["fog", "fireflies", "falling_leaves", "snow"],
  cave_hold: ["dust", "embers", "fog", "snow"],
  dino_vale: ["rain", "dust", "falling_leaves", "none"],
  elf_grove: ["fireflies", "fireflies", "falling_leaves", "snow"],
};

export function getTheme(arcId: string, seasonInput: number | string): ThemeTokens {
  const arc = ARC_CONFIGS[arcId] ?? ARC_CONFIGS.goblin_warrens;

  let seasonIdx = 0;
  if (typeof seasonInput === "string") {
    const s = seasonInput.toLowerCase().trim();
    const idx = SEASON_NAMES.indexOf(s as SeasonName);
    seasonIdx = idx >= 0 ? idx : 0;
  } else {
    seasonIdx = ((Math.floor(seasonInput) % 4) + 4) % 4;
  }
  const seasonName = SEASON_NAMES[seasonIdx];

  // Season shifts: pure daylight per season, fixed daytime, readable & cheerful
  const isWinter = seasonIdx === 3;
  const isAutumn = seasonIdx === 2;
  const isSummer = seasonIdx === 1;

  let grass = arc.baseGrass;
  let forest = shade(arc.baseGrass, 0.82);
  let water = arc.baseWater;
  let rock = arc.baseRock;
  let sand = arc.baseSand;
  let ambientTint = 0xfffef6; // Pure bright daytime spring tint
  let accent = arc.baseAccent;

  if (arcId === "elf_grove") {
    if (seasonIdx === 0) accent = 0xf472b6; // Cherry-blossom pink in spring
    else if (seasonIdx === 2) accent = 0xeab308; // Gold in autumn
    else if (seasonIdx === 1) accent = 0xc084fc; // Violet blossoms
    else accent = 0xc4b5fd; // Frost starlight
  }

  if (isSummer) {
    if (arcId === "cave_hold") {
      grass = 0xc4b29c;
      rock = 0x94aabf;
      water = 0x48aee0;
      ambientTint = 0xfff8ea;
    } else if (arcId === "dino_vale") {
      grass = 0x78b84e;
      sand = 0xdcc890;
      water = 0x32b4a4;
      ambientTint = 0xfffae4; // Mist-free bright sunny sky
    } else if (arcId === "elf_grove") {
      grass = 0x429e50;
      rock = 0xa4b8b0;
      water = 0x44b8dc;
      ambientTint = 0xfffef0;
    } else {
      grass = shade(arc.baseGrass, 1.08);
      forest = shade(arc.baseGrass, 0.95);
      water = shade(arc.baseWater, 1.05);
      rock = shade(arc.baseRock, 1.05);
      sand = shade(arc.baseSand, 1.05);
      ambientTint = 0xfffaea;
    }
  } else if (isAutumn) {
    if (arcId === "cave_hold") {
      grass = 0xb48b62; // Copper rust stone gravel
      rock = 0x8092a4;
      water = 0x3296c4;
      ambientTint = 0xfff2e0;
    } else if (arcId === "dino_vale") {
      grass = 0xb29a44; // Golden ochre savannah
      sand = 0xd0b880;
      water = 0x2ca090;
      ambientTint = 0xfff5e0;
    } else if (arcId === "elf_grove") {
      grass = 0x8ca838; // Golden moss
      rock = 0x9a9e88;
      water = 0x3aa4c8;
      ambientTint = 0xfff6e2; // Golden autumn light
    } else {
      grass = 0xb8883e;
      forest = 0x9a5828;
      ambientTint = 0xfff4e6;
    }
  } else if (isWinter) {
    if (arcId === "cave_hold") {
      grass = 0xbfc9d4; // Frost-dusted gravel
      rock = 0xc8d8e6; // Snow-capped peaks!
      water = 0x82b4cc;
      ambientTint = 0xf4f8fc;
    } else if (arcId === "dino_vale") {
      grass = 0x929e68; // Dry savannah
      rock = 0x989078;
      sand = 0xc8b47e;
      water = 0x309c96;
      ambientTint = 0xfff8ee; // Mist-free bright sky
    } else if (arcId === "elf_grove") {
      grass = 0x8ca89a; // Frost-dusted emerald moss
      rock = 0xb8c8c4;
      water = 0x8ec4dc;
      ambientTint = 0xf4f8fc;
    } else {
      grass = 0x9ca89e;
      forest = 0x7a8880;
      water = 0x8ec0d8;
      rock = 0xa0a8b0;
      ambientTint = 0xf4f8fc;
    }
  }

  const grassDark = shade(grass, 0.72);
  const waterDeep = shade(water, 0.72);
  const isFrozenWater = isWinter && arcId !== "dino_vale";
  const hasSnowCaps = isWinter && arcId !== "dino_vale";
  const waterFoam = isFrozenWater ? 0xd0e8f2 : shade(water, 1.4);
  const roadCurb = outlineColor(arc.basePrimary);
  const road = shade(arc.basePrimary, 1.25);
  const bridge = shade(arc.basePrimary, 1.1);

  const ground: GroundColors = {
    grass,
    grassDark,
    dirt: sand,
    rock,
    water,
    waterDeep,
    waterFoam,
    sand,
    forest,
    road,
    roadCurb,
    bridge,
    accent,
  };

  const building: BuildingColors = {
    wall: arc.basePrimary,
    wallDark: arc.baseSecondary,
    roof: arc.baseSecondary,
    roofDark: arc.baseTrim,
    accent,
    trim: arc.baseTrim,
    windowLit: arc.windowLit,
    windowDark: 0x1c1712,
    chimneySmoke: isWinter ? 0xdcd8d0 : arc.baseSmoke,
  };

  const weatherList = WEATHER_BY_ARC_SEASON[arcId] ?? WEATHER_BY_ARC_SEASON.goblin_warrens;
  const weather = weatherList[seasonIdx];

  const windowGlowLevel = isWinter ? 0.35 : isAutumn ? 0.3 : isSummer ? 0.18 : 0.22;
  const smokeThickness = isWinter ? 2.0 : isAutumn ? 1.2 : isSummer ? 0.8 : 1.0;

  return {
    arcId,
    seasonIndex: seasonIdx,
    seasonName,
    primary: arc.basePrimary,
    secondary: arc.baseSecondary,
    trim: arc.baseTrim,
    accent: arc.baseAccent,
    grass,
    grassDark,
    water,
    waterDeep,
    waterFoam,
    sand,
    rock,
    forest,
    road,
    roadCurb,
    bridge,
    ground,
    building,
    roadStyle: arc.roadStyle,
    treeStyle: arc.treeStyle,
    props: arc.props,
    weather,
    ambientTint,
    windowGlowLevel,
    smokeThickness,
    isFrozenWater,
    hasSnowCaps,
  };
}
