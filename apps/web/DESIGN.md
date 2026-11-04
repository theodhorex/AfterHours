# AfterEarth Design System: Fantasy Atlas & Cartographic Living Ledger

## Visual Direction & Philosophy
AfterEarth is an autonomous living world simulation presented as an **illustrated fantasy atlas and merchant ledger**. It captures the texture of hand-drawn cartography, illuminated parchment, and weathered ink, enriched by glowing ember, subterranean moss, and arcane runic accents.

It is decidedly **NOT** a blueprint (Scrip's identity), **NOT** a generic dark-mode SaaS dashboard (indigo gradients and slate-900 boxes), and **NOT** neon cyberpunk.

---

## 1. Palette Tokens

| Token | Hex | Role | Contrast on Canvas (#12100e) | Contrast on Surface (#1f1b16) |
|---|---|---|---|---|
| `--atlas-canvas` | `#12100e` | Deep charred parchment background | Base (N/A) | N/A |
| `--atlas-surface` | `#1f1b16` | Weathered parchment card surface | 1.15:1 | Base (N/A) |
| `--atlas-surface-raised` | `#2b241d` | Elevated panel / active district plate | 1.34:1 | 1.17:1 |
| `--atlas-line` | `#3d3429` | Hairline cartographic borders & dividers | 1.83:1 | 1.59:1 |
| `--atlas-line-strong` | `#5a4c3b` | Districting bounds & structural rules | 2.82:1 | 2.45:1 |
| `--atlas-ink` | `#f0e6d2` | Primary text, titles, headings | **15.33:1 (AAA)** | **13.82:1 (AAA)** |
| `--atlas-ink-muted` | `#bda88e` | Secondary labels, descriptions, metadata | **8.28:1 (AAA)** | **7.46:1 (AAA)** |
| `--atlas-gold` | `#e5b358` | Currency (coin), stage badges, active rings | **9.87:1 (AAA)** | **8.90:1 (AAA)** |
| `--atlas-ember` | `#f07f4f` | Price increase, demand surge, forges | **7.10:1 (AAA)** | **6.40:1 (AA)** |
| `--atlas-moss` | `#6bc785` | Price decrease, supply surplus, agriculture | **9.16:1 (AAA)** | **8.26:1 (AAA)** |
| `--atlas-arcane` | `#b89df5` | Arcane towers, alchemy, chronicle events | **8.30:1 (AAA)** | **7.48:1 (AAA)** |
| `--atlas-alert` | `#f26868` | Shuttered shops, insolvencies, disasters | **6.29:1 (AA)** | **5.67:1 (AA)** |
| `--atlas-ash` | `#827768` | Dormant or inactive structures | **4.64:1 (AA)** | **4.18:1 (UI)** |

---

## 2. Typography
- **Display Serif**: `Cinzel` (`var(--font-cinzel)`), optical display for district banners, settlement header, and section kicks. Evokes chiselled stone tablets and archival fantasy maps.
- **Body & Prose**: `Alegreya` (`var(--font-alegreya)`), warm literary serif created for prolonged reading. Used for chronicle event logs, item notes, and price explanations.
- **Monospace & Numbers**: `JetBrains Mono` (`var(--font-jb-mono)`), crisp tabular figures for coin, item inventory counts, ratios, and simulation timestamps.

---

## 3. Spacing, Rhythm & Responsive Scale
- Fluid container: `max-width: 80rem (1280px)`, gutter `clamp(1rem, 4vw, 2rem)`.
- Responsive floor: 100% functional at **360px viewport width** with a 16px gutter and zero horizontal scrolling.
- Spacing scale: Strict multiples of 4px/8px (e.g. `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`).

---

## 4. Motion & Micro-interactions
- Respects `prefers-reduced-motion`: When reduced motion is requested, all transitions, scales, and pulses drop to `0.01ms`.
- State transitions: Gentle, organic transitions (`150ms ease-out` to `250ms ease-out`) on district selection, tooltip revelation, and keyboard navigation.
- No auto-looping distracting strobe or spinning animations.

---

## 5. Accessibility (WCAG 2.1 AA)
- **High Contrast**: Every text/background pair meets or exceeds the WCAG AA minimum of 4.5:1 (most exceed AAA 7.0:1).
- **Keyboard Navigation**: Interactive map districts, market items, and event filters are fully operable via `Tab`, `Enter`, and `Space`.
- **Focus Rings**: Prominent outline (`2px solid var(--atlas-gold)` with `2px offset`) on all interactive focus targets.
- **Escape Key**: Dismisses open tooltips or overlays cleanly.
- **Screen Reader Announcements**: `aria-expanded`, `aria-describedby`, and polite `aria-live` regions communicate dynamic updates.

---

## 6. What NOT to Do
- ❌ Do NOT use neon cyan/teal or blue grids (Scrip's blueprint language).
- ❌ Do NOT use rounded SaaS cards with deep box shadows or purple gradients.
- ❌ Do NOT hardcode arbitrary magic numbers in component styling.
- ❌ Do NOT cause horizontal layout overflow on narrow mobile viewports (<360px).
- ❌ Do NOT convey status solely through color—always accompany status with icons, tabular arrows, or explicit text tags.

---

## 7. Isometric City View (Procedural Living World)
- **Visual Style & Pixel-Sharp Pipeline**:
  - Top-down angled 2:1 isometric grid (64x32px tiles), wide 16:10 hero framing (min 420px height, responsive 360px floor).
  - **Pixel Art Discipline**: Crisp nearest-neighbour scaling (`scaleMode: "nearest"` on all cached textures, `antialias: false`, `roundPixels: true` on sprites).
  - Stage zooms in integer-friendly 0.25 steps (`clampZoom` snaps to multiples of 0.25 from 0.5x to 3.0x).
  - **1px Dark Outlines**: Buildings, trees, and props feature a 1px darker outline calculated via `outlineColor(hex) = shade(hex, 0.42)`.
  - **Flat Shading (3-4 Tone Steps)**: No blurry or radial gradients. Faces use flat isometric tone steps: top/roof light (`shade(base, 1.25)`), left wall mid (`shade(base, 1.0)`), right wall dark (`shade(base, 0.72)`), and trim/shadow darkest (`outlineColor(base)`).
- **Theme Tokens & Arc Identity (`src/lib/iso/theme.ts`)**:
  - `goblin_warrens`: Purple-moss ground (`#4c3358`), torch-yellow lantern light (`#f59e0b`), giant mushrooms as trees (`treeStyle: "mushroom"`), mushroom-cap cottages and stilted cave huts with lit round windows, purple chimney smoke (`#8b5cf6`), tangled root paths.
  - `cave_hold`: Slate-blue bedrock (`#3b4c5e`), lava orange hearth accents (`#ea580c`), glowing crystal clusters (`treeStyle: "crystal"`), mine rails with iron tracks and timber sleepers, forge sparks.
  - `dino_vale`: Sand dunes (`#9e9067`), dense fern green (`#2d6836`), red earth clay (`#8c3b2b`), giant prehistoric cycad tree-ferns (`treeStyle: "fern"`), bones, dinosaur eggs, footprints, packed dirt tracks.
  - `elf_grove`: Emerald moss (`#1b5e3a`), gold and violet accents (`#8e44ad` / `#e5b358`), ancient great trees with spreading arching canopies (`treeStyle: "great_tree"`), root bridges, fireflies, silver leaf glow.
- **Season Rule (View Only)**:
  - Season is purely visual and calculated strictly from simulation step: `season = step % 4` (0: Spring, 1: Summer, 2: Autumn, 3: Winter; 1 step = 1 season). It never modifies simulation state or state roots.
  - **Spring (0)**: Fresh blooming tones, vibrant flower tufts, spring mist/fireflies, ambient tint `#fff7e6`.
  - **Summer (1)**: Deeply saturated rich colors, bright sun ambient tint `#fff2d6`, lower window glow during daylight.
  - **Autumn (2)**: Amber/rust foliage shift, falling leaves weather particles, warm hearth glow, ambient tint `#ffe4cc`.
  - **Winter (3)**: Snow caps on roofs (`hasSnowCaps: true`), frost-dusted terrain, frozen pale water (`isFrozenWater: true`), thicker chimney smoke (2.0x), bright torchlit windows, cool blue ambient tint `#dce8f5`. Caves shift cavern mist, steam, and forge embers.
- **How to Add a New Arc Theme**:
  1. Add arc config to `ARC_CONFIGS` in `src/lib/iso/theme.ts` specifying `roadStyle`, `treeStyle`, `props`, base hex colors, and window/smoke colors.
  2. Map arc's 4 seasonal weather types in `WEATHER_BY_ARC_SEASON` (`"rain" | "fog" | "falling_leaves" | "snow" | "fireflies" | "embers" | "dust" | "none"`).
  3. If unique tree or house shapes are needed, hook into `drawTreeGraphics` in `sprites-props.ts` or `drawHouseGraphics` in `sprites-buildings.ts`.
- **Terrain & Ground Detail**:
  - Ground tiles feature 3 deterministic coordinate-hash shade variants, wildflower/grass tuft micro-props, sand shorelines along water edges, and road tiles with distinct curb edge lines and corner/T-junction connectivity.
- **Architectural Character & Landmarks**:
  - Residential houses: 4 deterministic arc-specific architectural variants with warm lit windows and progressive stage-level expansions (wings, upper floors, dormers).
  - Unmistakable Sector Landmarks:
    - `food` (Farm): Gambrel barn, tall grain silo, crop furrow rows, and spinning windmill.
    - `ore` (Mine): Heavy timber A-frame headframe portal, ore cart on iron rails, and mineral rock mounds.
    - `forge` (Smithy): Heavy stone smithy with huge industrial chimney stack and blazing furnace mouth.
    - `alchemy` (Lab): Cylindrical stone tower with bubbling translucent glass observation dome and copper pipes.
    - `harbor` (Port): Broad wooden pier wharf, moored cargo boat hull with mast, and timber crane derrick.
    - `tower` (Citadel): Tall tapering municipal spire with battlements, waving pennant, and glowing arcane apex beacon.
  - Ruined variants: Distinct collapsed silhouette with jagged broken roofs, leaning splintered timbers, no window light, and red structural distress marks.
- **Living City Motion Rules & Weather Particles**:
  - Ambient life animations include chimney smoke rising from active workshops and houses (purple smoke for goblins, winter thickness scaling), gentle swaying treetops, water shimmer, and walking citizens and merchant carts.
  - Weather particles: Low-count pooled particle layer strictly capped at <= 80 particles in `IsoWeatherManager` (rain streaks, snow flakes, tumbling autumn leaves, floating fireflies, rising forge embers, or spore fog). Zero per-frame allocations.
  - Motion is strictly governed by `prefers-reduced-motion`: When active, the ticker completely stops, weather particles hide, and all objects remain static.
- **Performance Discipline (60 FPS Target)**:
  - Procedural sprites are generated once into reusable textures via `IsoTextureManager` (cached by kind, arc, season, variant, and connection mask with nearest-neighbour scaling).
  - Pre-allocated sprite pools for actors, weather particles, and smoke; strictly zero object allocation or graphics recreation per animation frame.
- **Accessibility & Contrast**:
  - Canvas carry `role="img"` with live descriptive `aria-label` detailing settlement name, year, population, open shops, and ruined counts.
  - Full keyboard parity via tab-navigable municipal district button list with 2px gold focus rings.
  - Interactive click-vs-drag protection: panning movements (>4px threshold) never inadvertently select buildings or sectors.
  - Hover and selection badge plates utilize opaque charred canvas backing (`#12100e`) ensuring AAA text contrast (15.3:1).

---

## 8. Audit Panel (Browser-Side Replay Verification)
- **Visual Style & Philosophy**:
  - Presented as the municipal notary and cartographic living ledger audit seal.
  - Uses parchment tokens: charred canvas backing (`--atlas-surface`), hairline borders (`--atlas-line`), gold accents (`--atlas-gold`) for verified/active states, and ember/alert badges (`--atlas-alert`) for caught mismatches.
- **Copy Standards**:
  - Honest disclosure: *"Checkpoints here are built in your browser (mock mode, no chain). On a deployment the operator publishes them to NEAR and anyone can run this same check."*
  - Rule hash transparency: *"rules hash (compare with the on-chain value in a real deployment)"*
- **Accessibility & Interaction (WCAG 2.1 AA)**:
  - Screen reader feedback: Results announce through an `aria-live="polite"` region with `role="status"` and `aria-atomic="true"`.
  - Chunked execution: Audits execute asynchronously in small windows (`setTimeout` / event loop yield) so the main thread never freezes during deep replays.
  - Progress indicator: Visual and screen-reader accessible progress bar (`role="progressbar"`) displaying completed vs total windows.
  - Keyboard navigation: Full tab, enter, and space operable controls with 2px gold focus outlines (`atlas-focus`).
  - Responsive down to 360px viewport: Hash strings use `break-all`, controls wrap gracefully, and horizontal checkpoint chains scroll smoothly without page blowout.
- **Panel States**:
  - *Empty State* (< 40 steps): Audit button disabled with explicit hint ("advance at least 40 steps"), guidance notice.
  - *Ready State* (>= 40 steps): Audit button enabled, state root chain cards display window range and first 12 hex digits of the state root.
  - *In-Progress State*: Animated spinner, progress bar active, inputs temporarily disabled.
  - *Verified State*: High-contrast moss banner (`--atlas-moss`) affirming replayed consistency: `"VERIFIED: N checkpoints match the replay"`.
  - *Mismatch / Tampered State*: Alert badge (`--atlas-alert`) displaying exact difference reason (e.g. `produced amount mismatch`, `new_state_root mismatch`, `stage mismatch`).

---

## 9. Agents Panel (JSON Rule Editor, Backtest & Verified Leaderboard)
- **Visual Style & Philosophy**:
  - Presented as the municipal ledger's autonomous trading desk and merchant contract registry.
  - Consistent fantasy parchment theme: charred canvas backing (`--atlas-surface`), hairline borders (`--atlas-line`), gold accents (`--atlas-gold`) for actions and primary triggers, moss (`--atlas-moss`) for gains and verification badges, and ember/alert (`--atlas-alert`) for losses and syntax errors.
- **Copy Standards**:
  - Honest copy: *"Anyone can re-run this agent on the same seed and get the same score and state root (mock mode, no chain)"*.
  - Rule limits and trade conditions clearly explained (8 rules, 3 conditions, 4 orders/step, 2 coin fee/rule).
  - Clarifies that autonomous agents execute only while the player is offline in a deployed version.
- **Accessibility & Interaction (WCAG 2.1 AA)**:
  - Screen reader live regions: `aria-live="polite"` region communicates real-time schema validation feedback.
  - Progress feedback: Asynchronous chunked execution during backtest simulation yields to the event loop and announces status.
  - Accessible forms & controls: Form controls have explicit `<label>` associations, monospace textareas have spellcheck disabled, and buttons feature 2px gold focus rings (`atlas-focus`).
  - Table a11y: `<caption>` with screen-reader announcement, structured column headers (`scope="col"`), and responsive horizontal scroll wrapper ensuring zero layout blowouts at 360px.
- **Panel States**:
  - *Ready / Idle State*: Preset selected, JSON editor populated and validated, backtest button active.
  - *Syntax / Schema Error State*: Monospace error callout highlighting offending rule property or syntax issue; backtest trigger disabled.
  - *Simulating State*: Animated progress indicator and disabled buttons preventing duplicate runs.
  - *Verified Leaderboard State*: Interactive rankings displaying score, trades, 12-char root preview, and instant "Re-verify" checking.
  - *Storage Fallback State*: Gracefully functions in in-memory state when local storage access is restricted or throws.

