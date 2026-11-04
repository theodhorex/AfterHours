# Data contract v0 (single source of truth for sim, verify and the contract)

Status: v0, 2026-11-04. Written by the project lead. Workers implement it; changes to this file need lead approval.
All numbers are starting values to be tuned, not research results.

## 1. Canonical serialization and hashing
- **Canonical JSON:** UTF-8, object keys sorted lexicographically (byte order), no whitespace, arrays keep their order. Integers are `bigint` in the sim and are written as **decimal strings** (e.g. `"1200"`); no floats anywhere. `null` is allowed, `undefined` is not.
- **Leaf hash:** `leaf(x) = SHA-256(canonical_json(x))`, 32 raw bytes.
- **Node hash:** `H(h1, ..., hn) = SHA-256(h1 || ... || hn)` over the raw 32-byte digests, in the given order.
- **Hex:** lowercase, 64 chars, when shown or stored in JSON.
- The Rust contract and the TypeScript sim must produce identical hashes for identical inputs. Test vectors live in `data/fixtures/hash_vectors.json` (generated independently, see test T26).

## 2. Time and randomness
- One step = one season. 4 steps per year, 2000 steps = 500 years. Stages (eras) in `arc.stages`.
- `world_seed`: string. `seed_step(city_id, step) = leaf({"w": world_seed, "c": city_id, "s": step})`, first 8 bytes as little-endian u64 seeds the PRNG.
- PRNG: PCG32 (XSH-RR) with 64-bit state. All draws consume the PRNG in a fixed documented order. No `Math.random`, no `Date`, no float math, no unordered `Map`/`Set` iteration (iterate sorted keys).

## 3. Units
- Money is `coin` (bigint, whole units). Items are bigint counts. Prices are coin per item (bigint, >= 1).
- Rates use basis points (bps, 10000 = 100%) or milli-units (1000 = 1.0). Integer division rounds toward zero; where rounding matters the rule is stated.

## 4. Arc file (`data/arcs/<id>.json`)
Fields: `id`, `name`, `server`, `version`, `items[]` (`id`, `base_price`, `tier`), `sectors[]` (6 entries: `idx`, `kind`, `name`), `recipes[]` (`id`, `sector`, `inputs{item:n}`, `outputs{item:n}`, `wage` coin per run paid to citizens, `max_per_run_per_business`), `citizens` (`start_population`, `needs[]` with `item`, `per_capita_milli`, optional `alt[]`, `satisfaction_weight`), `stages[]` (`id`, `min_population`, `max_businesses_per_sector`), `events[]` (`id`, `weight`, `duration_steps`, `effects[]`), `genesis` (`coin_per_business`, `coin_citizens`, `starting_businesses` per recipe).
- A recipe with empty `inputs` is a **primary producer** (creates items from nothing; this is the only way items enter the world besides event sources).
- `wage` is a coin **transfer** from business to citizen purse, not a sink.
- Contract-side the arc recipe table is generated from these files (`packages/data-gen`, task B3). Test T25 asserts equality.

## 5. State (TypeScript types, `packages/sim/src/types.ts`)
```
CityState {
  city_id, arc_id, step: number, world_seed: string,
  stage: number,
  sectors: SectorState[6],
  citizens: { population: bigint, satisfaction_bps: bigint, purse: bigint },
  market: { price: Record<item, bigint>, demand_ema: Record<item, bigint> },
  treasury: bigint,
  totals: { items: Record<item, bigint>, coin: bigint }   // running conserved totals, see 7
}
SectorState {
  idx, kind, owner: string | null, arc_origin: string,
  businesses: Business[],  rules: AgentRule[]    // rules: see packages/rules
}
Business { id, recipe: string, open: boolean, coin: bigint, inventory: Record<item, bigint>, insolvent_steps: number }
```
Everything that affects future steps is in this state; nothing else is read.

