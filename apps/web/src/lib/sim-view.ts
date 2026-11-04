/**
 * Pure view model mapper converting simulation domain state to UI view models.
 * Zero Next/React dependencies, pure functions, fully deterministic.
 */

import { stepToSeason } from "./format.ts";
import { explainPrice, explainText, type PricingRules } from "../../../../packages/sim/src/pricing.ts";
import type { ArcFile, CityState, SimEvent } from "../../../../packages/sim/src/types.ts";
import type { PriceExplanation } from "./explain.ts";
import type { Business, Sector, Citizens, MarketItem, ChronicleEvent, MockCity } from "../data/mock-city.ts";

export type CityView = MockCity & {
  stateRoot: string;
};

/**
 * Converts identifier with underscores or hyphens into readable Title Case.
 * Example: 'crystal_mine' -> 'Crystal Mine'
 */
export function toTitleCase(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

const ITEM_NAMES: Record<string, string> = {
  grain: "Cave Grain", flour: "Stone Flour", bread: "Cinder Bread",
  fish: "Blind Fish", ore: "Crude Ore", ingot: "Scrap Ingot",
  tool: "Warren Pick", crystal: "Glimmer Shard", elixir: "Bile Tonic",
  scroll: "Shadow Script", scrap: "Rusted Bits", gadget: "Clockwork Gizmo",
  hide: "Beast Hide", totem: "Runic Totem",
};

const SECTOR_DESCRIPTIONS: Record<string, string> = {
  food: "Damp cavern galleries cultivating giant caps, edible lichen, and grain beds.",
  ore: "Labyrinthine extraction shafts probing mineral fissures and crystal veins.",
  forge: "Billowing subterranean smithies converting slag and raw ore into blades.",
  alchemy: "Pungent alembics and alchemical boilers brewing tonics and essential compounds.",
  harbor: "Moist subterranean docks handling blindfish catches and black-water rafts.",
  tower: "Obsidian spires carved into stalactites where runic seers maintain wards.",
};

const RECIPE_NAMES: Record<string, string> = {
  farm: "Farm",
  mill: "Mill",
  bakery: "Bakery",
  mine: "Mine",
  crystal_mine: "Crystal Quarry",
  smelter: "Smelter",
  smith: "Smith",
  scrapper: "Scrap Yard",
  alchemist: "Alchemy Vat",
  tinker: "Tinker Shop",
  fisher: "Fishery",
  scribe: "Scriptorium",
  tanner: "Tannery",
  carver: "Carver",
};

/**
 * Computes trend sign based on current and previous price.
 */
export function calculateItemTrend(
  currentPrice: bigint,
  previousPrice?: bigint
): "up" | "down" | "flat" {
  if (previousPrice === undefined) return "flat";
  if (currentPrice > previousPrice) return "up";
  if (currentPrice < previousPrice) return "down";
  return "flat";
}

/**
 * Converts raw simulation events into ordered chronicle entries.
 */
export function eventsToChronicle(events: SimEvent[]): ChronicleEvent[] {
  const result: ChronicleEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const step = typeof ev.step === "number" ? ev.step : 0;
    const { year, season } = stepToSeason(step);
    const id = `ev_${step}_${i}`;

    switch (ev.event) {
      case "business_closed":
        result.push({
          id,
          step,
          year,
          season,
          title: `Establishment Closed: ${String(ev.business_id ?? "Stall")}`,
          description: `Business ${String(ev.business_id ?? "")} suspended operations due to coin insolvency.`,
          kind: "business",
        });
        break;
      case "business_opened":
        result.push({
          id,
          step,
          year,
          season,
          title: `New Establishment Opened: ${String(ev.business_id ?? "Stall")}`,
          description: `A new commercial enterprise has begun operations in the district.`,
          kind: "business",
        });
        break;
      case "stage_up":
        result.push({
          id,
          step,
          year,
          season,
          title: `Advancement to Stage ${String(ev.stage ?? "")}`,
          description: `The settlement reached stage ${String(ev.stage ?? "")}, expanding municipal capacity.`,
          kind: "stage",
        });
        break;
      case "population_change": {
        const delta = Number(ev.delta ?? 0);
        result.push({
          id,
          step,
          year,
          season,
          title: `Demographic Shift: ${delta >= 0 ? "+" : ""}${delta}`,
          description: `Settlement population reached ${String(ev.new_population ?? "")} citizens.`,
          kind: "civic",
        });
        break;
      }
      case "step_end": {
        const rootSnippet = typeof ev.city_root === "string" ? ev.city_root.slice(0, 12) : "";
        result.push({
          id,
          step,
          year,
          season,
          title: `Season Cycle Concluded (Step ${step})`,
          description: `State verification audit finalized. City root digest: ${rootSnippet}...`,
          kind: "civic",
        });
        break;
      }
      case "raid":
        result.push({
          id,
          step,
          year,
          season,
          title: "Surface Raider Incursion",
          description: typeof ev.description === "string" ? ev.description : "Hostile raiders harassed outer perimeters.",
          kind: "raid",
        });
        break;
      case "drought":
        result.push({
          id,
          step,
          year,
          season,
          title: "Resource Drought",
          description: typeof ev.description === "string" ? ev.description : "Failing subterranean reservoirs reduced production.",
          kind: "drought",
        });
        break;
      case "bloom":
        result.push({
          id,
          step,
          year,
          season,
          title: "Fungal Spore Bloom",
          description: typeof ev.description === "string" ? ev.description : "Geothermal warmth triggered rapid agricultural growth.",
          kind: "bloom",
        });
        break;
      case "plague":
        result.push({
          id,
          step,
          year,
          season,
          title: "Spore Blight Plague",
          description: typeof ev.description === "string" ? ev.description : "Toxic blights hindered farming and trade.",
          kind: "plague",
        });
        break;
      default:
        break;
    }
  }

  // Sort newest step first
  return result.sort((a, b) => b.step - a.step);
}

