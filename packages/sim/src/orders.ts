/**
 * Player orders engine for AfterHours simulation (buy / sell / invest).
 * Erasable TypeScript only, zero external dependencies, BigInt arithmetic.
 */

import type { ArcFile, ArcRecipe, Business, CityState, SimEvent } from "./types.ts";

export interface PlayerOrder {
  order_id: string;
  account: string;
  kind: "buy" | "sell" | "invest";
  item?: string;
  qty?: bigint;
  limit_price?: bigint;
  business_id?: string;
  amount?: bigint;
}

/**
 * Phase 2: Processes player orders in array order.
 * Rejects duplicates, out-of-limit prices, missing stock/buyers, unknown businesses, or zero amount.
 * Emits order_accepted, order_rejected, and business_reopened events.
 * Returns array of accepted order_ids.
 */
export function processOrdersPhase(
  state: CityState,
  arc: ArcFile,
  orders: PlayerOrder[],
  executedIds: Set<string> | undefined,
  events: SimEvent[]
): string[] {
  const seenInStep = new Set<string>();
  const acceptedOrderIds: string[] = [];

  const recipeMap = new Map<string, ArcRecipe>();
  for (const r of arc.recipes) recipeMap.set(r.id, r);

  // Flatten businesses in fixed order: sector idx asc, business id asc
  const allBusinesses: Business[] = [];
  for (const sec of state.sectors) {
    const sorted = [...sec.businesses].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    allBusinesses.push(...sorted);
  }

  for (const o of orders) {
    // Duplicate guard: same step or caller-supplied executedIds
    if (seenInStep.has(o.order_id) || (executedIds && executedIds.has(o.order_id))) {
      events.push({
        event: "order_rejected",
        city_id: state.city_id,
        step: state.step,
        order_id: o.order_id,
        account: o.account,
        reason: "duplicate",
      });
      continue;
    }
    seenInStep.add(o.order_id);

    if (o.kind === "buy") {
      if (!o.item || state.market.price[o.item] === undefined) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "no_stock",
        });
        continue;
      }

      const price = state.market.price[o.item];
      if (o.limit_price !== undefined && price > o.limit_price) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "price_above_limit",
        });
        continue;
      }

      let remaining = o.qty ?? 0n;
      if (remaining <= 0n) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "no_stock",
        });
        continue;
      }

      let filled = 0n;
      for (const b of allBusinesses) {
        if (!b.open) continue;
        const stock = b.inventory[o.item] ?? 0n;
        if (stock <= 0n) continue;

        const take = remaining < stock ? remaining : stock;
        b.inventory[o.item] = stock - take;
        if (b.inventory[o.item] === 0n) delete b.inventory[o.item];
        b.coin += take * price;
        remaining -= take;
        filled += take;
        if (remaining === 0n) break;
      }

      if (filled === 0n) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "no_stock",
        });
        continue;
      }

      acceptedOrderIds.push(o.order_id);
      if (executedIds) executedIds.add(o.order_id);
      events.push({
        event: "order_accepted",
        city_id: state.city_id,
        step: state.step,
        order_id: o.order_id,
        account: o.account,
        kind: "buy",
        item: o.item,
        filled: filled.toString(),
        price: price.toString(),
        total_coin: (filled * price).toString(),
      });
    } else if (o.kind === "sell") {
      if (!o.item || state.market.price[o.item] === undefined) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "buyers_lack_coin_or_need",
        });
        continue;
      }

      const price = state.market.price[o.item];
      if (o.limit_price !== undefined && price < o.limit_price) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "price_below_limit",
        });
        continue;
      }

      let remaining = o.qty ?? 0n;
      if (remaining <= 0n) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "buyers_lack_coin_or_need",
        });
        continue;
      }

      let filled = 0n;
      for (const b of allBusinesses) {
        if (!b.open) continue;
        const recipe = recipeMap.get(b.recipe);
        if (!recipe || recipe.inputs[o.item] === undefined) continue;

        const needed = recipe.inputs[o.item];
        const target = recipe.max_per_run_per_business * needed;
        const curInv = b.inventory[o.item] ?? 0n;
        if (curInv >= target) continue;

        const desired = target - curInv;
        if (price <= 0n) continue;
        const maxAffordable = b.coin / price;
        if (maxAffordable <= 0n) continue;

        let take = remaining < desired ? remaining : desired;
        if (maxAffordable < take) take = maxAffordable;

        if (take > 0n) {
          b.inventory[o.item] = curInv + take;
          b.coin -= take * price;
          remaining -= take;
          filled += take;
          if (remaining === 0n) break;
        }
      }

      if (filled === 0n) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "buyers_lack_coin_or_need",
        });
        continue;
      }

      acceptedOrderIds.push(o.order_id);
      if (executedIds) executedIds.add(o.order_id);
      events.push({
        event: "order_accepted",
        city_id: state.city_id,
        step: state.step,
        order_id: o.order_id,
        account: o.account,
        kind: "sell",
        item: o.item,
        filled: filled.toString(),
        price: price.toString(),
        total_coin: (filled * price).toString(),
      });
    } else if (o.kind === "invest") {
      if (o.amount === undefined || o.amount <= 0n) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "zero_amount",
        });
        continue;
      }

      let targetBiz: Business | undefined;
      for (const b of allBusinesses) {
        if (b.id === o.business_id) {
          targetBiz = b;
          break;
        }
      }

      if (!targetBiz) {
        events.push({
          event: "order_rejected",
          city_id: state.city_id,
          step: state.step,
          order_id: o.order_id,
          account: o.account,
          reason: "unknown_business",
        });
        continue;
      }

      if (!targetBiz.open) {
        targetBiz.open = true;
        targetBiz.insolvent_steps = 0;
        events.push({
          event: "business_reopened",
          city_id: state.city_id,
          step: state.step,
          business_id: targetBiz.id,
          business: targetBiz.id,
          recipe: targetBiz.recipe,
        });
      }

      targetBiz.coin += o.amount;
      acceptedOrderIds.push(o.order_id);
      if (executedIds) executedIds.add(o.order_id);
      events.push({
        event: "order_accepted",
        city_id: state.city_id,
        step: state.step,
        order_id: o.order_id,
        account: o.account,
        kind: "invest",
        business_id: targetBiz.id,
        amount: o.amount.toString(),
        total_coin: o.amount.toString(),
      });
    } else {
      events.push({
        event: "order_rejected",
        city_id: state.city_id,
        step: state.step,
        order_id: o.order_id,
        account: o.account,
        reason: "unknown_kind",
      });
    }
  }

  return acceptedOrderIds;
}