## 6. Step order (`step(state, orders, ctx) -> { state, events }`)
1. **Events:** draw scheduled/random arc events from the step PRNG; activate modifiers (listed in `events` output as `event_start`/`event_end`).
2. **Orders:** player orders and agent rule orders merged, sorted by `(step, index)`; duplicate `order_id` rejected (event `order_rejected`).
3. **Production:** for each open business in (sector idx, business idx) order: run `recipe` up to `max_per_run_per_business` limited by inputs in inventory and coin for wages; pay `wage` to `citizens.purse`.
4. **Trade:** businesses buy missing inputs from other businesses in the same city market at `market.price`; citizens spend `purse` on `needs` at `market.price`, consuming items (`consumed_pop`). Matching order is fixed (sector idx, business idx), partial fills allowed, never sell what is not in inventory.
5. **Prices:** `explain_price(item)` from `data/pricing.rules.json` (see 8) updates `market.price` and `demand_ema`.
6. **Closure and entry:** business with `coin < 0` for `M` consecutive steps closes (`business_closed`), assets auctioned at market price to other businesses; `invest(business, amount)` order reopens. Entrepreneur NPC opens a business in a sector whose average margin exceeds the threshold and where the stage allows more businesses (`business_opened`).
   Implemented 4 Nov (A1d + lead) with rules in `data/growth.rules.json`: closure = `idle_close_steps` consecutive steps without production (not `coin < 0`); entry, population and stage per the file. Three circulation rules were added after the first 2000-step runs showed profit hoarding and starved upstream chains: (a) **dividends** (after prices): each open business pays `dividend_bps` of its coin above `dividend_reserve_bps` x `coin_per_business` into `citizens.purse` (event `dividends_paid`); (b) **working capital** (right after): open businesses below `topup_floor_bps` x `coin_per_business` whose recipe is profitable at current prices are refilled from the purse (event `capital_injected`); (c) **stock cap** (production): a business stops producing when its stock of an output reaches `stock_cap_runs` full runs. All three only move coin or limit production, so conservation is unchanged.
7. **Citizens:** satisfaction from unmet needs; below threshold citizens leave (population down), above threshold population grows within stage limits.
8. **Stage:** advance stage only if population, satisfaction and wealth cross the stage thresholds (`stage_up`).
9. **Hash:** compute roots (section 9) and append `step_end` event.

## 7. Conservation (checked in tests T01/T02 and by the contract)
For every item `i` over any range of steps:
`total_i(new) = total_i(old) + produced_i - consumed_recipe_i - consumed_pop_i + sourced_i - sunk_i - trade_net_i`
For `coin`: `total_coin(new) = total_coin(old) + sourced_coin - sunk_coin - trade_net_coin`.
- `produced_i` / `consumed_recipe_i`: from recipe runs only. `consumed_pop_i`: citizen consumption. `sourced_*` / `sunk_*`: explicit events only (genesis endowment, event windfalls/losses, spoilage). `trade_net_*`: net amount moved from the city to player accounts by executed player orders (positive = players receive).
- Wages, taxes and fees are transfers inside the city (never sinks). Rule fees go to `treasury`.
- Every quantity above is emitted in events so a checkpoint can be built from them.

## 8. Pricing rules (`data/pricing.rules.json`) and explanation
`price = clamp(base * (10000 + k_stock*(target - stock)/target + k_dem*(dem_ema - dem_ref)/dem_ref) / 10000, floor, cap)` in bps arithmetic, where `target = target_stock_steps * expected_consumption_per_step`. `explain_price(item, state)` returns a structured reason `{ item, price, base, stock, target, stock_effect_bps, demand_effect_bps, clamp }` and `explain_text()` renders it as a sentence for the tooltip. The same function computes the price (no second implementation).

