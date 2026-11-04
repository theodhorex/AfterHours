/**
 * Pricing rules and explanations per docs/data-contract.md section 8 and data/pricing.rules.json.
 * Zero external dependencies. BigInt arithmetic only. Erasable TypeScript.
 */

export interface PricingExplainTemplates {
  stock_low: string;
  stock_high: string;
  demand_up: string;
  demand_down: string;
  clamped_floor: string;
  clamped_cap: string;
}

export interface PricingRules {
  version: number;
  k_stock_bps: bigint;
  k_dem_bps: bigint;
  floor_bps: bigint;
  cap_bps: bigint;
  dem_ema_alpha_bps: bigint;
  target_stock_steps: bigint;
  dem_ref_floor: bigint;
  explain: PricingExplainTemplates;
}

export interface PriceReason {
  item: string;
  price: bigint;
  base: bigint;
  stock: bigint;
  target: bigint;
  dem_ema: bigint;
  dem_ref: bigint;
  stock_effect_bps: bigint;
  demand_effect_bps: bigint;
  clamped: "floor" | "cap" | null;
}

export interface ExplainPriceOptions {
  item: string;
  base: bigint;
  stock: bigint;
  dem_ema: bigint;
  expected?: bigint;
  target?: bigint;
  dem_ref?: bigint;
  pricing: PricingRules;
}

function parseBigIntField(obj: Record<string, unknown>, field: string, min = 0n): bigint {
  const val = obj[field];
  if (typeof val === "bigint") {
    if (val < min) {
      throw new RangeError(`Field '${field}' must be >= ${min}, got ${val}`);
    }
    return val;
  }
  if (typeof val === "number") {
    if (!Number.isInteger(val)) {
      throw new TypeError(`Field '${field}' must be an integer, got ${val}`);
    }
    const b = BigInt(val);
    if (b < min) {
      throw new RangeError(`Field '${field}' must be >= ${min}, got ${val}`);
    }
    return b;
  }
  throw new TypeError(`Field '${field}' must be a number or bigint, got ${typeof val}`);
}

/**
 * Validates and parses pricing rules JSON into a strongly-typed PricingRules record.
 */
export function parsePricingRules(json: unknown): PricingRules {
  let raw: unknown = json;
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json);
    } catch (err) {
      throw new TypeError(`Failed to parse pricing rules JSON: ${err}`);
    }
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TypeError("Pricing rules must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== "number" || !Number.isInteger(obj.version) || obj.version < 0) {
    throw new TypeError(`Pricing rules version must be a non-negative integer, got ${obj.version}`);
  }

  const k_stock_bps = parseBigIntField(obj, "k_stock_bps", 0n);
  const k_dem_bps = parseBigIntField(obj, "k_dem_bps", 0n);
  const floor_bps = parseBigIntField(obj, "floor_bps", 0n);
  const cap_bps = parseBigIntField(obj, "cap_bps", floor_bps);
  const dem_ema_alpha_bps = parseBigIntField(obj, "dem_ema_alpha_bps", 0n);
  if (dem_ema_alpha_bps > 10000n) {
    throw new RangeError(`dem_ema_alpha_bps must be <= 10000, got ${dem_ema_alpha_bps}`);
  }

  const target_stock_steps = parseBigIntField(obj, "target_stock_steps", 1n);
  const dem_ref_floor = parseBigIntField(obj, "dem_ref_floor", 0n);

  if (typeof obj.explain !== "object" || obj.explain === null || Array.isArray(obj.explain)) {
    throw new TypeError("Pricing rules 'explain' field must be an object");
  }

  const exp = obj.explain as Record<string, unknown>;
  const requiredTemplates = [
    "stock_low",
    "stock_high",
    "demand_up",
    "demand_down",
    "clamped_floor",
    "clamped_cap",
  ];

  for (const t of requiredTemplates) {
    if (typeof exp[t] !== "string" || exp[t].trim() === "") {
      throw new TypeError(`Pricing rules explain missing or invalid template: '${t}'`);
    }
  }

  const explain: PricingExplainTemplates = {
    stock_low: exp.stock_low as string,
    stock_high: exp.stock_high as string,
    demand_up: exp.demand_up as string,
    demand_down: exp.demand_down as string,
    clamped_floor: exp.clamped_floor as string,
    clamped_cap: exp.clamped_cap as string,
  };

  return {
    version: obj.version,
    k_stock_bps,
    k_dem_bps,
    floor_bps,
    cap_bps,
    dem_ema_alpha_bps,
    target_stock_steps,
    dem_ref_floor,
    explain,
  };
}

/**
 * Computes the new market price and returns the structured explanation.
 * Supports both options object or positional arguments.
 */
