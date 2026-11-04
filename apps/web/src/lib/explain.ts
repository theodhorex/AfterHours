/**
 * Pricing explanation and computation following docs/data-contract.md section 8
 * and data/pricing.rules.json.
 * Zero external or React dependencies for Node 26 compatibility.
 */

export interface ItemPricingInput {
  id: string;
  base_price: number;
  stock: number;
  target: number;
  dem_ema?: number;
  dem_ref?: number;
}

export type PriceClamp = "none" | "floor" | "cap";

export interface PriceExplanation {
  item: string;
  price: number;
  base: number;
  stock: number;
  target: number;
  dem_ema: number;
  dem_ref: number;
  stock_effect_bps: number;
  demand_effect_bps: number;
  clamp: PriceClamp;
}

const K_STOCK_BPS = 6000; // 60% sensitivity
const K_DEM_BPS = 3000;   // 30% sensitivity
const FLOOR_BPS = 3000;   // 30% of base
const CAP_BPS = 40000;    // 400% of base

/**
 * PURE function computing price and returning the structured explanation.
 * price = clamp(base * (10000 + stock_effect_bps + demand_effect_bps) / 10000, floor, cap)
 */
export function explainPrice(input: ItemPricingInput): PriceExplanation {
  const base = Math.max(1, input.base_price);
  const target = Math.max(1, input.target);
  const stock = Math.max(0, input.stock);
  const dem_ref = Math.max(1, input.dem_ref ?? 50);
  const dem_ema = Math.max(0, input.dem_ema ?? dem_ref);

  const stock_effect_bps = Math.round((K_STOCK_BPS * (target - stock)) / target);
  const demand_effect_bps = Math.round((K_DEM_BPS * (dem_ema - dem_ref)) / dem_ref);

  const multiplier = 10000 + stock_effect_bps + demand_effect_bps;
  const unclamped = Math.max(1, Math.round((base * multiplier) / 10000));
  const floorPrice = Math.max(1, Math.round((base * FLOOR_BPS) / 10000));
  const capPrice = Math.round((base * CAP_BPS) / 10000);

  let clamp: PriceClamp = "none";
  let price = unclamped;

  if (unclamped <= floorPrice) {
    clamp = "floor";
    price = floorPrice;
  } else if (unclamped >= capPrice) {
    clamp = "cap";
    price = capPrice;
  }

  return {
    item: input.id,
    price,
    base,
    stock,
    target,
    dem_ema,
    dem_ref,
    stock_effect_bps,
    demand_effect_bps,
    clamp,
  };
}

/**
 * Render structured explanation as a readable sentence for tooltips and screen readers.
 */
export function explainText(res: PriceExplanation): string {
  if (res.clamp === "floor") {
    return "Price held at the floor (30% of base).";
  }
  if (res.clamp === "cap") {
    return "Price held at the cap (400% of base).";
  }

  if (res.stock_effect_bps === 0 && res.demand_effect_bps === 0) {
    return "Balanced market: stock meets target and demand is normal.";
  }

  if (res.demand_effect_bps === 0) {
    if (res.stock < res.target) {
      const pct = Math.round(((res.target - res.stock) / res.target) * 100);
      const effect = Math.round(res.stock_effect_bps / 100);
      return `Stock is ${pct}% below target, so the price rises ${effect}%.`;
    } else {
      const pct = Math.round(((res.stock - res.target) / res.target) * 100);
      const effect = Math.round(Math.abs(res.stock_effect_bps) / 100);
      return `Stock is ${pct}% above target, so the price falls ${effect}%.`;
    }
  }

  if (res.stock_effect_bps === 0) {
    if (res.demand_effect_bps > 0) {
      const pct = Math.round(((res.dem_ema - res.dem_ref) / res.dem_ref) * 100);
      const effect = Math.round(res.demand_effect_bps / 100);
      return `Recent demand is ${pct}% above normal, adding ${effect}%.`;
    } else {
      const pct = Math.round(((res.dem_ref - res.dem_ema) / res.dem_ref) * 100);
      const effect = Math.round(Math.abs(res.demand_effect_bps) / 100);
      return `Recent demand is ${pct}% below normal, cutting ${effect}%.`;
    }
  }

  // Combined stock and demand impact
  const stockSign = res.stock_effect_bps > 0 ? "+" : "";
  const demSign = res.demand_effect_bps > 0 ? "+" : "";
  const stockEff = Math.round(res.stock_effect_bps / 100);
  const demEff = Math.round(res.demand_effect_bps / 100);

  return `Stock effect (${stockSign}${stockEff}%) and demand pressure (${demSign}${demEff}%).`;
}
