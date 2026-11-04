# Design system: Congreso Abierto

Synced from the project source (read only). Every value below appears in the named file; nothing is invented.
Tokens live in `:root` of `src/styles/tokens.css`. The theme is light only (`color-scheme: light`).

Artboard: `design/system.html`.

## Colors

Source for every token: `src/styles/tokens.css`. Usage is where the sources apply the token.

### Base

| Token | Value | Usage |
| --- | --- | --- |
| `--ink` | `#1c1b19` | Body text; current chip and current pager page border; RelationStrip outer border; TopicCard top border; median line in DotPlot; filled current step in Breadcrumb `path` |
| `--muted` | `#55524b` | Secondary text: captions, `th`, `.eyebrow`, `.note`, `.muted`, StatTile label and note, chip type and meta |
| `--placeholder` | `#76726a` | Input placeholder; SearchBox compact border (4.8:1, identifies the input); disabled pager button text |
| `--paper` | `#fbfaf7` | Page background (`html`, `body`); small chip background |
| `--surface` | `#ffffff` | Cards, sections, header, footer, inputs, buttons; text on `--ink` fills |
| `--canvas` | `#e9e6df` | Declared; no use in the read sources |
| `--line` | `#d9d5cc` | Default 1px borders: cards, boxes, chips, tags, `th` bottom, header and footer rules |
| `--line-soft` | `#ebe8e1` | `td` bottom border; Funnel track; DotPlot grid; disabled pager border; SearchBox results footer rule |

### Accent and focus

| Token | Value | Usage |
| --- | --- | --- |
| `--accent` | `#1f4e79` | Links; TopicCard topic eyebrow; current nav underline (`inset 0 -2px 0`); current table row and selected search option left bar (`inset 3px 0 0`); highlighted dot |
| `--accent-ink` | `#163a5c` | Link hover; chip hover text; search result badge text |
| `--accent-soft` | `#e8eef5` | Hover background for chips, nav, pager buttons, RelationStrip cells; selected search option; search badge |
| `--focus` | `#1f4e79` | Focus ring color (through `--focus-ring`) |

### Status

| Token | Value | Usage |
| --- | --- | --- |
| `--flag` | `#8a3b12` | Flagged text: `.tag.flag`, StatTile `tone="flag"`, TopicCard `.quality.warn`, flagged dot and label in DotPlot |
| `--flag-soft` | `#f7ebe3` | Background of flag tag and warn quality pill |
| `--flag-line` | `#e2c3ae` | Border of flag tag and warn quality pill |
| `--quality` | `#2f6b3a` | OK text: `.tag.ok`, StatTile `tone="ok"`, TopicCard `.quality`; highlighted last Funnel stage |
| `--quality-soft` | `#e7f1e8` | Background of `.box.quality`, ok tag, quality pill |
| `--quality-line` | `#bfd8c3` | Border of `.box.quality`, ok tag, quality pill |

### Surfaces for state

| Token | Value | Usage |
| --- | --- | --- |
| `--highlight` | `#fde9a8` | `mark` background |
| `--row-current` | `#f3f6fa` | DataTable `tr.current td` background |
| `--badge` | `#f1efe9` | Breadcrumb `path` step background |

### Charts

| Token | Value | Usage |
| --- | --- | --- |
| `--chart` | `#1f4e79` | Primary series: BarChart bar, Funnel bar, focused bar |
| `--chart-muted` | `#7a94ad` | Secondary series: muted bars, DotPlot dots (fill-opacity 0.8). Darkened from `#9db3c8` to pass 3:1 as non-text |

### Celeste (brand)

Approved from `design/logo-congreso-abierto/02-trazo.html` (section 2). Fills only: `--celeste` on `--paper` is 2.31:1, so it is never text or a stroke on paper. Text on celeste uses `--ink` (7.14:1) or `--accent-ink` (4.85:1); white on celeste fails (2.41:1).

| Token | Value | Usage |
| --- | --- | --- |
| `--celeste-50` | `#eaf3fb` | Soft wash, hero band |
| `--celeste-200` | `#b9d7f1` | Sky and blooms of the watercolor; tagline on `--ink` (11.52:1) |
| `--celeste` | `#74acdf` | Flag celeste: watercolor washes. Fill only |
| `--celeste-700` | `#2f6796` | Watercolor line and shadows; the only celeste that holds text on paper (5.75:1) |

### Bloc palette

White text passes AA on each (`src/styles/tokens.css` comment).

