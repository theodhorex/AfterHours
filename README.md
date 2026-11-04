# AfterHours (working title)

A fantasy world where merchant NPCs trade around the clock, cities and sectors can be sold, and the whole 500-year history can be replayed and checked against a root hash on NEAR.

**Status: work in progress.** Built for the NEAR HACKATHON (track: Games With Real Economies). Code in this repository was started on 2026-11-04. This README will be rewritten with a "Try it in two minutes" walkthrough, a threat-model table and a "Limits" section once the first playable slice exists.

## Layout

```
data/        arc definitions, pricing rules, fixtures (single source of truth)
packages/    sim (deterministic simulation), rules (agent rule language), verify (replay CLI)
contracts/   afterhours (NEAR smart contract, Rust, near-sdk)
apps/        web (frontend), operator (tick and checkpoint runner)
docs/        data contract, threat model, limits
```

## Run the tests

Requires Node 24+ (TypeScript runs natively, no build step, no dependencies) and Rust (for the contract).

```
make test
```

## Hackathon notes

- Code started 2026-11-04. The author also submits a separate NEAR project, Scrip (Q-015); each README links the other.
- AI assistance was used during development; libraries and AI-written code are listed here as the project grows (Q-005).
- Testnet only. No real funds. No secrets are committed.

License: MIT.