## 9. Roots
- `business_leaf = leaf(Business)`; `sector_leaf = leaf({idx, kind, owner, arc_origin, rules, businesses_root})` where `businesses_root = H(business_leaf...)` in id order.
- `sector_root_i = sector_leaf`.
- `city_core = leaf({city_id, arc_id, step, stage, citizens, market, treasury, totals})`.
- `city_root = H(sector_root_0, ..., sector_root_5, city_core)`.
- `event_root = H(leaf(event_0), ..., leaf(event_n))`.
- `state_root(step) = H(prev_state_root, leaf({"step": step}), event_root, city_root)`; `prev_state_root` at step 0 is `leaf({"genesis": city_id, "seed": world_seed})`.
- A **sector proof** is the list of the other five sector roots plus `city_core`, enough to recompute `city_root` from one `sector_root`.

## 10. Checkpoint (sim -> contract), `packages/sim/src/checkpoint.ts`
The Rust structs in `contracts/afterhours/src/checkpoint.rs` are the source of truth (amounts are `U128` decimal strings):
```
Checkpoint {
  city_id, from_step, to_step, new_state_root, new_city_root, stage,
  items: Record<item, ItemFlow { produced, consumed_recipe, consumed_pop, sourced, sunk, trade_to_players, trade_from_players }>,
  coin:  CoinFlow { sourced, sunk, trade_to_players, trade_from_players },
  player_deltas: [ { account, token_id, delta_in, delta_out } ],   // token_id is an item id or "coin"
  executed_order_ids: string[]                                       // accepted orders only
}
```
`trade_to_players` = items or coin that leave the city to players; `trade_from_players` = items or coin that enter the city from players. Contract checks: `from_step` equals the stored step; `new_total = old + produced + sourced + trade_from_players - consumed_recipe - consumed_pop - sunk - trade_to_players` (coin: `old + sourced + trade_from_players - trade_to_players`); per-player deltas consistent with the flows; `produced`/`consumed_recipe`/`sourced`/`sunk` within the arc caps; only the operator may submit; no order id executed twice.

**Player orders** (`packages/sim/src/orders.ts`, phase 2): `buy` (player takes items from city businesses at `market.price`, limit price, partial fills), `sell` (player gives items to businesses that use them as input), `invest` (coin into a business; reopens it if closed). The sim never tracks player balances; it only moves city-side coin and items and emits `order_accepted`/`order_rejected` (reasons: `duplicate`, `price_above_limit`, `price_below_limit`, `no_stock`, `no_buyer`, `unknown_business`, `invalid_amount`). **Arc events** (`packages/sim/src/events.ts`, phase 1) are stateless: whether an event starts at step `t` is drawn from a PRNG seeded by `leaf({w, c, s: t})` with probability `event_start_bps`; the active set is re-derived from the previous `max duration` steps, so no state field exists. `recipe_output_bps` is an output multiplier (10000 = normal, 4000 = 40% of normal, 15000 = 150%).

**Verification** (`pnpm verify`): `node packages/verify/cli.ts --arc <id> --seed <s> --city <id> --checkpoints <file> [--orders <file>]` replays from genesis (including the same orders) and compares roots, stage and flows for every checkpoint.

## 11. Events (NEP-297 style JSON, `event` field is the type)
`step_start`, `event_start`, `event_end`, `order_accepted`, `order_rejected`, `business_reopened`, `inventory_sunk`, `produced`, `traded`, `consumed_pop`, `price_update`, `business_closed`, `business_opened`, `dividends_paid`, `capital_injected`, `invested`, `population_change`, `stage_up`, `sector_transfer`, `step_end`. Each carries `city_id`, `step`, and typed integer fields as decimal strings.

## 12. Agent rules (packages/rules) used by the sim
`{ id, when: [cond<=3], do: action, cooldown }`. Conditions: `price(item) op v`, `stock(item) op v`, `season_in([0..3])`, `coin op v`. Actions: `buy(item, qty, max_price)`, `sell(item, qty, min_price)`, `produce(recipe, qty)`. Limits: <=8 rules per agent, qty <= business cap, <=K orders per step, fixed fee per fired rule (to treasury), no loops. Evaluated in listed order. Exact JSON schema is written by task A4.