| Token | Value |
| --- | --- |
| `--bloc-1` | `#1e3a8a` |
| `--bloc-2` | `#0f766e` |
| `--bloc-3` | `#6d28d9` |
| `--bloc-4` | `#be123c` |
| `--bloc-5` | `#b45309` |
| `--bloc-other` | `#55524b` |

## Typography

Source: `src/styles/tokens.css`.

### Font stacks

| Token | Value | Usage |
| --- | --- | --- |
| `--serif` | `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif` | `h1`–`h4` (weight 600, line-height 1.2); StatTile value; TopicCard big number; brand |
| `--sans` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | `body`; chart SVG text; brand subtitle |
| `--mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace` | `kbd` |

`body` sets `font-variant-numeric: tabular-nums`.

### Scale

| Token | Value | Usage |
| --- | --- | --- |
| `--text-2xs` | `11px` | `th`, `.eyebrow`, `.tag`, `kbd`, chip type, StatTile note, RelationStrip key |
| `--text-xs` | `12px` | `caption`, `.note`, `.muted`, StatTile label, small chip, footer, breadcrumbs |
| `--text-sm` | `13px` | `table`, `.box`, chip, pager, nav links, search input (compact) |
| `--text-md` | `15px` | `body` |
| `--text-lg` | `16px` | Declared; no use in the read sources |
| `--text-xl` | `20px` | Section `h2`/`h3`; StatTile `md` value; SearchBox `hero` input |
| `--text-2xl` | `24px` | Declared; no use in the read sources |
| `--text-3xl` | `32px` | StatTile `lg` value |
| `--text-4xl` | `38px` | Declared; no use in the read sources |

Literal sizes outside the scale: TopicCard `h2` `22px` / 1.15 and `.big` `36px` / 1 weight 700, TopicCard `.lede` `14px` (`src/components/ui/TopicCard.astro`); brand name `--text-xl` in `--serif`, “Congreso” 700 and “Abierto” 400 (`src/components/ui/Brand.astro`).

### Line height and tracking

| Token | Value | Usage |
| --- | --- | --- |
| `--leading` | `1.45` | `body` |
| `--leading-tight` | `1.1` | StatTile value |
| `--tracking-caps` | `0.08em` | RelationStrip key (uppercase) |

Uppercase labels also use literal tracking: `th` and chip type `0.06em`, `.eyebrow` and search group title `0.1em` (`src/styles/tokens.css`, `src/components/ui/Chip.astro`, `src/components/ui/SearchBox.astro`).

## Spacing

Source: `src/styles/tokens.css`.

| Token | Value |
| --- | --- |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-7` | `28px` |
| `--space-8` | `40px` |
| `--page-max` | `1200px` (content width: `.page-wrap`, header bar, nav) |
| `--page-pad` | `clamp(16px, 3vw, 40px)` (page side padding) |

Recurring literals: card padding `18px 20px` (`.ui-card` in `src/styles/shared.css`, Section card), cell padding `7px 8px` (`th`, `td`), chip gap `6px` (`.chip-list`).

## Radius

Source: `src/styles/tokens.css`.

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-sm` | `3px` | Focus outline corners, `kbd`, TopicCard |
| `--radius-md` | `4px` | Pager buttons and select, nav links, Breadcrumb step |
| `--radius` | `6px` | Cards, sections, `.box`, RelationStrip, compact SearchBox, skip link |
| `--radius-lg` | `8px` | Hero SearchBox, search results popover |
| `--radius-pill` | `999px` | Chip, `.tag`, quality pill |

## Shadows

Source: `src/styles/tokens.css`.

| Token | Value | Usage |
| --- | --- | --- |
| `--shadow-card` | `0 1px 2px rgba(28, 27, 25, 0.06)` | Declared; no use in the read sources |
| `--shadow-raised` | `0 6px 18px rgba(28, 27, 25, 0.1)` | TopicCard hover (with `translateY(-2px)`, motion allowed only) |
| `--shadow-popover` | `0 10px 30px rgba(28, 27, 25, 0.1)` | Search results popover; skip link |

## Focus ring

Source: `src/styles/tokens.css`.

- `--focus-ring`: `3px solid var(--focus)` (`#1f4e79`).
- `:focus-visible` gets `outline: var(--focus-ring)`, `outline-offset: 2px`, `border-radius: var(--radius-sm)`.
- SearchBox draws the ring on `.box:focus-within` (offset 2px) and removes it from the inner input (`src/components/ui/SearchBox.astro`).
- DataTable scroll region uses offset `0`; RelationStrip links use offset `-3px` (inside the strip).