export interface StateToViewOptions {
  stateRoot?: string;
  events?: SimEvent[];
  prevPrices?: Record<string, bigint>;
}

/**
 * Pure mapping function converting CityState + ArcFile + PricingRules into UI view model.
 */
export function stateToCityView(
  state: CityState,
  arc: ArcFile,
  pricing: PricingRules,
  options: StateToViewOptions = {}
): CityView {
  const { year, season } = stepToSeason(state.step);

  const stageDef = arc.stages[state.stage] ?? arc.stages[0];
  const stageId = stageDef ? stageDef.id : `stage_${state.stage}`;
  const stageName = stageId.charAt(0).toUpperCase() + stageId.slice(1);

  // 1. Map Sectors
  const sectors: Sector[] = state.sectors.map((sec, idx) => {
    const arcSector = arc.sectors.find((s) => s.idx === idx) ?? arc.sectors[idx];
    const kind = (arcSector?.kind ?? sec.kind) as Sector["kind"];
    const name = arcSector?.name ?? toTitleCase(kind);
    const description =
      arc.id === "goblin_warrens" && SECTOR_DESCRIPTIONS[kind]
        ? SECTOR_DESCRIPTIONS[kind]
        : `${name} district specializing in ${kind} production and trade.`;

    const businesses: Business[] = sec.businesses.map((b) => {
      const recipeLabel =
        (arc.id === "goblin_warrens" ? RECIPE_NAMES[b.recipe] : undefined) ??
        toTitleCase(b.recipe);
      const num = b.id.includes("-") ? b.id.split("-")[1] : b.id;
      const bizName = `${recipeLabel} #${num}`;

      const inv: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.inventory)) {
        inv[k] = Number(v);
      }

      return {
        id: b.id,
        name: bizName,
        recipe: b.recipe,
        open: b.open,
        coin: Number(b.coin),
        inventory: inv,
        insolvent_steps: b.insolvent_steps,
      };
    });

    return {
      idx,
      kind,
      name,
      description,
      businesses,
    };
  });

  // 2. Map Market Items
  const market: (MarketItem & { tooltip: string })[] = arc.items.map((itemDef) => {
    const itemId = itemDef.id;
    const base = itemDef.base_price;
    const stock = state.totals.items[itemId] ?? 0n;
    const dem_ema = state.market.demand_ema[itemId] ?? 0n;
    const price = state.market.price[itemId] ?? base;

    const reason = explainPrice({
      item: itemId,
      base,
      stock,
      dem_ema,
      pricing,
    });

    const tooltip = explainText(reason, pricing);
    const prevPrice = options.prevPrices ? options.prevPrices[itemId] : undefined;
    const change = calculateItemTrend(price, prevPrice);

    const explanation: PriceExplanation = {
      item: itemId,
      price: Number(price),
      base: Number(base),
      stock: Number(stock),
      target: Number(reason.target),
      dem_ema: Number(dem_ema),
      dem_ref: Number(reason.dem_ref),
      stock_effect_bps: Number(reason.stock_effect_bps),
      demand_effect_bps: Number(reason.demand_effect_bps),
      clamp: reason.clamped === "floor" ? "floor" : reason.clamped === "cap" ? "cap" : "none",
    };

    const friendlyName =
      (arc.id === "goblin_warrens" ? ITEM_NAMES[itemId] : undefined) ??
      toTitleCase(itemId);
    const tier = (itemDef.tier as MarketItem["tier"]) ?? "staple";

    return {
      id: itemId,
      name: friendlyName,
      tier,
      base_price: Number(base),
      price: Number(price),
      stock: Number(stock),
      target: Number(reason.target),
      dem_ema: Number(dem_ema),
      dem_ref: Number(reason.dem_ref),
      change,
      tooltip,
      explanation,
    };
  });

  // 3. Map Citizens
  const citizens: Citizens = {
    population: Number(state.citizens.population),
    satisfaction_bps: Number(state.citizens.satisfaction_bps),
    purse: Number(state.citizens.purse),
  };

  // 4. Map Chronicle
  const chronicle = eventsToChronicle(options.events ?? []);

  return {
    city_id: state.city_id,
    name: arc.name,
    arc_id: arc.id,
    server: arc.server,
    step: state.step,
    year,
    season,
    stage_id: stageId,
    stage_name: stageName,
    treasury: Number(state.treasury),
    stateRoot: options.stateRoot ?? "",
    citizens,
    sectors,
    market,
    chronicle,
  };
}
