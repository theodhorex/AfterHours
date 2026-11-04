import { explainPrice, type PriceExplanation } from "../lib/explain.ts";

export interface Business {
  id: string;
  name: string;
  recipe: string;
  open: boolean;
  coin: number;
  inventory: Record<string, number>;
  insolvent_steps: number;
}

export interface Sector {
  idx: number;
  kind: "food" | "ore" | "forge" | "alchemy" | "harbor" | "tower";
  name: string;
  description: string;
  businesses: Business[];
}

export interface Citizens {
  population: number;
  satisfaction_bps: number; // e.g. 7800 = 78%
  purse: number;
}

export interface MarketItem {
  id: string;
  name: string;
  tier: "staple" | "raw" | "refined" | "luxury";
  base_price: number;
  price: number;
  stock: number;
  target: number;
  dem_ema: number;
  dem_ref: number;
  change: "up" | "down" | "flat";
  tooltip?: string;
  explanation: PriceExplanation;
}

export interface ChronicleEvent {
  id: string;
  step: number;
  year: number;
  season: "Spring" | "Summer" | "Autumn" | "Winter";
  title: string;
  description: string;
  kind: "raid" | "drought" | "bloom" | "plague" | "business" | "stage" | "civic";
}

export interface MockCity {
  city_id: string;
  name: string;
  arc_id: string;
  server: string;
  step: number;
  year: number;
  season: "Spring" | "Summer" | "Autumn" | "Winter";
  stage_id: string;
  stage_name: string;
  treasury: number;
  citizens: Citizens;
  sectors: Sector[];
  market: MarketItem[];
  chronicle: ChronicleEvent[];
}

const RAW_MARKET_INPUTS = [
  { id: "grain", name: "Cave Grain", tier: "staple" as const, base_price: 8, stock: 320, target: 280, dem_ema: 48, dem_ref: 50 },
  { id: "flour", name: "Stone Flour", tier: "staple" as const, base_price: 14, stock: 110, target: 140, dem_ema: 55, dem_ref: 50 },
  { id: "bread", name: "Cinder Bread", tier: "staple" as const, base_price: 12, stock: 75, target: 160, dem_ema: 65, dem_ref: 50 },
  { id: "fish", name: "Blind Fish", tier: "staple" as const, base_price: 11, stock: 190, target: 150, dem_ema: 45, dem_ref: 50 },
  { id: "ore", name: "Crude Ore", tier: "raw" as const, base_price: 10, stock: 240, target: 200, dem_ema: 48, dem_ref: 50 },
  { id: "ingot", name: "Scrap Ingot", tier: "refined" as const, base_price: 22, stock: 65, target: 90, dem_ema: 58, dem_ref: 50 },
  { id: "tool", name: "Warren Pick", tier: "luxury" as const, base_price: 45, stock: 32, target: 40, dem_ema: 52, dem_ref: 50 },
  { id: "crystal", name: "Glimmer Shard", tier: "raw" as const, base_price: 30, stock: 18, target: 60, dem_ema: 70, dem_ref: 50 },
  { id: "elixir", name: "Bile Tonic", tier: "luxury" as const, base_price: 70, stock: 14, target: 35, dem_ema: 62, dem_ref: 50 },
  { id: "scroll", name: "Shadow Script", tier: "luxury" as const, base_price: 60, stock: 45, target: 30, dem_ema: 40, dem_ref: 50 },
  { id: "scrap", name: "Rusted Bits", tier: "raw" as const, base_price: 6, stock: 420, target: 200, dem_ema: 42, dem_ref: 50 },
  { id: "gadget", name: "Clockwork Gizmo", tier: "luxury" as const, base_price: 90, stock: 8, target: 25, dem_ema: 68, dem_ref: 50 },
];