## Motion

`@media (prefers-reduced-motion: reduce)` disables all transitions and animations (`src/styles/tokens.css`). Components add transitions only under `no-preference`: `0.12s ease` on background/border (Chip, RelationStrip, nav), `0.15s ease` on transform/shadow (TopicCard).

## Base elements and shared classes

- `table`: collapsed, full width, `--text-sm`; `th`/`td` padding `7px 8px`, bottom border `--line-soft`; `th` uppercase `--text-2xs`, weight 600, `--muted`, bottom border `--line`; `caption` left, `--text-xs`, `--muted` (`src/styles/tokens.css`).
- `kbd`: `--mono`, `--text-2xs`, 1px `--line` border with 2px bottom, `--radius-sm`, `--surface` (`src/styles/tokens.css`).
- `mark`: `--highlight` (`src/styles/tokens.css`).
- `.eyebrow`: `--text-2xs`, uppercase, `0.1em`, weight 600, `--muted` (`src/styles/tokens.css`).
- `.tag`: pill, `--text-2xs`, padding `1px 7px`, `--line` border, `--surface`, `--muted`; `.tag.flag` and `.tag.ok` swap to the flag/quality triplets (`src/styles/tokens.css`).
- `.ui-card`: `--surface`, 1px `--line`, `--radius`, padding `18px 20px` (`src/styles/shared.css`).
- `.box` (method and quality boxes): 1px `--line`, `--surface`, `--radius`, padding `--space-3 --space-4`, `--text-sm`, margin-bottom `--space-5`; `.box.quality` uses `--quality-line` border and `--quality-soft` background (`src/styles/shared.css`).
- `.stat-grid`: auto-fit `minmax(150px, 1fr)`, gap `--space-4 --space-6` (`src/styles/shared.css`).
- `.topic-grid`: 6 columns, gap `18px`; 2 columns below 960px, 1 below 640px (`src/styles/shared.css`).

## Component rules

