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
| U1 | S2, S3 | worker | in progress | |
| U2 | S1, S5 | worker | in progress | |
| U3a | S1-S3, S5 | worker, after U1+U2 | pending | |
| U3b | S1-S3, S5 | worker, after U1+U2 | pending | |

## Log

- L1 (user, verbatim): "mejora la ui y acomoda la info y sus relacion entre si"
- L2 (parent): current IA is source-first (tabs Diputados / Senadores / Viajes / Proyectos + legislator pages); entity pages for blocs, committees and provinces are missing. No design system sources exist (styles live in scoped .astro styles), so directions are free. Design: `design/ui-rediseno/` with 01-ficha-central, 02-tablero-por-temas, 03-mapa-provincias.
- L3 (parent, from D1 03 worker): deputy Cisneros (Tucumán) shows 0 legs and "en línea con sus pares"; likely a linkage miss or a zero-legs deputy treated as compared. Investigate during U1 (zero legs in a far band should not read "en línea" without saying 0 tramos registrados).
- L4 (parent): D1 done. Artboards 01-ficha-central (bloc page UxP as relation page), 02-tablero-por-temas (committee page Acción Social y Salud Pública), 03-mapa-provincias (province page Tucumán); measured heights 5600 / 5540 / 5810 px at 1440 wide; no external references; no console errors besides the temp server favicon.
- L5 (user, verbatim choice): "01 + portada de 02 (Recomendado)". Handoff `ui-rediseno/01-ficha-central.html` is the chosen artboard; 02's home is merged in; 03 stays an alternative.
- L6 (parent plan): U1 pure entity indexes (`src/lib/entities.ts`: blocs across chambers, provinces, committees, search index) + Cisneros zero-legs wording; U2 visual system (global tokens from 01 in Layout, shared components: RelationStrip, Chip, DotPlot, BarChart, StatTile, Section, restyled QualityBox/SourceLine); U3a entity pages `/bloques/[slug]`, `/provincias/[slug]`, `/comisiones/[id]`; U3b home (search + topic cards from 02), topic pages `/viajes/`, `/proyectos/`, `/senado/` (content of today's tabs), restyled legislator pages with the relation strip. Old hash tabs keep working by redirecting `/#viajes` etc. to the topic pages.
