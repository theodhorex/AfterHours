import type {
  ArcFile,
  ArcItem,
  ArcSector,
  ArcRecipe,
  ArcNeed,
  ArcCitizens,
  ArcStage,
  ArcEffect,
  ArcEventDef,
  ArcGenesis,
} from "./types.ts";

function toPositiveBigInt(val: unknown, fieldName: string): bigint {
  if (typeof val === "number") {
    if (!Number.isInteger(val) || val <= 0) {
      throw new Error(`Invalid field '${fieldName}': must be a positive integer, got ${val}`);
    }
    return BigInt(val);
  }
  if (typeof val === "bigint") {
    if (val <= 0n) {
      throw new Error(`Invalid field '${fieldName}': must be a positive integer, got ${val}`);
    }
    return val;
  }
  if (typeof val === "string" && /^\d+$/.test(val)) {
    const b = BigInt(val);
    if (b <= 0n) {
      throw new Error(`Invalid field '${fieldName}': must be a positive integer, got ${val}`);
    }
    return b;
  }
  throw new Error(`Invalid field '${fieldName}': must be a positive integer, got ${val}`);
}

function toNonNegativeBigInt(val: unknown, fieldName: string): bigint {
  if (typeof val === "number") {
    if (!Number.isInteger(val) || val < 0) {
      throw new Error(`Invalid field '${fieldName}': must be a non-negative integer, got ${val}`);
    }
    return BigInt(val);
  }
  if (typeof val === "bigint") {
    if (val < 0n) {
      throw new Error(`Invalid field '${fieldName}': must be a non-negative integer, got ${val}`);
    }
    return val;
  }
  if (typeof val === "string" && /^\d+$/.test(val)) {
    return BigInt(val);
  }
  throw new Error(`Invalid field '${fieldName}': must be a non-negative integer, got ${val}`);
}

/**
 * Validates and parses an arc file object per data-contract section 4.
 * Throws Error naming the invalid field if validation fails.
 */