- **Chip** (`src/components/ui/Chip.astro`): links to an entity page; plain `span` without `href` or when current. Pill, padding `5px 10px`, 1px `--line`, `--surface`, `--ink`, `--text-sm`, line-height 1.3, gap 6px. Optional uppercase type prefix (`--text-2xs`, `0.06em`, `--muted`) and trailing meta (`--text-xs`, `--muted`). `sm`: padding `1px 7px`, `--text-xs`, `--paper`. Hover: `--accent` border, `--accent-soft` bg, `--accent-ink` text. Current: `--ink` border, weight 600, `aria-current="page"`.
- **RelationStrip** (`src/components/ui/RelationStrip.astro`): `nav` with one cell per related entity (Bloque, Provincia, Comisiones, Proyectos, Viajes, Votaciones). Grid with 1px `--ink` border, `--radius`, `--surface`, cells split by `--line`. Cell padding `--space-3 14px`; key uppercase `--text-2xs` `--tracking-caps` weight 600 `--muted`; value weight 600; detail `--text-xs` `--muted`; CTA `--text-xs` `--accent` with `→`. Committees cell is wide (2.4fr) and holds `sm` chips. 2 columns below 900px, 1 below 520px.
- **StatTile** (`src/components/ui/StatTile.astro`): `dt`/`dd` pair inside `dl.stat-grid`. Label `--text-xs` `--muted`; value `--serif` 600 `--leading-tight`, `lg` = `--text-3xl`, `md` = `--text-xl`; unit `--text-sm` `--muted`; note `--text-2xs` `--muted`. Tones: `flag` value `--flag`, `ok` value `--quality`.
- **Section** (`src/components/ui/Section.astro`): `section` labelled by its heading; optional eyebrow and tag (default/ok/flag) in the head row; source and period line at the bottom (every metric keeps its source and period). Card variant: `--surface`, 1px `--line`, `--radius`, padding `18px 20px`; title `--text-xl`; margin-bottom `--space-5`.
- **DataTable** (`src/components/ui/DataTable.astro`): focusable scroll region named by the caption. Numeric cells `.num`, right aligned, no wrap. `dense`: cell padding `4px 6px`. Current row: `--row-current` bg and `inset 3px 0 0 var(--accent)` on the first cell.
- **DotPlot** (`src/components/ui/DotPlot.astro`): SVG in `--sans`. Grid `--line-soft`, axis `--line`, ticks 11px `--muted`, row labels 12px `--ink`. Dots `--chart-muted` at 0.8 opacity with `--surface` stroke; highlight `--accent`, flag `--flag`; median 2px `--ink`. Legend `--text-xs` `--muted`.
- **BarChart** (`src/components/ui/BarChart.astro`): list rows `label | bar | value`, `--text-sm`. Bar 10px high, `--chart`, radius `0 2px 2px 0`; muted or focus mode uses `--chart-muted` with the highlighted bar in `--chart`. Value right aligned, weight 600.
- **Funnel** (`src/components/ui/Funnel.astro`): ordered list of stages; value weight 700, share `--muted`. Track `--line-soft`, bar 12px `--chart`; highlighted last stage bar `--quality` and label weight 700.
- **TopicCard** (`src/components/ui/TopicCard.astro`): `article` in `.topic-grid`, spans 2/3/4/6 columns. `--surface`, 1px `--line`, 4px `--ink` top border, `--radius-sm`, padding `18px 20px 14px`. Topic eyebrow `--text-xs` uppercase `0.1em` 700 `--accent`; title 22px; big number `--serif` 36px 700; key note `--text-sm` `--muted`. Footer: dashed `--line` above the source, drill link weight 700 with `→`, quality pill (pill, `--text-xs`, padding `2px 9px`, 7px dot in `currentColor`; ok = quality triplet, warn = flag triplet). Hover lifts 2px with `--shadow-raised`.
- **Breadcrumb** (`src/components/ui/Breadcrumb.astro`): `crumbs` = `ol` at `--text-xs` `--muted`, `/` separators, last item `aria-current="page"`; `inverse` uses `--surface` text. `path` = steps at `--text-sm` on `--badge` with `--radius-md`, `→` separators; current step `--ink` fill, `--surface` text, weight 600.
- **SearchBox** (`src/components/ui/SearchBox.astro`): ARIA combobox with grouped listbox. Compact box: `--surface`, 1px `--placeholder` border, `--radius`, padding `6px 10px`, search icon stroked `--muted` 2.4, input `--text-sm`, optional `/` `kbd`. Hero: 2px `--ink` border, `--radius-lg`, padding `--space-3 --space-4`, input `--text-xl`. Focus ring on the box. Results popover: `--surface`, 1px `--line`, `--radius-lg`, `--shadow-popover`; group titles like `.eyebrow`; selected option `--accent-soft` with 3px `--accent` left bar; 28px round badge `--accent-soft`/`--accent-ink`.
- **Pager** (`src/components/ui/Pager.astro`): `nav` "Paginación de …", hidden until JS runs. Status `--text-xs` `--muted` live region. Buttons min 32×32, padding `4px 8px`, 1px `--line`, `--radius-md`, `--surface`, `--text-sm`; hover `--accent` border and `--accent-soft`; current page `--ink` fill, `--surface` text, weight 600; disabled `--placeholder` text, `--line-soft` border. "Por página" select 25/50/100/Todos with the same border and radius.
- **Brand** (`src/components/ui/Brand.astro`): link to `/` with the simple monochrome seal of `design/logo-congreso-abierto/03-sello.html` (building cut out of a solid `--ink` circle, 40px, `aria-hidden`) and the name as HTML text (`--serif` `--text-xl`, “Congreso” 700, “Abierto” 400), optional tagline `--sans` `--text-2xs` `--muted` `0.04em`. The full seal with ring text is used only at 96px or more (footer); its ring text is unreadable below that.
- **Brand assets** (`public/`): `favicon.svg` = simple monochrome seal, `--ink` on transparent, `--paper` under `prefers-color-scheme: dark`; `apple-touch-icon.png` 180×180 = same seal on `--paper`; `congreso-acuarela.svg` = home hero watercolor (03-sello.html); `og.png` 1200×630 = horizontal monochrome lockup on `--ink` beside the watercolor.
- **SiteLayout** (`src/layouts/SiteLayout.astro`): skip link "Saltar al contenido"; header `--surface` with bottom `--line`; Brand with the tagline “Datos abiertos del Congreso argentino”; header search max 360px; nav links `--text-sm`, padding `6px 10px`, `--radius-md`, hover `--accent-soft`, current weight 600 with 2px `--accent` underline shadow; footer `--surface`, top `--line`, `--text-xs` `--muted`, margin-top `--space-8`, full monochrome seal at 96px beside the text. Titles follow “<page> · Congreso Abierto” (`src/layouts/Layout.astro`), which also sets the Open Graph and Twitter meta.
