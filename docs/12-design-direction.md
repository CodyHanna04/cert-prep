# 12 — Design Direction & Theming

You don't want the app to look like generic AI-generated "slop," you do like parts of how those sites look, you want **several themes/versions to try and take notes on**, and you chose **Tailwind**. This doc sets constraints and a theming approach that works with Tailwind. It does not pick a design.

## 1. What "slop" usually means (avoid)

- The same purple-to-blue gradient, glow orbs and blurred blobs behind everything.
- Glassmorphism on every surface; identical rounded cards with no hierarchy.
- Emoji or a default icon set standing in for visual identity.
- **Tailwind's default palette, radii and shadows left untouched**, and component-library styling used as-is; a single default font.
- A marketing hero, fake stats, testimonials or pricing on an app that has none of those.
- Animation for its own sake; bouncy hover effects on everything.

## 2. What's worth keeping from those sites

- **Dark-mode-first dashboards** with strong contrast and a clear data palette.
- **Bento-style card grids** where card size follows importance.
- **Crisp typography** with tight spacing; tabular numerals for stats.
- **Subtle, purposeful motion:** state changes, progress fills, number counts; fast and reducible.
- Polished empty states and loading skeletons.

## 3. Theme system (build before any real styling)

**Goal:** swapping a whole look is a one-file change, so you can test versions and compare notes.

