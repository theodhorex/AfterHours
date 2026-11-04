# AfterEarth

**A fantasy economy you can audit: four cities trade around the clock, cities can be sold, and every season of history can be replayed and checked against a root hash on NEAR.**

Four fantasy cities run a full supply chain: farms, mills, bakeries, forges, workshops, alchemists. Citizens eat, businesses hire, some go bankrupt, and new entrepreneurs open shops. One step is one season. The simulation is deterministic and has no dependencies, so anyone can rebuild the same history from the same seed and compare it with the roots the contract stores. The working title was AfterHours; the product name is AfterEarth.

Built for the **NEAR HACKATHON**, track **Games With Real Economies**. Code started on 2026-11-04. Status: work in progress, testnet only.

- **Contract (v3, with city market, 4 cities published):** [`afterhours-11042120-theo.testnet`](https://testnet.nearblocks.io/address/afterhours-11042120-theo.testnet)
- **Network:** NEAR testnet, no real funds
- **Repository:** https://github.com/theodhorex/AfterHours
- **AI assistance and libraries:** [`docs/AI_AND_LIBRARIES.md`](docs/AI_AND_LIBRARIES.md)

## Try It in Two Minutes

You need Node 24 or newer. No install step for the simulation (TypeScript runs natively, zero dependencies).

1. **Do:** `git clone https://github.com/theodhorex/AfterHours && cd AfterHours`
2. **Do:** `node scripts/demo_mock.ts`
   **See:** 200 steps in five windows, then `VERIFIED: 5 checkpoints match the replay`.
3. **Do:** `cd apps/web && pnpm install && pnpm dev`, open http://localhost:3000.
   **See:** an isometric pixel-art city. Pick a world, press **Fast-Forward**.
4. **Try:** open the **Audit** panel and press **Tamper with checkpoint 2**.
   **See:** `MISMATCH ... new_state_root mismatch at step 80`. The replay caught the edit.
5. **Try:** open **Trade routes** and run the 400-step caravan world.
   **See:** Dino Vale ships bread to Elf Grove, both cities book the flows, badge **Conservation: OK**.

> Note: `pnpm verify` replays the current engine. A city published to testnet by an older engine version will not match until it is republished (see Limits).

## Developer Setup

**Tests.**

```bash
node --test packages/sim/test/         # simulation, caravans, growth (162 tests, 2026-11-04)
node --test packages/verify/test/      # replay verifier
cd apps/web && node --test test/       # web logic, audit, a11y (109 tests)
cd contracts/afterhours && cargo test --lib   # contract (95 tests)
```

**Replay a checkpoint file against the engine.**

```bash
node packages/verify/cli.ts --arc goblin_warrens --seed demo --city city-goblin_warrens --checkpoints demo/checkpoints.json
```

**Publish a city to your own testnet account.** Needs the `near` CLI and an account whose key is in the legacy keychain. Testnet only.

```bash
cd contracts/afterhours && cargo build --release --target wasm32-unknown-unknown
node scripts/testnet_publish.ts <your-account>.testnet
```

## The Problem

Game economies are black boxes. Players cannot tell whether prices, scarcity and rewards are fair, "500 years of history" is a database the operator can edit, and assets such as cities and designs are sold without any proof of what they were.

AfterEarth makes the history itself the product: a deterministic world whose every root hash is stored on-chain and can be recomputed by anyone.

## How It Works

```
step (one season)  ->  events, state root, per-sector Merkle roots
40 steps           ->  Checkpoint { item flows, coin flows, roots, order ids }
contract           ->  check arc caps, check conservation, store roots
verify / Audit     ->  replay from the seed, compare every root, report the first step that differs
```

Conservation per item, enforced on every checkpoint:

```
old_total + produced + sourced + from_players  >=  consumed + sunk + to_players
```

```mermaid
sequenceDiagram
    participant Op as Operator
    participant Sim as packages/sim
    participant C as NEAR contract
    participant V as verify / Audit panel
    Op->>Sim: step x 40 (seed, arc, rules)
    Sim-->>Op: events, roots, flows
    Op->>C: submit_checkpoint
    C->>C: caps and conservation, store roots
    V->>Sim: replay from the same seed
    V->>C: get_city (state_root, step)
    V-->>V: VERIFIED or MISMATCH at step N
```

## Features

**Four arcs.** Goblin Warrens, Cave Hold, Dino Vale, Elf Grove. Each has its own recipes, prices, events, palette and signature props.

**Living cities.** Bankruptcies, new entrepreneurs, population growth through stages, four seasons per year.

**Audit.** A browser replay with a tamper demo, plus a button that compares the replayed root with the city root stored on NEAR through the public RPC.

**City market.** `list_city`, `cancel_listing`, `buy_city` with an NEAR payout to the seller.

**Agents.** A small rule language (at most 8 rules, 3 conditions each, a fee per rule) with a backtest score anyone can reproduce, and a leaderboard.

**Inter-city caravans.** Goods move between two cities; the seller records a sink and receives coin, the buyer records a source and pays coin. Per-city conservation holds and the sum over both cities is unchanged.

**Isometric view.** Pixel-sharp rendering, fixed bright daytime, per-season variants, clickable icon bubbles (hungry citizens, idle shops, events, trades).

## Security: Threat Model

| ID | Threat | Defence | Test |
|---|---|---|---|
| T1 | Operator edits history | hash chain plus replay, first differing step reported | `tamper`, `root_vectors` |
| T2 | Operator inflates the city economy | per-arc caps on produced, consumed, sourced, sunk; per-checkpoint conservation | `checkpoint_tests` |
| T3 | Operator mints player assets | **mitigated, not closed**: genesis totals are bounded and item ids must belong to the arc; items sent to players per checkpoint cannot exceed the arc sink cap times the steps. Full escrow of player deposits is still open | `checkpoint_tests`, review finding 1 |
| T4 | Selling a city you do not own | owner check in `list_city` | `market_tests` |
| T5 | Storage drain through dust transfers | `storage_deposit` required for receivers | `RECEIVER_NOT_REGISTERED` tests |
| T6 | TS and Rust disagree on caps or shapes | differential tests against a generated fixture | `arc_caps_fixture`, `differential_tests` |
| T7 | Replay of an old checkpoint | `from_step` must equal the stored step | `checkpoint_tests` |

An independent review of the contract (a different model from the one that wrote the code) found 14 issues on 2026-11-04: 1 high (T3), 4 medium, the rest low or informational. The fixes (bounds, root-pinned purchases, callback payouts with a claimable balance, capped mints) landed the same day; see the Progress Log.

## Measured on Testnet

Contract v3: [`afterhours-11042120-theo.testnet`](https://testnet.nearblocks.io/address/afterhours-11042120-theo.testnet). Four cities, 200 steps each (2026-11-04, engine at commit dc4f4b2): 4 arcs registered, 4 cities created, 20 checkpoints accepted, all by the same contract that checks conservation and caps on-chain.

| City | State root at step 200 | Arc | City tx | Checkpoints (0-40, 40-80, 80-120, 120-160, 160-200) |
|---|---|---|---|---|
| `city-goblin_warrens` | `22adb8808d9e0b7b3f4dfc1e1cac49a09c52ff1c975cc6c643045cac7c92bd6b` | [`DEYJE8v2...x3`](https://testnet.nearblocks.io/txns/DEYJE8v2v4PomNyzUdfMBkyBV9S81YNym36XEFp1Trx3) | [`G8taL327...3E`](https://testnet.nearblocks.io/txns/G8taL327LnhEYyRvPEHVJJsZrKanxh4uMWSV2ggvbk3E) | [`2gzqBXu6...Ak`](https://testnet.nearblocks.io/txns/2gzqBXu6Lwz2uARq5qE6ANto72hJ2ibtmCB7nwBFFgAk) · [`92yFRdua...D2`](https://testnet.nearblocks.io/txns/92yFRduawFqiCnNE9iViHt2RkCvYT8tJr6AZJKUWygD2) · [`3NXVn5qr...sb`](https://testnet.nearblocks.io/txns/3NXVn5qrvgXL7KAyZgCrN4ADsKG6frqjrDJcqaeAQosb) · [`6ZeqtG5G...zq`](https://testnet.nearblocks.io/txns/6ZeqtG5GKY2sobnekrtYQyaP1Dc4ieG4vTWeis9KLgzq) · [`AoQGP9vF...YM`](https://testnet.nearblocks.io/txns/AoQGP9vF18aagGrdszxpZSgJcpeQ7GF37nqNASHvUYM) |
| `city-cave_hold` | `e734d48cc95e0d9a1abc6fc718915523840daf47d3c85c051e5f1d5f096a9e01` | [`2XSt3gDt...zc`](https://testnet.nearblocks.io/txns/2XSt3gDt28CWHvG6qVsXhVT9hTwpNxBMQ3du8UsAeazc) | [`HkVSzGVt...93`](https://testnet.nearblocks.io/txns/HkVSzGVt2KvNcD518ETKwAmR6sjnQFku3JAAJyq5Fo93) | [`BheNsrmz...tk`](https://testnet.nearblocks.io/txns/BheNsrmztwW7AzTQ7Uci7qeTS6pZ1277zpsPC19xtCtk) · [`4wajMN7C...GY`](https://testnet.nearblocks.io/txns/4wajMN7CywjeLZe1QoZj3CHQCwpwW6psVj5mB82iZEGY) · [`GhYr8zC1...sb`](https://testnet.nearblocks.io/txns/GhYr8zC1GVqKwFNPFQEXqjro1RWrNR4Wu6L5XYxMQPsb) · [`DNkMgdVJ...wz`](https://testnet.nearblocks.io/txns/DNkMgdVJn7MtGwggJg5Y6DmtQK3bhViQn2EhASSaXvwz) · [`87jf1Gji...dc`](https://testnet.nearblocks.io/txns/87jf1GjiQ9jJScAt3bc6pZaquUrp4QvFPrbKFrHuYudc) |
| `city-dino_vale` | `f5923ad9516c8815d5b6f9f60d0cc1b3bdbaf720f58863b8de0a1b5345b68bb4` | [`Deabt1Cu...3P`](https://testnet.nearblocks.io/txns/Deabt1CuYf2VNVkrfKE6ncNZNXnmt2jJrdEG1EKirb3P) | [`GjWQhbpi...XX`](https://testnet.nearblocks.io/txns/GjWQhbpijy2zWH5P8s6WW2iKNQNuLuutGUNvQjJxjyXX) | [`J28xXzok...9h`](https://testnet.nearblocks.io/txns/J28xXzokwWDUiY2bnZtrmpfW5ybrvXpkiXAvqFbQeo9h) · [`72ytUY32...zy`](https://testnet.nearblocks.io/txns/72ytUY32psX1u6sav6PVHRTz2daBgJdjCw1bUNP29Szy) · [`8kU1YD9H...rc`](https://testnet.nearblocks.io/txns/8kU1YD9HEiJm5YajrD2bxxZCvo5m33Fcxf2E2RNwR5rc) · [`3ffGWGcJ...EB`](https://testnet.nearblocks.io/txns/3ffGWGcJpGrrDMMX4tmzNNLxsvThJpqfZLvX2TW2UcEB) · [`HsZzrRNL...wD`](https://testnet.nearblocks.io/txns/HsZzrRNLGWhFv916YneCyLypkaf8kNyp3bDMCYzbn9wD) |
| `city-elf_grove` | `4f7ab4ab4eb5f87b52481f6ab37aeeb1d6b6af3689d313ceadb205c67d680e08` | [`EWHYRWyr...uz`](https://testnet.nearblocks.io/txns/EWHYRWyrSXpSn6aE4DRKJXg1X16ywMvQvBnBVSJXdWuz) | [`AqWxqN9p...yz`](https://testnet.nearblocks.io/txns/AqWxqN9pKyguSjZTA23ghinnexUF24BsRmKyCyvBCjyz) | [`9ZBZDwwy...yd`](https://testnet.nearblocks.io/txns/9ZBZDwwyJ3yugijaNZdSt2B2EBbCUMj5eGtBmHHusvyd) · [`HTPCdKKZ...wZ`](https://testnet.nearblocks.io/txns/HTPCdKKZDmsJJcBowkyRnwLrXswCQTwwwGzeDkhq4uwZ) · [`B7mUvYNq...xz`](https://testnet.nearblocks.io/txns/B7mUvYNq2ZYWqxYo3a1eMDbozVvNCGJp9aM2Arj7Tcxz) · [`41Z9Dg9K...u1`](https://testnet.nearblocks.io/txns/41Z9Dg9K9z7ro9hLNqxRs8oa5HwrM3pP2nB7cecwk8u1) · [`Hs1uP8dz...mJ`](https://testnet.nearblocks.io/txns/Hs1uP8dzx8KBp9kVSYYzSdDVJbfZh94fcm47RUhHjumJ) |

Check one yourself: `near contract call-function as-read-only afterhours-11042120-theo.testnet get_city json-args '{"city_id":"city-goblin_warrens"}' network-config testnet now`, then replay with `node scripts/testnet_publish.ts` logic or the browser Audit panel and compare the root.

Earlier contracts (v1 `afterhours-11041910-theo.testnet`, v2 `afterhours-11042023-theo.testnet`) were built by earlier engine versions and are kept only as history; they are not replay targets.

## What NEAR Makes Possible Here

- **Cheap, public checkpoints.** A root and a few flow counters per 40 steps fits easily in a transaction, so every season stays checkable.
- **Fast finality.** A buyer can wait for a checkpoint to land before paying for a city.
- **Native accounts and storage accounting.** Receivers register with `storage_deposit`; dust attacks cost the attacker.
- **Public RPC.** The browser Audit panel reads the city root straight from NEAR, with no server of ours in the loop.

## Limits, Stated Plainly

- **Testnet only.** No real funds, no mainnet deployment, no token launch.
- **The operator is trusted for availability, ordering and fairness of orders.** History is checkable by replay and the city economy is conserved on-chain. Genesis totals and player-bound transfers are now capped but still operator-declared; full escrow of player deposits is not built yet (finding 1 of the review).
- **City sales are paid in NEAR on testnet, not in game coin.** The sale price is not part of the replayed economy.
- **Caravans are checked per city, not settled jointly on-chain.** Each city's checkpoint must conserve; the contract does not see the counterparty.
- **The economy is tuned, not proven.** Stage and population reach differ per arc and seed; see the Progress Log for the current numbers. We make no claim of emergent behaviour.
- **Replay needs the same engine.** A city published by an older engine will show `MISMATCH` against a newer one by design.

## Progress Log

Updated after each accepted milestone.

| Date | Milestone |
|---|---|
| 2026-11-04 | Repo started. Deterministic simulation, conservation, checkpoints, replay verifier, contract with NEP-245 style balances |
| 2026-11-04 | First testnet city: on-chain state root matched the local replay at step 200 |
| 2026-11-04 | City market, TS vs Rust differential tests, browser Audit against the NEAR root |
| 2026-11-04 | Four arc themes, icon bubbles, inter-city caravans (library, world runner, web panel), clean production build from a fresh copy |
| 2026-11-04 | Accessibility pass: AA contrast, 44 px touch targets, scroll regions, live status, reduced motion |
| 2026-11-04 | Independent contract review: 14 findings (1 high, 4 medium) |
| 2026-11-04 | Contract fixes: item and cap bounds, `buy_city` pinned to the audited root, callback payouts with `claimable` balance, mint cap (95 contract tests) |
| 2026-11-04 | Growth engine fixes (stock-cap closure, entry rules) and Elf Grove forager grain 2 to 4: every arc reaches stage 2 or higher on 4 seeds, 0 bankruptcies; satisfaction still below 80% in some arcs and seeds (Dino Vale 64-71%, Elf Grove 62-79%) |
| 2026-11-04 | Four cities (200 steps each) published to contract v3: 20 checkpoints accepted on testnet |
| 2026-11-04 | Growth engine fix: a stock-cap rule mismatch closed healthy businesses. Dino Vale now reaches stage 4 on three seeds, Cave Hold stage 2; Elf Grove still stalls at stage 1 (in progress) |

## Repository Layout

```
data/        arc definitions, pricing and growth rules, generated fixtures
packages/
  sim/       deterministic engine, checkpoints, caravans, world runner
  rules/     agent rule language and backtest
  verify/    replay CLI
contracts/
  afterhours/  NEAR contract (Rust, near-sdk 5)
apps/
  web/       Next.js frontend (isometric view, Audit, Trade routes, Agents)
scripts/     demo_mock, testnet_publish, gen_arc_caps, economy_report
docs/        data contract, AI and library disclosure
```

## Built With

- TypeScript on Node 24+ for simulation, rules and verifier (no dependencies)
- Rust and near-sdk 5.30 for the contract
- Next.js 16, React 19 and PixiJS 8 for the web app
- All sprites are drawn procedurally; no third-party art

## Hackathon Notes

- Code started 2026-11-04. The author also submits a separate NEAR project, Scrip; each README links the other.
- AI assistance was used throughout (planning, review, code generation); details in [`docs/AI_AND_LIBRARIES.md`](docs/AI_AND_LIBRARIES.md).

## License

MIT.

## About

AfterEarth: a world whose history anyone can replay. Do not trust the operator, check the roots.
