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
- **Visual Style**: Top-down angled 2:1 isometric grid (64x32px tiles), wide 16:10 hero framing (min 420px height, responsive 360px floor), inspired by TheoTown-style procedural simulation aesthetics without copying any proprietary game art.
- **Arc Palette Themes**:
  - `goblin_warrens`: Mossy vibrant green ground (`#4c6632`, 3 shade variants), damp grey stone (`#55585e`), amber lantern light (`#f59e0b`), deep slate water (`#265f7c`) with cyan foam shores (`#64b4d6`).
  - `cave_hold`: Warm tans and ochre ground (`#8a6842`, 3 shade variants), clay and bone stone (`#69594d`), warm gold hearth accents (`#e5b358`), subterranean river (`#25566c`).
  - `dino_vale`: Lush swamp greens (`#387d2f`, 3 shade variants), rich teal water (`#1b7d75`) with foam trim (`#42cfc2`), amber and orange accents (`#eb8828` / `#f39c12`), ancient flagstone roads.
  - `elf_grove`: Fresh light greens (`#4f9c52`, 3 shade variants), silver quartz stone (`#6a7880`), silver leaf and moon-blue water (`#2b78ad`), pale arched wood.
- **Terrain & Ground Detail**:
  - Ground tiles feature 3 deterministic coordinate-hash shade variants, wildflower/grass tuft micro-props, sand shorelines along water edges, and road tiles with distinct curb edge lines and corner/T-junction connectivity.
  - Three distinct procedural tree types (conifer, broadleaf, slender fantasy birch) with soft drop shadow ellipses.
- **Architectural Character & Landmarks**:
  - Residential houses: 4 deterministic arc-specific architectural variants with warm lit windows and progressive stage-level expansions (wings, upper floors, dormers).
  - Unmistakable Sector Landmarks:
    - `food` (Farm): Red/timber gambrel barn, tall grain silo, crop furrow rows, and spinning windmill.
    - `ore` (Mine): Heavy timber A-frame headframe portal, ore cart on iron rails, and mineral rock mounds.
    - `forge` (Smithy): Heavy stone smithy with huge industrial chimney stack and blazing furnace mouth.
    - `alchemy` (Lab): Cylindrical stone tower with bubbling translucent glass observation dome and copper pipes.
    - `harbor` (Port): Broad wooden pier wharf, moored cargo boat hull with mast, and timber crane derrick.
    - `tower` (Citadel): Tall tapering municipal spire with battlements, waving pennant, and glowing arcane apex beacon.
  - Ruined variants: Distinct collapsed silhouette with jagged broken roofs, leaning splintered timbers, no window light, and red structural distress marks.
- **Living City Motion Rules**:
  - Ambient life animations include chimney smoke rising from active workshops and houses, gentle swaying treetops, water shimmer, and walking citizens and merchant carts traversing the road network.
  - Traffic counts scale with population and active businesses, capped strictly at 40 mobile actors for predictable load.
  - Motion is strictly governed by `prefers-reduced-motion`: When active, the ticker completely stops and all objects remain static.
- **Performance Discipline (60 FPS Target)**:
  - Procedural sprites are generated once into reusable textures via `IsoTextureManager` (cached by kind, arc, variant, and connection mask).
  - Pre-allocated sprite pools for actors and particle effects; strictly zero object allocation or graphics recreation per animation frame.
- **Accessibility & Contrast**:
  - Canvas carry `role="img"` with live descriptive `aria-label` detailing settlement name, year, population, open shops, and ruined counts.
  - Full keyboard parity via tab-navigable municipal district button list with 2px gold focus rings.
  - Interactive click-vs-drag protection: panning movements (>4px threshold) never inadvertently select buildings or sectors.
  - Hover and selection badge plates utilize opaque charred canvas backing (`#12100e`) ensuring AAA text contrast (15.3:1).