- **Two token layers.** *Primitives:* palette ramps, type scale, spacing, radii, durations. *Semantic tokens:* `surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `focus`, five **status colors** (No questions / Not started / In progress / Needs work / On target), `chart-1…n`, `shadow`, `radius-card`, `radius-control`, density, font families, motion. **Components use only semantic tokens.**
- **A theme = one CSS file** that sets the semantic variables under `[data-theme="<name>"]` on `<html>` (light and dark via `data-mode`), plus fonts, radius, density and border-vs-shadow elevation.
- **Themes differ in character, not just color:** radius, density, type pairing, chart palette, and how the blueprint map draws its tiles (gaps, corners, label placement) all read tokens.
- **Switching:** theme picker in the Account menu, stored per user in the database, falling back to the system light/dark setting; `?theme=` in development.
- **Theme lab** (`/dev/theme-lab`): one page rendering the component sheet with *real* objective names and sample progress under any theme, with split-screen compare and a phone-width toggle. Dev builds and the owner only.
- **Notes:** one markdown file per theme in [design-notes/](design-notes/README.md), from a template (what works, what doesn't, scores, screenshots, decision), plus an index.

### How this works with Tailwind v4 (from memory; verify against its docs ❓)

1. Theme files define plain CSS variables (`--surface`, `--accent`, `--status-on-target`, …) under `[data-theme]`.
2. In the main stylesheet, an `@theme` block **resets Tailwind's default color namespace** (`--color-*: initial`) and then exposes the semantic variables as utilities (`bg-surface`, `text-muted`, `border-border`, `fill-status-on-target`). Using the `inline` form of `@theme` makes utilities read the variable at runtime, which is what lets one `data-theme` attribute change everything.
3. With the default palette removed, stray classes like `bg-blue-500` produce nothing, which doubles as a guard against the generic look; a lint rule also bans arbitrary-value colors (`bg-[#…]`) and fixed pixel font sizes.
4. Spacing, radius, font and shadow scales are set the same way, so a theme can change density or corner style.
5. D3 SVG elements use the same variables (`fill: var(--status-needs-work)`), so the map and charts follow the theme too.

### Starter directions to test (suggestions, not decisions)

| Name | Character |
|---|---|
| **Ledger** | Editorial/print: warm off-white, serif display with mono numerals, hairline borders, sharp corners, minimal color. The map as flat blocks with thin gaps. |
| **Control room** | Dark instrument panel: near-black, one saturated signal color, grotesk + mono type, dense grid, status as small indicator lights. |
| **Atlas** | Cartographic: muted earthy legend-like palette, medium radii, map-first layout, light contour texture only on the map. |
| **Soft modern** | Closest to what you like in vibe-coded sites: dark bento cards, restrained gradients, glow only on focus/primary. A control group for comparison. |

## 4. UI toolkit

Decided: **Tailwind CSS v4** for styling. This section compares the other two choices that remain: the **behavior library** and the **chart/map approach**. Library facts below come mostly from 2026 comparison blogs found by search, not each project's own pages, so check release pages before the first UI ticket ❓.

### 4.1 Tailwind (decided), for the record

- **Benefits:** fast to write; styles live next to markup; with our token mapping, themes swap by one attribute.
- **Drawbacks:** its default palette, radii and shadows are a large part of the generic look (we remove them); long class lists in markup (mitigated by small components); needs the discipline described in §3.

### 4.2 Behavior libraries ("headless" components)

A headless library gives you **behavior and accessibility** (keyboard navigation, focus handling, ARIA roles, screen-reader announcements) with **no styling**; you style it with Tailwind. This app needs: dialog (confirmations), dropdown menu (account, exam switcher), select, tabs (objective detail), tooltip/popover, **radio and checkbox groups (the answer options, the most-used interaction)**, switch, progress, toasts. It does **not** need a data grid or rich text; the exam date can be a native `<input type="date">`.

| Option | What it is | Benefits | Drawbacks |
|---|---|---|---|
| **React Aria Components** (Adobe) | Component layer over Adobe's React Aria hooks | Deepest accessibility and internationalization (one source cites a screen-reader test matrix across JAWS, NVDA, VoiceOver, TalkBack ❓); described as mature and stable since 2023; the largest component set (including date picker, calendar, combobox, table); UI state exposed as `data-*` attributes (`data-pressed`, `data-selected`, `data-focus-visible`) that Tailwind targets directly, with an optional plugin for shorter variants | More verbose API and its own concepts (collections, slots, render props); steeper to learn; fewer copy-paste snippets online |
| **Radix Primitives** | Unstyled composable components (Root / Trigger / Content) | Very widely used; simple API; the most tutorials and examples; shadcn was historically built on it | Sources describe it as still maintained but with momentum moving elsewhere ❓; narrower set (no date picker/calendar); fewer accessibility/i18n extras; the riskiest of the three to choose *now* for a new project |
| **Base UI** (`@base-ui/react`) | Newer headless library | Radix-like API; sources report a stable 1.0 in late 2025 and fast releases since, and say shadcn/ui made it a default option in 2026 (dates conflict between sources ❓); includes components Radix lacks (for example multi-select) | The youngest; smaller ecosystem; less battle-tested; API churn risk |
| **Headless UI** (Tailwind Labs) | Small set designed for Tailwind | Simple; from Tailwind's authors | Smaller set (dialog, menu, listbox, tabs, popover, switch…); fewer accessibility/i18n extras; activity unchecked |
| **Ark UI / Zag** | State-machine-based, framework-agnostic | Breadth | Unusual model; smaller community |
| **Native HTML only** | `<dialog>`, `popover`, `<details>`, native radio/checkbox/select/date | Zero dependencies; best baseline semantics; smallest bundle | Hand-built menus, tabs, tooltips and comboboxes are usually inaccessible; native `<select>` and `<dialog>` are only partly themeable; you write the focus/keyboard logic yourself. A **hybrid** (native for dialog, radio, checkbox, select, date; a library only for menu, tabs, tooltip) is realistic. |

**Decided: React Aria Components.** The answer options (radio/checkbox groups) and the keyboard-driven draft-review queue are where accessibility matters most here; React Aria is the most thorough there, is independent of the shadcn/MUI ecosystem shifts, supports Tailwind through data attributes, and already covers later needs (date picker for exam dates, combobox for filters). **Base UI is the alternative** if you prefer a lighter, Radix-style API and accept the youngest-library risk. **I wouldn't pick Radix for new work** given the reported momentum shift (unverified).

**Rule that makes this reversible:** wrap every primitive in our own `components/ui/` layer (`ui/Dialog`, `ui/Menu`, `ui/Tabs`…) and import the library only inside that folder, so swapping libraries touches one directory.

### 4.3 Charts and the blueprint map

| Option | Benefits | Drawbacks |
|---|---|---|
| **D3 modules (`d3-hierarchy`, `d3-scale`, `d3-shape`) + hand-written SVG** | Tiny; total control; the map is a custom visual you want to design; styles read your CSS variables directly so every theme works | You write axes, tooltips, responsiveness and text alternatives yourself; more code for ordinary charts |
| **Recharts** | Quick standard charts (line, bar, area) and a Treemap component | Larger bundle (sources give 150–370 KB, which disagree ❓); the treemap look beyond its props needs custom renderers; the recognizable default "Recharts look" |
| **Nivo** | Wide catalog including treemap; a theme object; animation | Config-heavy; large total bundle (one source: 500 KB+); opinionated styling |
| **visx** (Airbnb) | Low-level React + D3 primitives; granular and tree-shakable | You assemble everything yourself (so close to option 1 with a React wrapper); activity unchecked |
| **ECharts** | Powerful treemap and interactions; strong performance | Canvas-based, so CSS variables don't style it (themes must be passed as JavaScript objects); heavy; poor fit for several distinct CSS-driven themes |

**Recommendation:** D3 modules for the **treemap** (one component you design carefully) and hand-rolled SVG with `d3-scale` for the **few simple charts** the app needs (activity bars, score trend, calibration). Use Recharts only as a shortcut if hand-rolling charts becomes a time sink. The map's **Map ↔ List toggle** doubles as the accessible alternative. Check bundle sizes on bundlephobia before deciding anything on size grounds.

## 5. Constraints that cost almost nothing now

- **One signature element:** the blueprint map is the app's visual identity. Give it real design attention; keep the rest quiet.
- **Status never by color alone:** pair each status with an icon or label; choose the palette for color-blind safety.
- **Real data in every mock:** objective names from the packs and plausible numbers, not lorem ipsum.
- **Screenshot review** (desktop and phone) at the end of each slice against §1–§2.