export const MOCK_CITY: MockCity = {
  city_id: "goblin_warrens_alpha",
  name: "Goblin Warrens",
  arc_id: "goblin_warrens",
  server: "eldmark",
  step: 480,
  year: 120,
  season: "Spring",
  stage_id: "village",
  stage_name: "Village",
  treasury: 14250,
  citizens: { population: 840, satisfaction_bps: 7800, purse: 4820 },
  sectors: [
    {
      idx: 0,
      kind: "food",
      name: "Mushroom Farms",
      description: "Damp cavern galleries cultivating giant caps, edible lichen, and grain beds.",
      businesses: [
        { id: "b_farm", name: "Spore Spindle Farm", recipe: "farm", open: true, coin: 480, inventory: { grain: 65 }, insolvent_steps: 0 },
        { id: "b_mill", name: "Grumble Grist Mill", recipe: "mill", open: true, coin: 240, inventory: { grain: 12, flour: 28 }, insolvent_steps: 0 },
        { id: "b_bake", name: "Cinder Loaf Bakery", recipe: "bakery", open: true, coin: 510, inventory: { flour: 6, bread: 42 }, insolvent_steps: 0 },
      ],
    },
    {
      idx: 1,
      kind: "ore",
      name: "Deep Mines",
      description: "Labyrinthine extraction shafts probing mineral fissures and crystal veins.",
      businesses: [
        { id: "b_mine", name: "Blackvein Shafts", recipe: "mine", open: true, coin: 620, inventory: { ore: 95 }, insolvent_steps: 0 },
        { id: "b_crys", name: "Glimmer Crevasse", recipe: "crystal_mine", open: false, coin: -45, inventory: { crystal: 0 }, insolvent_steps: 2 },
      ],
    },
    {
      idx: 2,
      kind: "forge",
      name: "Scrap Forges",
      description: "Billowing subterranean smithies converting slag and battlefield scrap into blades.",
      businesses: [
        { id: "b_smelt", name: "Rustfang Foundry", recipe: "smelter", open: true, coin: 380, inventory: { ore: 8, ingot: 34 }, insolvent_steps: 0 },
        { id: "b_smith", name: "Clankers Ironworks", recipe: "smith", open: true, coin: 710, inventory: { ingot: 14, scrap: 22, tool: 18 }, insolvent_steps: 0 },
        { id: "b_scrap", name: "Warren Salvage Yard", recipe: "scrapper", open: true, coin: 195, inventory: { scrap: 80 }, insolvent_steps: 0 },
      ],
    },
    {
      idx: 3,
      kind: "alchemy",
      name: "Bubbling Vats",
      description: "Pungent alembics and alchemical boilers brewing tonics and explosive curios.",
      businesses: [
        { id: "b_brew", name: "Bile & Brimstone Brewery", recipe: "alchemist", open: true, coin: 430, inventory: { crystal: 4, grain: 20, elixir: 12 }, insolvent_steps: 0 },
        { id: "b_tink", name: "Sprocket Gimmicks", recipe: "tinker", open: false, coin: -110, inventory: { scrap: 5, gadget: 1 }, insolvent_steps: 4 },
      ],
    },
    {
      idx: 4,
      kind: "harbor",
      name: "Sump Docks",
      description: "Moist subterranean docks handling blindfish catches and black-water rafts.",
      businesses: [
        { id: "b_fish", name: "Blind Eel Fisheries", recipe: "fisher", open: true, coin: 350, inventory: { fish: 75 }, insolvent_steps: 0 },
        { id: "b_trap", name: "Deep Basin Trappers", recipe: "fisher", open: true, coin: 290, inventory: { fish: 40 }, insolvent_steps: 0 },
      ],
    },
    {
      idx: 5,
      kind: "tower",
      name: "Shaman Towers",
      description: "Obsidian spires carved into stalactites where runic seers inscribe ancestral wisdom.",
      businesses: [
        { id: "b_scri", name: "Ash Vellum Scriptorium", recipe: "scribe", open: true, coin: 540, inventory: { crystal: 7, scroll: 24 }, insolvent_steps: 0 },
        { id: "b_void", name: "Void Echo Hermitage", recipe: "scribe", open: false, coin: -20, inventory: { scroll: 2 }, insolvent_steps: 1 },
      ],
    },
  ],
  market: RAW_MARKET_INPUTS.map((item) => {
    const explanation = explainPrice(item);
    let change: "up" | "down" | "flat" = "flat";
    if (explanation.price > item.base_price) change = "up";
    else if (explanation.price < item.base_price) change = "down";
    return {
      id: item.id,
      name: item.name,
      tier: item.tier,
      base_price: item.base_price,
      price: explanation.price,
      stock: item.stock,
      target: item.target,
      dem_ema: explanation.dem_ema,
      dem_ref: explanation.dem_ref,
      change,
      explanation,
    };
  }),
  chronicle: [
    { id: "ev_12", step: 480, year: 120, season: "Spring", title: "Spring Thaw Granary Audit", description: "Council decree replenished communal emergency reserves as winter frost yielded to cave dew.", kind: "civic" },
    { id: "ev_11", step: 478, year: 119, season: "Autumn", title: "Mushroom Bloom Across Lower Gallery", description: "Warm geothermal vents triggered bumper harvest of spore clusters in Mushroom Farms.", kind: "bloom" },
    { id: "ev_10", step: 475, year: 118, season: "Winter", title: "Black Rot Plague on Fungus Beds", description: "Blight threatened bread production; ration tokens distributed to miners.", kind: "plague" },
    { id: "ev_09", step: 471, year: 117, season: "Autumn", title: "Glimmer Crevasse Declares Insolvency", description: "Toxic gas pockets forced temporary closure and suspension of crystal mining wages.", kind: "business" },
    { id: "ev_08", step: 466, year: 116, season: "Summer", title: "Advancement to Village Settlement", description: "Permanent population passed 500 burrows; third business permits unlocked per sector.", kind: "stage" },
    { id: "ev_07", step: 460, year: 115, season: "Spring", title: "Dragon Raid Harries Sump Docks", description: "Surface predator swept lower docks, destroying fish traps and scaring harbor trade.", kind: "raid" },
    { id: "ev_06", step: 452, year: 113, season: "Winter", title: "Mana Drought in Shaman Spires", description: "Ether currents dropped 60%; ink binding spells struggled to set on parchment.", kind: "drought" },
    { id: "ev_05", step: 445, year: 111, season: "Summer", title: "Cinder Loaf Bakery Commences Production", description: "Master Baker Snaggle fired up obsidian ovens, doubling village staple bread supplies.", kind: "business" },
    { id: "ev_04", step: 438, year: 109, season: "Autumn", title: "Foundry Guild Scrap Compact", description: "Smithies aligned ingot pricing formulas to reduce scrap shortages.", kind: "civic" },
    { id: "ev_03", step: 426, year: 106, season: "Summer", title: "Underground Canal Flooding", description: "Surge waters blocked trade rafts; emergency drainage ditches dug through scrap wards.", kind: "civic" },
    { id: "ev_02", step: 412, year: 103, season: "Spring", title: "Rich Copper Seam Uncovered", description: "Deep Mines breached virgin ore pocket, sparking influx of hopeful prospectors.", kind: "civic" },
    { id: "ev_01", step: 400, year: 100, season: "Spring", title: "Centennial Warren Jubilee", description: "Citizens gathered in the central pit to commemorate one century of continuous settlement.", kind: "civic" },
  ],
};
