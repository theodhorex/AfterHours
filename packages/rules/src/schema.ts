/**
 * Agent Rule Language Schema & Parser.
 * Erasable TypeScript only, zero dependencies, BigInt arithmetic.
 */

import type { ArcFile } from "../../sim/src/types.ts";

export const MAX_RULES = 8;
export const MAX_CONDS = 3;
export const MAX_ORDERS_PER_STEP = 4;
export const FEE_PER_FIRED_RULE = 2n;

export type Op = "lt" | "lte" | "gt" | "gte" | "eq";

export interface PriceCond {
  kind: "price";
  item: string;
  op: Op;
  value: bigint;
}

export interface StockCond {
  kind: "stock";
  item: string;
  op: Op;
  value: bigint;
}

export interface CoinCond {
  kind: "coin";
  op: Op;
  value: bigint;
}

export interface HoldingCond {
  kind: "holding";
  item: string;
  op: Op;
  value: bigint;
}

export interface SeasonInCond {
  kind: "season_in";
  seasons: number[];
}

export type Cond = PriceCond | StockCond | CoinCond | HoldingCond | SeasonInCond;

export interface BuyAction {
  kind: "buy";
  item: string;
  qty: bigint;
  max_price: bigint;
}

export interface SellAction {
  kind: "sell";
  item: string;
  qty: bigint;
  min_price: bigint;
}

export type Action = BuyAction | SellAction;

export interface Rule {
  id: string;
  when: Cond[];
  do: Action;
  cooldown: number;
}

export interface Agent {
  version: 1;
  name: string;
  rules: Rule[];
}

const VALID_OPS = new Set<string>(["lt", "lte", "gt", "gte", "eq"]);
const DECIMAL_REGEX = /^[0-9]+$/;

function parseDecimalString(val: unknown, fieldName: string): bigint {
  if (typeof val !== "string") {
    throw new TypeError(`Field '${fieldName}' must be a decimal string: got ${typeof val}`);
  }
  if (!DECIMAL_REGEX.test(val)) {
    throw new RangeError(`Field '${fieldName}' must be a non-negative decimal string: got '${val}'`);
  }
  return BigInt(val);
}

/**
 * Validates and parses agent JSON against an Arc definition.
 * Throws TypeError or RangeError naming the offending field.
 */
