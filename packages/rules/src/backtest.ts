/**
 * Agent backtesting engine and deterministic score evaluator.
 * Erasable TypeScript only, zero dependencies, BigInt arithmetic.
 */

import type { ArcFile, CityState } from "../../sim/src/types.ts";
import type { PricingRules } from "../../sim/src/pricing.ts";
import type { GrowthRules } from "../../sim/src/growth.ts";
import type { PlayerOrder } from "../../sim/src/orders.ts";
import { genesis } from "../../sim/src/genesis.ts";
import { step } from "../../sim/src/step.ts";
import { cityRoot, eventRoot, genesisPrevRoot, nextStateRoot } from "../../sim/src/roots.ts";
import type { Agent } from "./schema.ts";
import { evaluateAgent, type AgentState } from "./evaluate.ts";

export interface BacktestOptions {
  arc: ArcFile;
  pricing: PricingRules;
  growth: GrowthRules;
  seed: string;
  cityId: string;
  agent: Agent;
  startCoin: bigint;
  steps: number;
  account?: string;
  assertConservation?: boolean;
}

export interface BacktestResult {
  finalState: AgentState;
  score: bigint;
  trades: number;
  orders: number;
  stateRoot: string;
}

function verifyConservation(city: CityState, arc: ArcFile, stepNo: number): void {
  let physicalCoin = city.citizens.purse + city.treasury;
  for (const s of city.sectors) {
    for (const b of s.businesses) {
      physicalCoin += b.coin;
    }
  }
  if (city.totals.coin !== physicalCoin) {
    throw new Error(
      `Step ${stepNo}: Coin conservation failed: totals.coin=${city.totals.coin} vs physical=${physicalCoin}`
    );
  }

  for (const it of arc.items) {
    let physicalItem = 0n;
    for (const s of city.sectors) {
      for (const b of s.businesses) {
        physicalItem += b.inventory[it.id] ?? 0n;
      }
    }
    const totalItem = city.totals.items[it.id] ?? 0n;
    if (totalItem !== physicalItem) {
      throw new Error(
        `Step ${stepNo}: Item '${it.id}' conservation failed: totals=${totalItem} vs physical=${physicalItem}`
      );
    }
  }
}

/**
 * Runs a deterministic simulation backtest for a player agent.
 */
export function backtestAgent(options: BacktestOptions): BacktestResult {
  const { arc, pricing, growth, seed, cityId, agent, startCoin, steps, assertConservation } = options;
  const account = options.account ?? "agent";

  let currCity = genesis(arc, cityId, seed);
  let currPrevRoot = genesisPrevRoot(cityId, seed);
  let finalStateRoot = currPrevRoot;

  const currentAgentState: AgentState = {
    account,
    coin: startCoin,
    items: {},
  };

  let lastFired: Record<string, number> = {};
  const executedIds = new Set<string>();
  let totalTrades = 0;
  let totalOrders = 0;

  for (let s = 1; s <= steps; s++) {
    // 1. Evaluate agent for the upcoming step
    const evalRes = evaluateAgent(agent, currentAgentState, currCity, s, lastFired);
    lastFired = evalRes.lastFired;
    totalOrders += evalRes.orders.length;

    // 2. Prepare orders including rule execution fees
    const stepOrders: PlayerOrder[] = [...evalRes.orders];
    if (evalRes.fees > 0n) {
      stepOrders.push({
        order_id: `agent:${account}:${s}:fee`,
        account,
        kind: "fee",
        amount: evalRes.fees,
      });
    }

    // 3. Step the simulation
    const stepRes = step(currCity, { arc, pricing, growth, orders: stepOrders, executedIds });
    currCity = stepRes.state;

    // 4. Update Merkle state root
    const eRoot = eventRoot(stepRes.events);
    const cRoot = cityRoot(currCity);
    finalStateRoot = nextStateRoot(currPrevRoot, currCity.step, eRoot, cRoot);
    currPrevRoot = finalStateRoot;

    // 5. Apply accepted order effects to agent state
    for (const e of stepRes.events) {
      if (e.event === "order_accepted" && e.account === account) {
        if (e.kind === "buy") {
          const totalCoin = BigInt((e.total_coin as string | bigint | number) ?? 0);
          const filled = BigInt((e.filled as string | bigint | number) ?? 0);
          const item = e.item as string;
          currentAgentState.coin -= totalCoin;
          currentAgentState.items[item] = (currentAgentState.items[item] ?? 0n) + filled;
          totalTrades++;
        } else if (e.kind === "sell") {
          const totalCoin = BigInt((e.total_coin as string | bigint | number) ?? 0);
          const filled = BigInt((e.filled as string | bigint | number) ?? 0);
          const item = e.item as string;
          currentAgentState.coin += totalCoin;
          const remaining = (currentAgentState.items[item] ?? 0n) - filled;
          if (remaining <= 0n) {
            delete currentAgentState.items[item];
          } else {
            currentAgentState.items[item] = remaining;
          }
          totalTrades++;
        } else if (e.kind === "fee") {
          const feeAmt = BigInt((e.amount ?? (e.total_coin as string | bigint | number)) ?? 0);
          currentAgentState.coin -= feeAmt;
        }
      }
    }

    // Optional physical conservation verification every step
    if (assertConservation) {
      verifyConservation(currCity, arc, s);
    }
  }

  // Calculate final score = coin + sum(items * price at final step) - startCoin
  let portfolioValue = currentAgentState.coin;
  for (const [itemId, qty] of Object.entries(currentAgentState.items)) {
    if (qty > 0n) {
      const price = currCity.market.price[itemId] ?? 0n;
      portfolioValue += qty * price;
    }
  }

  const score = portfolioValue - startCoin;

  return {
    finalState: currentAgentState,
    score,
    trades: totalTrades,
    orders: totalOrders,
    stateRoot: finalStateRoot,
  };
}