export function explainPrice(
  optionsOrItem: ExplainPriceOptions | string,
  baseArg?: bigint,
  stockArg?: bigint,
  demEmaArg?: bigint,
  expectedArg?: bigint,
  pricingArg?: PricingRules
): PriceReason {
  let item: string;
  let base: bigint;
  let stock: bigint;
  let dem_ema: bigint;
  let expected: bigint;
  let explicitTarget: bigint | undefined;
  let explicitDemRef: bigint | undefined;
  let pricing: PricingRules;

  if (typeof optionsOrItem === "object") {
    item = optionsOrItem.item;
    base = optionsOrItem.base;
    stock = optionsOrItem.stock;
    dem_ema = optionsOrItem.dem_ema;
    expected = optionsOrItem.expected ?? 0n;
    explicitTarget = optionsOrItem.target;
    explicitDemRef = optionsOrItem.dem_ref;
    pricing = optionsOrItem.pricing;
  } else {
    item = optionsOrItem;
    base = baseArg!;
    stock = stockArg!;
    dem_ema = demEmaArg!;
    expected = expectedArg ?? 0n;
    pricing = pricingArg!;
  }

  // Items nobody consumes keep their base price.
  if (expected === 0n && explicitTarget === undefined && explicitDemRef === undefined) {
    const dem_ref = pricing.dem_ref_floor > 0n ? pricing.dem_ref_floor : 1n;
    return {
      item,
      price: base,
      base,
      stock,
      target: 1n,
      dem_ema,
      dem_ref,
      stock_effect_bps: 0n,
      demand_effect_bps: 0n,
      clamped: null,
    };
  }

  const target = explicitTarget ?? (pricing.target_stock_steps * expected > 1n ? pricing.target_stock_steps * expected : 1n);
  const dem_ref = explicitDemRef ?? (pricing.dem_ref_floor > expected ? pricing.dem_ref_floor : expected);

  const stock_effect_bps = (pricing.k_stock_bps * (target - stock)) / target;
  const demand_effect_bps = (pricing.k_dem_bps * (dem_ema - dem_ref)) / dem_ref;

  const multiplier = 10000n + stock_effect_bps + demand_effect_bps;
  const unclamped = (base * multiplier) / 10000n;

  let floorPrice = (base * pricing.floor_bps) / 10000n;
  if (floorPrice < 1n) {
    floorPrice = 1n;
  }
  let capPrice = (base * pricing.cap_bps) / 10000n;
  if (capPrice < floorPrice) {
    capPrice = floorPrice;
  }

  let price = unclamped;
  let clamped: "floor" | "cap" | null = null;

  if (unclamped < floorPrice) {
    price = floorPrice;
    clamped = "floor";
  } else if (unclamped > capPrice) {
    price = capPrice;
    clamped = "cap";
  } else {
    price = unclamped;
    clamped = null;
  }

  if (price < 1n) {
    price = 1n;
  }

  return {
    item,
    price,
    base,
    stock,
    target,
    dem_ema,
    dem_ref,
    stock_effect_bps,
    demand_effect_bps,
    clamped,
  };
}

/**
 * Renders structured price explanation as natural language sentences.
 */
export function explainText(reason: PriceReason, pricing: PricingRules): string {
  const parts: string[] = [];

  if (reason.stock < reason.target) {
    const pct = ((reason.target - reason.stock) * 100n) / reason.target;
    const effect = reason.stock_effect_bps / 100n;
    parts.push(
      pricing.explain.stock_low
        .replace("{pct}", pct.toString())
        .replace("{effect}", effect.toString())
    );
  } else if (reason.stock > reason.target) {
    const pct = ((reason.stock - reason.target) * 100n) / reason.target;
    const effect = (-reason.stock_effect_bps) / 100n;
    parts.push(
      pricing.explain.stock_high
        .replace("{pct}", pct.toString())
        .replace("{effect}", effect.toString())
    );
  }

  if (reason.dem_ema > reason.dem_ref) {
    const pct = ((reason.dem_ema - reason.dem_ref) * 100n) / reason.dem_ref;
    const effect = reason.demand_effect_bps / 100n;
    parts.push(
      pricing.explain.demand_up
        .replace("{pct}", pct.toString())
        .replace("{effect}", effect.toString())
    );
  } else if (reason.dem_ema < reason.dem_ref) {
    const pct = ((reason.dem_ref - reason.dem_ema) * 100n) / reason.dem_ref;
    const effect = (-reason.demand_effect_bps) / 100n;
    parts.push(
      pricing.explain.demand_down
        .replace("{pct}", pct.toString())
        .replace("{effect}", effect.toString())
    );
  }

  if (reason.clamped === "floor") {
    const floor = pricing.floor_bps / 100n;
    parts.push(pricing.explain.clamped_floor.replace("{floor}", floor.toString()));
  } else if (reason.clamped === "cap") {
    const cap = pricing.cap_bps / 100n;
    parts.push(pricing.explain.clamped_cap.replace("{cap}", cap.toString()));
  }

  return parts.join(" ");
}