export function parseAgent(json: unknown, arc: ArcFile): Agent {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new TypeError("Agent definition must be a non-null object");
  }

  const obj = json as Record<string, unknown>;

  if (obj.version !== 1) {
    if (typeof obj.version !== "number") {
      throw new TypeError(`Field 'version' must be the number 1: got ${typeof obj.version}`);
    }
    throw new RangeError(`Field 'version' must be 1: got ${obj.version}`);
  }

  if (typeof obj.name !== "string" || obj.name.trim().length === 0) {
    throw new TypeError(`Field 'name' must be a non-empty string: got ${typeof obj.name}`);
  }

  if (!Array.isArray(obj.rules)) {
    throw new TypeError(`Field 'rules' must be an array: got ${typeof obj.rules}`);
  }

  if (obj.rules.length > MAX_RULES) {
    throw new RangeError(`Field 'rules' exceeds maximum limit of ${MAX_RULES}: got ${obj.rules.length}`);
  }

  const itemSet = new Set<string>(arc.items.map((it) => it.id));
  const seenRuleIds = new Set<string>();
  const parsedRules: Rule[] = [];

  for (let rIdx = 0; rIdx < obj.rules.length; rIdx++) {
    const rawRule = obj.rules[rIdx];
    if (!rawRule || typeof rawRule !== "object" || Array.isArray(rawRule)) {
      throw new TypeError(`Rule at index ${rIdx} must be an object`);
    }

    const r = rawRule as Record<string, unknown>;

    if (typeof r.id !== "string" || r.id.trim().length === 0) {
      throw new TypeError(`Rule at index ${rIdx} must have a non-empty string 'id'`);
    }

    if (seenRuleIds.has(r.id)) {
      throw new RangeError(`Duplicate rule id '${r.id}' at index ${rIdx}`);
    }
    seenRuleIds.add(r.id);

    // Cooldown: integer >= 0, default 0
    let cooldown = 0;
    if (r.cooldown !== undefined) {
      if (typeof r.cooldown !== "number" || !Number.isInteger(r.cooldown)) {
        throw new TypeError(`Field 'cooldown' in rule '${r.id}' must be an integer: got ${r.cooldown}`);
      }
      if (r.cooldown < 0) {
        throw new RangeError(`Field 'cooldown' in rule '${r.id}' must be >= 0: got ${r.cooldown}`);
      }
      cooldown = r.cooldown;
    }

    // When: 0..3 Conds
    const rawWhen = r.when ?? [];
    if (!Array.isArray(rawWhen)) {
      throw new TypeError(`Field 'when' in rule '${r.id}' must be an array`);
    }
    if (rawWhen.length > MAX_CONDS) {
      throw new RangeError(`Field 'when' in rule '${r.id}' exceeds maximum limit of ${MAX_CONDS} conds: got ${rawWhen.length}`);
    }

    const parsedWhen: Cond[] = [];
    for (let cIdx = 0; cIdx < rawWhen.length; cIdx++) {
      const rawCond = rawWhen[cIdx];
      if (!rawCond || typeof rawCond !== "object" || Array.isArray(rawCond)) {
        throw new TypeError(`Condition ${cIdx} in rule '${r.id}' must be an object`);
      }
      const c = rawCond as Record<string, unknown>;

      if (typeof c.kind !== "string") {
        throw new TypeError(`Field 'kind' in condition ${cIdx} of rule '${r.id}' must be a string`);
      }

      if (c.kind === "season_in") {
        if (!Array.isArray(c.seasons) || c.seasons.length < 1 || c.seasons.length > 4) {
          throw new RangeError(`Field 'seasons' in rule '${r.id}' must have 1..4 entries`);
        }
        for (const s of c.seasons) {
          if (typeof s !== "number" || !Number.isInteger(s) || s < 0 || s > 3) {
            throw new RangeError(`Season entries in rule '${r.id}' must be integers in 0..3: got ${s}`);
          }
        }
        parsedWhen.push({
          kind: "season_in",
          seasons: [...c.seasons],
        });
      } else if (c.kind === "price" || c.kind === "stock" || c.kind === "coin" || c.kind === "holding") {
        if (typeof c.op !== "string" || !VALID_OPS.has(c.op)) {
          throw new TypeError(`Field 'op' in condition ${cIdx} of rule '${r.id}' must be one of lt, lte, gt, gte, eq: got '${c.op}'`);
        }
        const op = c.op as Op;
        const val = parseDecimalString(c.value, `rules[${r.id}].when[${cIdx}].value`);

        if (c.kind === "coin") {
          parsedWhen.push({ kind: "coin", op, value: val });
        } else {
          if (typeof c.item !== "string" || !itemSet.has(c.item)) {
            throw new RangeError(`Unknown item id '${c.item}' in condition ${cIdx} of rule '${r.id}'`);
          }
          if (c.kind === "price") {
            parsedWhen.push({ kind: "price", item: c.item, op, value: val });
          } else if (c.kind === "stock") {
            parsedWhen.push({ kind: "stock", item: c.item, op, value: val });
          } else {
            parsedWhen.push({ kind: "holding", item: c.item, op, value: val });
          }
        }
      } else {
        throw new TypeError(`Unknown condition kind '${c.kind}' in rule '${r.id}'`);
      }
    }

    // Do: Action
    const rawDo = r.do;
    if (!rawDo || typeof rawDo !== "object" || Array.isArray(rawDo)) {
      throw new TypeError(`Field 'do' in rule '${r.id}' must be an object`);
    }
    const d = rawDo as Record<string, unknown>;

    if (typeof d.kind !== "string" || (d.kind !== "buy" && d.kind !== "sell")) {
      throw new TypeError(`Field 'kind' in action of rule '${r.id}' must be 'buy' or 'sell': got '${d.kind}'`);
    }

    if (typeof d.item !== "string" || !itemSet.has(d.item)) {
      throw new RangeError(`Unknown item id '${d.item}' in action of rule '${r.id}'`);
    }

    const qty = parseDecimalString(d.qty, `rules[${r.id}].do.qty`);
    if (qty < 1n || qty > 1000n) {
      throw new RangeError(`Field 'qty' in rule '${r.id}' must be between 1 and 1000: got ${qty}`);
    }

    let parsedAction: Action;
    if (d.kind === "buy") {
      const maxPrice = parseDecimalString(d.max_price, `rules[${r.id}].do.max_price`);
      parsedAction = {
        kind: "buy",
        item: d.item,
        qty,
        max_price: maxPrice,
      };
    } else {
      const minPrice = parseDecimalString(d.min_price, `rules[${r.id}].do.min_price`);
      parsedAction = {
        kind: "sell",
        item: d.item,
        qty,
        min_price: minPrice,
      };
    }

    parsedRules.push({
      id: r.id,
      when: parsedWhen,
      do: parsedAction,
      cooldown,
    });
  }

  return {
    version: 1,
    name: obj.name,
    rules: parsedRules,
  };
}