export function parseArc(raw: unknown): ArcFile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Invalid field 'arc': root must be a JSON object");
  }

  const data = raw as Record<string, any>;

  if (typeof data.id !== "string" || !data.id) {
    throw new Error("Invalid field 'id': must be a non-empty string");
  }
  if (typeof data.name !== "string") {
    throw new Error("Invalid field 'name': must be a string");
  }
  if (typeof data.server !== "string") {
    throw new Error("Invalid field 'server': must be a string");
  }
  if (typeof data.version !== "number" || !Number.isInteger(data.version)) {
    throw new Error("Invalid field 'version': must be an integer");
  }

  // 1. Items
  if (!Array.isArray(data.items)) {
    throw new Error("Invalid field 'items': must be an array");
  }
  const itemIds = new Set<string>();
  const items: ArcItem[] = data.items.map((it: any) => {
    if (typeof it !== "object" || it === null) {
      throw new Error("Invalid field 'items': item entry must be an object");
    }
    if (typeof it.id !== "string" || !it.id) {
      throw new Error("Invalid field 'item.id': must be a non-empty string");
    }
    if (itemIds.has(it.id)) {
      throw new Error(`Invalid field 'item.id': duplicate item '${it.id}'`);
    }
    itemIds.add(it.id);

    const base_price = toPositiveBigInt(it.base_price, "item.base_price");
    if (typeof it.tier !== "string") {
      throw new Error(`Invalid field 'item.tier': item '${it.id}' tier must be a string`);
    }
    return {
      id: it.id,
      base_price,
      tier: it.tier,
    };
  });

  // 2. Sectors: exactly 6 sectors idx 0..5
  if (!Array.isArray(data.sectors)) {
    throw new Error("Invalid field 'sectors': must be an array");
  }
  if (data.sectors.length !== 6) {
    throw new Error(`Invalid field 'sectors': expected exactly 6 sectors, got ${data.sectors.length}`);
  }
  const sectorIdxSet = new Set<number>();
  const sectors: ArcSector[] = data.sectors.map((sec: any) => {
    if (typeof sec !== "object" || sec === null) {
      throw new Error("Invalid field 'sectors': sector entry must be an object");
    }
    if (typeof sec.idx !== "number" || !Number.isInteger(sec.idx) || sec.idx < 0 || sec.idx > 5) {
      throw new Error(`Invalid field 'sectors': sector idx ${sec.idx} must be an integer in 0..5`);
    }
    if (sectorIdxSet.has(sec.idx)) {
      throw new Error(`Invalid field 'sectors': duplicate sector idx ${sec.idx}`);
    }
    sectorIdxSet.add(sec.idx);
    if (typeof sec.kind !== "string") {
      throw new Error(`Invalid field 'sectors': sector idx ${sec.idx} kind must be a string`);
    }
    if (typeof sec.name !== "string") {
      throw new Error(`Invalid field 'sectors': sector idx ${sec.idx} name must be a string`);
    }
    return {
      idx: sec.idx,
      kind: sec.kind,
      name: sec.name,
    };
  });
  if (sectorIdxSet.size !== 6 || ![0, 1, 2, 3, 4, 5].every((i) => sectorIdxSet.has(i))) {
    throw new Error("Invalid field 'sectors': sectors must cover indices 0..5 exactly");
  }

  // 3. Recipes
  if (!Array.isArray(data.recipes)) {
    throw new Error("Invalid field 'recipes': must be an array");
  }
  const recipeIds = new Set<string>();
  const recipes: ArcRecipe[] = data.recipes.map((rec: any) => {
    if (typeof rec !== "object" || rec === null) {
      throw new Error("Invalid field 'recipes': recipe entry must be an object");
    }
    if (typeof rec.id !== "string" || !rec.id) {
      throw new Error("Invalid field 'recipe.id': must be a non-empty string");
    }
    if (recipeIds.has(rec.id)) {
      throw new Error(`Invalid field 'recipe.id': duplicate recipe '${rec.id}'`);
    }
    recipeIds.add(rec.id);

    // every recipe sector in 0..5
    if (typeof rec.sector !== "number" || !Number.isInteger(rec.sector) || rec.sector < 0 || rec.sector > 5) {
      throw new Error(`Invalid field 'recipe.sector': recipe '${rec.id}' sector ${rec.sector} must be in 0..5`);
    }

    // inputs: Record<string, bigint>
    const inputs: Record<string, bigint> = {};
    if (rec.inputs !== undefined && rec.inputs !== null) {
      if (typeof rec.inputs !== "object" || Array.isArray(rec.inputs)) {
        throw new Error(`Invalid field 'recipe.inputs': inputs for recipe '${rec.id}' must be an object`);
      }
      for (const [item, qty] of Object.entries(rec.inputs)) {
        if (!itemIds.has(item)) {
          throw new Error(
            `Invalid field 'recipe.inputs': recipe '${rec.id}' references unknown item '${item}'`
          );
        }
        inputs[item] = toPositiveBigInt(qty, "recipe.inputs");
      }
    }

    // outputs: Record<string, bigint>
    const outputs: Record<string, bigint> = {};
    if (rec.outputs !== undefined && rec.outputs !== null) {
      if (typeof rec.outputs !== "object" || Array.isArray(rec.outputs)) {
        throw new Error(`Invalid field 'recipe.outputs': outputs for recipe '${rec.id}' must be an object`);
      }
      for (const [item, qty] of Object.entries(rec.outputs)) {
        if (!itemIds.has(item)) {
          throw new Error(
            `Invalid field 'recipe.outputs': recipe '${rec.id}' references unknown item '${item}'`
          );
        }
        outputs[item] = toPositiveBigInt(qty, "recipe.outputs");
      }
    }

    const wage = toPositiveBigInt(rec.wage, "recipe.wage");
    const max_per_run_per_business = toPositiveBigInt(
      rec.max_per_run_per_business,
      "recipe.max_per_run_per_business"
    );

    return {
      id: rec.id,
      sector: rec.sector,
      inputs,
      outputs,
      wage,
      max_per_run_per_business,
    };
  });

  // 4. Citizens
  if (typeof data.citizens !== "object" || data.citizens === null) {
    throw new Error("Invalid field 'citizens': must be an object");
  }
  const start_population = toPositiveBigInt(
    data.citizens.start_population,
    "citizens.start_population"
  );
  if (!Array.isArray(data.citizens.needs)) {
    throw new Error("Invalid field 'citizens.needs': must be an array");
  }
  const needs: ArcNeed[] = data.citizens.needs.map((need: any) => {
    if (typeof need !== "object" || need === null) {
      throw new Error("Invalid field 'citizens.needs': need entry must be an object");
    }
    if (typeof need.item !== "string" || !itemIds.has(need.item)) {
      throw new Error(`Invalid field 'citizens.needs': item '${need.item}' does not exist in items`);
    }
    const per_capita_milli = toPositiveBigInt(
      need.per_capita_milli,
      "citizens.needs.per_capita_milli"
    );
    const satisfaction_weight = toPositiveBigInt(
      need.satisfaction_weight,
      "citizens.needs.satisfaction_weight"
    );

    const alt: string[] = [];
    if (need.alt !== undefined && need.alt !== null) {
      if (!Array.isArray(need.alt)) {
        throw new Error("Invalid field 'citizens.needs.alt': alt must be an array");
      }
      for (const altItem of need.alt) {
        if (typeof altItem !== "string" || !itemIds.has(altItem)) {
          throw new Error(
            `Invalid field 'citizens.needs.alt': alt item '${altItem}' does not exist in items`
          );
        }
        alt.push(altItem);
      }
    }

    return {
      item: need.item,
      per_capita_milli,
      alt,
      satisfaction_weight,
    };
  });
  const citizens: ArcCitizens = {
    start_population,
    needs,
  };

  // 5. Stages: ordered by min_population, first one at 0
  if (!Array.isArray(data.stages) || data.stages.length === 0) {
    throw new Error("Invalid field 'stages': must be a non-empty array");
  }
  const stages: ArcStage[] = [];
  for (let i = 0; i < data.stages.length; i++) {
    const st = data.stages[i];
    if (typeof st !== "object" || st === null) {
      throw new Error("Invalid field 'stages': stage entry must be an object");
    }
    if (typeof st.id !== "string" || !st.id) {
      throw new Error("Invalid field 'stages.id': must be a non-empty string");
    }
    const min_population = toNonNegativeBigInt(st.min_population, "stages.min_population");
    if (i === 0 && min_population !== 0n) {
      throw new Error(`Invalid field 'stages': first stage min_population must be 0, got ${min_population}`);
    }
    if (i > 0 && min_population <= stages[i - 1].min_population) {
      throw new Error(
        `Invalid field 'stages': stages must be ordered by strictly increasing min_population (${min_population} <= ${stages[i - 1].min_population})`
      );
    }
    const max_businesses_per_sector = toPositiveBigInt(
      st.max_businesses_per_sector,
      "stages.max_businesses_per_sector"
    );
    stages.push({
      id: st.id,
      min_population,
      max_businesses_per_sector,
    });
  }

  // 6. Events: weight and duration_steps positive
  if (!Array.isArray(data.events)) {
    throw new Error("Invalid field 'events': must be an array");
  }
  const events: ArcEventDef[] = data.events.map((ev: any) => {
    if (typeof ev !== "object" || ev === null) {
      throw new Error("Invalid field 'events': event entry must be an object");
    }
    if (typeof ev.id !== "string" || !ev.id) {
      throw new Error("Invalid field 'events.id': must be a non-empty string");
    }
    const weight = toPositiveBigInt(ev.weight, "events.weight");
    const duration_steps = toPositiveBigInt(ev.duration_steps, "events.duration_steps");

    const effects: ArcEffect[] = [];
    if (Array.isArray(ev.effects)) {
      for (const eff of ev.effects) {
        if (typeof eff === "object" && eff !== null) {
          const parsedEff: ArcEffect = {
            kind: String(eff.kind),
          };
          if (eff.recipe !== undefined) {
            parsedEff.recipe = String(eff.recipe);
          }
          if (eff.sector !== undefined) {
            parsedEff.sector = Number(eff.sector);
          }
          if (eff.bps !== undefined) {
            parsedEff.bps = BigInt(eff.bps);
          }
          effects.push(parsedEff);
        }
      }
    }

    return {
      id: ev.id,
      weight,
      duration_steps,
      effects,
    };
  });

  // 7. Genesis: starting_businesses keys are recipe ids
  if (typeof data.genesis !== "object" || data.genesis === null) {
    throw new Error("Invalid field 'genesis': must be an object");
  }
  const coin_per_business = toPositiveBigInt(
    data.genesis.coin_per_business,
    "genesis.coin_per_business"
  );
  const coin_citizens = toPositiveBigInt(
    data.genesis.coin_citizens,
    "genesis.coin_citizens"
  );

  const starting_businesses: Record<string, bigint> = {};
  if (data.genesis.starting_businesses !== undefined && data.genesis.starting_businesses !== null) {
    if (typeof data.genesis.starting_businesses !== "object" || Array.isArray(data.genesis.starting_businesses)) {
      throw new Error("Invalid field 'genesis.starting_businesses': must be an object");
    }
    for (const [recId, count] of Object.entries(data.genesis.starting_businesses)) {
      if (!recipeIds.has(recId)) {
        throw new Error(
          `Invalid field 'genesis.starting_businesses': recipe '${recId}' does not exist in recipes`
        );
      }
      starting_businesses[recId] = toPositiveBigInt(count, "genesis.starting_businesses.count");
    }
  }

  // Check if genesis contains any item references (e.g. starting items)
  if (data.genesis.starting_items !== undefined && data.genesis.starting_items !== null) {
    for (const itemId of Object.keys(data.genesis.starting_items)) {
      if (!itemIds.has(itemId)) {
        throw new Error(
          `Invalid field 'genesis.starting_items': item '${itemId}' does not exist in items`
        );
      }
    }
  }

  const genesis: ArcGenesis = {
    coin_per_business,
    coin_citizens,
    starting_businesses,
  };

  return {
    id: data.id,
    name: data.name,
    server: data.server,
    version: data.version,
    items,
    sectors,
    recipes,
    citizens,
    stages,
    events,
    genesis,
  };
}
