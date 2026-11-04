# AI assistance and third-party code (hackathon disclosure, Q-005)

Code in this repository was started on **2026-11-04**. This file lists what was written with AI help and every library used. It is updated as the project grows.

## AI assistance
- **Planning, review and project management**: Claude (Anthropic) acted as project manager: wrote the PRD, task specifications, reviewed every worker result by re-running tests and reading diffs, and fixed defects directly.
- **Code generation**: implementation tasks were delegated to AI workers (Gemini 3.8 Flash and Claude Sonnet 5.5 through the Antigravity CLI), each with a written task file, forbidden-file list and acceptance tests. Workers did not commit; every commit was made after review.
- **Independent review**: a different model reviews the contract's security (see `.agy/results/` is not published; findings are summarised in the README threat model once resolved).
- **What is human**: product idea, game rules and direction, the decision to build this project, testnet account approval, and the final submission are the author's.
- **Art**: all sprites are drawn procedurally in code. No third-party game art, fonts or images are used.
- **Tests as the guard**: simulation, verifier and contract have tests written before or alongside the code; AI output is accepted only when the suites pass.

## Libraries
| Where | Library | Version | Purpose |
|---|---|---|---|
| contract | near-sdk | 5.30.0 | NEAR smart contract SDK |
| contract | serde_json | 1.0 | event serialisation |
| contract (tests) | near-workspaces, tokio, proptest | 0.24.0, 1.52.3, 1.12.0 | sandbox and property tests |
| web | next, react, react-dom | 16.4.3, 19.3.0 | frontend |
| web | pixi.js | 8.22.0 | isometric renderer |
| web (dev) | tailwindcss, typescript, eslint | 4.x, 5.x, 9.x | styling, types, lint |
| sim, rules, verify | none | | TypeScript on Node 24+, no dependencies |

## Licence
MIT. No code was copied from other projects; designs of well-known games were used only as general inspiration for the look, not copied.
