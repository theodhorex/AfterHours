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
- **Visual Style**: Top-down angled 2:1 isometric grid (64x32px tiles), inspired by procedural simulation aesthetics without copying any proprietary game art.
- **Arc Palette Themes**:
  - `goblin_warrens`: Damp cavern stone (`#2b241d`), dark timber (`#1f1b16`), and ember beacon lights (`#f07f4f`).
  - `cave_hold`: Earthy mud huts (`#30251c`), dark stone (`#231a13`), and bone/hearth amber highlights (`#e5b358`).
  - `dino_vale`: Primordial swamp green (`#3b5229`), amber fossil highlights (`#d48a37`), and river wetlands.
  - `elf_grove`: Pale ancient wood (`#50493f`), silver leaf highlights (`#8ec3b0`), and starlight blues (`#23576e`).
- **Accessibility & Keyboard Parity**:
  - Main canvas viewport carries `role="img"` and descriptive `aria-label` summarizing settlement name, year, population, open establishments, and insolvent shops.
  - Dedicated interactive district selection list below canvas offers full keyboard navigation parity with focus rings.
  - Screen controls provide explicit, accessible zoom-in, zoom-out, and recenter `<button>` elements.
- **Motion & Resource Discipline**:
  - Strictly respects `prefers-reduced-motion`: When active, ticker loops and particle emissions (chimney smoke, water shimmer) are completely stopped.
  - Pre-renders procedural sprites into reusable textures (`generateTexture`) to avoid per-frame redraw bottlenecks.
