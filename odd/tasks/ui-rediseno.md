# UI redesign and information architecture

Redesign the Astro site's UI and reorganize the information around how legislators, blocs, provinces, committees, bills, trips and votes relate to each other.
Read until `## Log`. Technical artifacts in English; UI copy in Spanish (Argentina). Builds on odd/tasks/viajes-analisis.md and odd/tasks/fuentes-oficiales.md (branch feat/viajes).

## Specs

- **S1 (user request, verbatim):** "mejora la ui y acomoda la info y sus relacion entre si"
- **S2 (relations that must be navigable, parent analysis):** legislator ↔ bloc, legislator ↔ province/district, deputy ↔ committees (with role), legislator ↔ bills (with stage), deputy ↔ trips and missions, senator ↔ roll-call votes, bloc ↔ cohesion. Today only legislator pages exist; blocs, committees and provinces have no page.
- **S3 (keep honesty rules):** every metric keeps its source and period; quality boxes stay; descriptive wording only (S4 of viajes-analisis: "viaja más que sus pares", never "abusa").
- **S4 (design first):** three structurally different directions under `design/ui-rediseno/`; the user picks one before any source change.

- **S5 (user choice, verbatim):** "01 + portada de 02 (Recomendado)" — option text: "Fichas y páginas de bloque, provincia y comisión enlazadas entre sí (01), con la portada de hallazgos por tema (02)." Visual spec: `design/ui-rediseno/01-ficha-central.html` (chosen artboard; colors, type, layout, relation strip, entity pages) and the home/Pantalla 1 of `design/ui-rediseno/02-tablero-por-temas.html` (topic cards with charts and drill-down). 03 is an alternative, not implemented.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| D1 | S1-S4 | 3 workers (one artboard each) | done | |
| U1 | S2, S3 | worker + parent | done | feat(entities) |
| U2 | S1, S5 | worker | done | feat(ui): add design tokens |
| U3a | S1-S3, S5 | worker | done | feat(ui): add bloc, province and committee pages |
| U3b | S1-S3, S5 | worker + parent | done | feat(ui): rebuild home, topic pages and legislator hubs |

## Log

- L1 (user, verbatim): "mejora la ui y acomoda la info y sus relacion entre si"
- L2 (parent): current IA is source-first (tabs Diputados / Senadores / Viajes / Proyectos + legislator pages); entity pages for blocs, committees and provinces are missing. No design system sources exist (styles live in scoped .astro styles), so directions are free. Design: `design/ui-rediseno/` with 01-ficha-central, 02-tablero-por-temas, 03-mapa-provincias.
- L3 (parent, from D1 03 worker): deputy Cisneros (Tucumán) shows 0 legs and "en línea con sus pares"; likely a linkage miss or a zero-legs deputy treated as compared. Investigate during U1 (zero legs in a far band should not read "en línea" without saying 0 tramos registrados).
- L4 (parent): D1 done. Artboards 01-ficha-central (bloc page UxP as relation page), 02-tablero-por-temas (committee page Acción Social y Salud Pública), 03-mapa-provincias (province page Tucumán); measured heights 5600 / 5540 / 5810 px at 1440 wide; no external references; no console errors besides the temp server favicon.
- L5 (user, verbatim choice): "01 + portada de 02 (Recomendado)". Handoff `ui-rediseno/01-ficha-central.html` is the chosen artboard; 02's home is merged in; 03 stays an alternative.
- L6 (parent plan): U1 pure entity indexes (`src/lib/entities.ts`: blocs across chambers, provinces, committees, search index) + Cisneros zero-legs wording; U2 visual system (global tokens from 01 in Layout, shared components: RelationStrip, Chip, DotPlot, BarChart, StatTile, Section, restyled QualityBox/SourceLine); U3a entity pages `/bloques/[slug]`, `/provincias/[slug]`, `/comisiones/[id]`; U3b home (search + topic cards from 02), topic pages `/viajes/`, `/proyectos/`, `/senado/` (content of today's tabs), restyled legislator pages with the relation strip. Old hash tabs keep working by redirecting `/#viajes` etc. to the topic pages.
- L7 (canvas handoff): implement request for `ui-rediseno/01-ficha-central.html` received from the canvas; same chosen artboard as L5, tracked by U1-U3b already in progress (no new task).
- L8 (parent evidence, U1 real data): blocs Diputados 21 / Senado 14, provinces 24, committees 46 (HCDN00064 has members but no name in the list), search index 434 entries ~86 KB (15 KB gzip). UxP Diputados 92 members, 21 districts, 16 chairs: matches the artboard. Cisneros: no trip row resembles him in any of the 17 files; 32 eligible deputies have 0 legs and now read "Sin tramos registrados en el período". Missions topic must use current-deputy counts (35 missions of 20 current deputies), not the published total 67. Parent added memoized `loadEntities()` in sources.ts.
- L9 (parent evidence, U2): tokens + SiteLayout + 12 ui components; contrast measured (chart-muted darkened to #7a94ad for 3:1); SearchBox keyboard verified in browser (ArrowDown sets aria-activedescendant, grouped results, no console errors). Known: /guia/ shows a horizontal scrollbar (overflow) — fix in U3; /guia/ is temporary and must be removed at close.
- L10 (parent evidence, U3a): 108 entity pages (bloques 1+21+14, provincias 1+24, comisiones 1+46), no overflow at 1440/375, UxP numbers match the artboard. Parent fixes: `.visually-hidden` gets display:block (the DotPlot fallback table widened pages to 1658 px, the /guia/ overflow of L9); Section `.tag` can shrink; committees without a published name read "Comisión sin nombre publicado (HCDN00064)" everywhere, including search.
- L11 (parent evidence, close): 442 pages, 0 broken internal links, npm test 217/217, astro check 0 errors. Browser: 10 representative pages at 1440 and 375 px with 0 horizontal overflow, one h1 each, no "abusa", no console errors; `/#viajes` redirects to `/viajes/`; header and hero search work, "caba" finds Ciudad de Buenos Aires (parent added SearchEntry.keywords with aliases only). Parent fixes after visual comparison with the artboard: DotPlot stacks capped at ±12 px in the row (zero-legs column spilled into other rows) and colliding labels drop below the axis. Removed /guia/, DetailDialog and detail-dialog.ts. Known differences vs artboard caused by data: 46 committees (one unnamed), Presupuesto 49 members, committee names without accents (source). Handoff of 01-ficha-central marked implemented; 02 contributes the home cards; 03 stays an alternative.
