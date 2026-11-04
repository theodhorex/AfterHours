/**
 * Pure rule evaluator for player agents.
 * Erasable TypeScript only, zero dependencies, BigInt arithmetic.
 */

import type { CityState } from "../../sim/src/types.ts";
import type { PlayerOrder } from "../../sim/src/orders.ts";
import {
  type Agent,
  type Cond,
  type Op,
  MAX_ORDERS_PER_STEP,
  FEE_PER_FIRED_RULE,
} from "./schema.ts";

export interface AgentState {
  account: string;
  coin: bigint;
  items: Record<string, bigint>;
}

export interface EvaluateResult {
  orders: PlayerOrder[];
  fees: bigint;
  lastFired: Record<string, number>;
}

function evalOp(actual: bigint, op: Op, target: bigint): boolean {
  switch (op) {
    case "lt":
      return actual < target;
    case "lte":
      return actual <= target;
    case "gt":
      return actual > target;
    case "gte":
      return actual >= target;
    case "eq":
      return actual === target;
  }
}

/**
 * Computes city-wide stock of an item across all open businesses.
 */
function getCityStock(city: CityState, item: string): bigint {
  let total = 0n;
  for (const sector of city.sectors) {
    for (const b of sector.businesses) {
      if (b.open) {
        total += b.inventory[item] ?? 0n;
      }
    }
  }
  return total;
}

/**
 * Evaluates an agent against the current state and returns orders, fees, and updated lastFired.
 * PURE function: does not mutate any inputs.
 */
export function evaluateAgent(
  agent: Agent,
  agentState: AgentState,
  city: CityState,
  step: number,
  lastFired?: Record<string, number>
): EvaluateResult {
  let curCoin = agentState.coin;
  const curItems: Record<string, bigint> = { ...agentState.items };
  const outLastFired: Record<string, number> = { ...(lastFired ?? {}) };
  const orders: PlayerOrder[] = [];
  let totalFees = 0n;

  for (const rule of agent.rules) {
    // 1. Order cap check
    if (orders.length >= MAX_ORDERS_PER_STEP) {
      break;
    }

    // 2. Cooldown check: rule does not fire until cooldown steps after it last fired
    const last = outLastFired[rule.id];
    if (last !== undefined && step - last <= rule.cooldown) {
      continue;
    }

    // 3. Fee affordability check
    if (curCoin < FEE_PER_FIRED_RULE) {
      continue;
    }

    // 4. Conditions check (all must hold)
    let condsPass = true;
    for (const cond of rule.when) {
      if (cond.kind === "price") {
        const price = city.market.price[cond.item] ?? 0n;
        if (!evalOp(price, cond.op, cond.value)) {
          condsPass = false;
          break;
        }
      } else if (cond.kind === "stock") {
        const stock = getCityStock(city, cond.item);
        if (!evalOp(stock, cond.op, cond.value)) {
          condsPass = false;
          break;
        }
      } else if (cond.kind === "coin") {
        if (!evalOp(curCoin, cond.op, cond.value)) {
          condsPass = false;
          break;
        }
      } else if (cond.kind === "holding") {
        const holding = curItems[cond.item] ?? 0n;
        if (!evalOp(holding, cond.op, cond.value)) {
          condsPass = false;
          break;
        }
      } else if (cond.kind === "season_in") {
        const season = step % 4;
        if (!cond.seasons.includes(season)) {
          condsPass = false;
          break;
        }
      }
    }

    if (!condsPass) {
      continue;
    }

    // 5. Clamping and execution
    if (rule.do.kind === "buy") {
      const availableForBuy = curCoin - FEE_PER_FIRED_RULE;
      if (rule.do.max_price <= 0n) {
        continue;
      }
      const maxAffordable = availableForBuy / rule.do.max_price;
      const clampedQty = rule.do.qty < maxAffordable ? rule.do.qty : maxAffordable;

      if (clampedQty <= 0n) {
        // Skipped: clamped qty is 0, fee not charged
        continue;
      }

      // Rule fires!
      curCoin -= FEE_PER_FIRED_RULE + clampedQty * rule.do.max_price;
      totalFees += FEE_PER_FIRED_RULE;
      outLastFired[rule.id] = step;

      orders.push({
        order_id: `agent:${agentState.account}:${step}:${rule.id}`,
        account: agentState.account,
        kind: "buy",
        item: rule.do.item,
        qty: clampedQty,
        limit_price: rule.do.max_price,
      });
    } else {
      const holding = curItems[rule.do.item] ?? 0n;
      const clampedQty = rule.do.qty < holding ? rule.do.qty : holding;

      if (clampedQty <= 0n) {
        // Skipped: clamped qty is 0, fee not charged
        continue;
      }

      // Rule fires!
      curCoin -= FEE_PER_FIRED_RULE;
      curItems[rule.do.item] = holding - clampedQty;
      totalFees += FEE_PER_FIRED_RULE;
      outLastFired[rule.id] = step;

      orders.push({
        order_id: `agent:${agentState.account}:${step}:${rule.id}`,
        account: agentState.account,
        kind: "sell",
        item: rule.do.item,
        qty: clampedQty,
        limit_price: rule.do.min_price,
      });
    }
  }

  return {
    orders,
    fees: totalFees,
    lastFired: outLastFired,
  };
}
