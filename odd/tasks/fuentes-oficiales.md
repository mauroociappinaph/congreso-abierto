# Fuentes oficiales: international trips, committees, bills, Senate votes

Adds four official sources to the Astro site, all joined to legislators through the existing linker (`src/lib/linkage.ts`).
Read until `## Log`. Technical artifacts in English; UI copy in Spanish (Argentina). Builds on odd/tasks/viajes-analisis.md (branch feat/viajes).

## Specs

- **S1 (user choice, verbatim):** "4 1  2+3, y 5" — from this ranked list (verbatim labels): "4 Misiones oficiales (viajes al exterior)", "1 Comisiones de Diputados (integrantes y autoridades)", "2 Proyectos parlamentarios (115 mil)" + "3 Movimientos de proyectos", "5 Votaciones del Senado".
- **S2 (misiones oficiales, verbatim feature):** "Viajes internacionales con motivo, quién invita y viáticos". Source: HCDN CKAN `misiones-oficiales`, one CSV per semester (2024-1S..2026-1S). Columns seen: `FECHA_INICIO`, `FECHA_FIN`, `MOTIVO`, `INSTITUCION_QUE_INVITA`, `LUGAR`, `PARTICIPA` ("DIP. TAIANA JORGE"), `VIATICOS_OTORGADOS…`, `MONEDA`, `VIATICOS_CONSUMIDOS`, `BLOQUE`; values are often "-"; headers may differ by semester.
- **S3 (comisiones, verbatim feature):** "En qué comisiones está cada diputado". Source: HCDN CKAN `comisiones`: `comisiones_permanentes_integrantes` (`COMISION_ID`, `DIPUTADO_NOMBRE` "MAYORAZ, Nicolás", `DISTRITO`), `comisiones_permanentes_autoridades`, `comisiones` (committee names by `COMISION_ID`).
- **S4 (proyectos + movimientos, verbatim feature):** "Proyectos presentados por cada diputado, por tipo" and "Qué tan lejos llegó cada proyecto (comisión, dictamen, sanción)". Sources: HCDN CKAN `proyectos-parlamentarios` (`PROYECTO_ID`, `TITULO`, `PUBLICACION_FECHA`, `CAMARA_ORIGEN`, `EXP_DIPUTADOS`, `EXP_SENADO`, `TIPO`, `AUTOR` "AVEIRO, MARTIN"; ~115k rows, 32 MB) and `movimientos-de-proyectos` (`PROYECTO_ID`, `FECHA`, `MOVIMIENTO`, `ORDEN`).
- **S5 (votaciones del Senado, verbatim feature):** "Cómo votó cada senador y sus ausencias". Source: official HTML only: index `https://www.senado.gob.ar/votaciones/actas` (year filter 2015–2026) and detail `https://www.senado.gob.ar/votaciones/detalleActa/{id}` (header: acta number, title, date, result, majority type; rows: senator "BULLRICH, PATRICIA", bloque, provincia, vote).
- **S6 (honesty):** every metric shows its source and period; unmatched/doubtful names are reported like in Viajes; wording is descriptive, never accusatory.

## Design decisions (parent)

- **Linking:** reuse `createLinker` from `src/lib/linkage.ts` unchanged where possible. Deputies for S2/S3/S4 (AUTOR of bills with `CAMARA_ORIGEN` Diputados; Senate-origin authors link against senators), senators for S5. Strip prefixes such as `DIP.`, `DIPUTADO/A`, `SEN.` before linking. If the linker needs a change, report it; do not edit linkage.ts in parallel tasks.
- **Windows:** S2 all published semesters from 2024; S4 bills published from 2024-01-01 (current mandates started Dec 2023 / Dec 2025); S5 actas from 2024 to today for current senators.
- **S4 stage:** classify each bill's furthest stage from its movements into an ordered set: `presentado` < `en comisión` < `con dictamen` < `media sanción` < `sancionado`. Derive the mapping from the real distinct `MOVIMIENTO` values (report the table of values → stage with counts); unknown values do not advance the stage.
- **S5 metrics per senator:** actas in office, votes by type (afirmativo, negativo, abstención, ausente), attendance % = (actas − ausente) / actas, and **bloc loyalty** = share of votes cast equal to their bloc's majority vote in that acta. Per bloc: **Rice cohesion index** = |yes − no| / (yes + no) averaged over actas. Present as descriptive statistics.
- **S5 fetching:** at build time, polite: concurrency ≤ 4, timeout 30 s, a few retries; cache parsed actas in `src/data/senado-actas.json` so rebuilds only fetch new actas (the cache is committed data, like the senators snapshot). HTML parsing must be pure functions tested with fixtures from real pages.
- **Pure first:** each source gets a pure module (parse + aggregate) with `node:test` tests built from real samples (trimmed), no network in tests. Wiring (loaders, components, tabs, detail fields) is one final task after Viajes T3.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| F1 | S2, S6 | worker | pending | |
| F2 | S3, S6 | worker | done | feat(comisiones) |
| F3 | S4, S6 | worker | pending | |
| F4 | S5, S6 | worker | pending | |
| F5 | S1-S6 | worker, after viajes T3 | pending | |

- F1: `src/lib/misiones.ts` + tests: header variants, dates, viáticos parsing (amount + currency, "-" → null), per-deputy aggregation (missions, destinations, institutions, viáticos otorgados/consumidos summed per currency).
- F2: `src/lib/comisiones.ts` + tests: members, authorities (role: presidente, vicepresidente, secretario, vocal…), committee names; per-deputy list of committees with role.
- F3: `src/lib/proyectos.ts` + tests: bills parsing, filter window, per-author counts by `TIPO`, furthest stage per bill from movements, per-author stage funnel, recent bills list.
- F4: `src/lib/senado-votos.ts` + tests: parse index page(s) to acta ids/dates, parse acta detail, aggregate per senator and per bloc (S5 metrics).
- F5: loaders in sources.ts (incl. Senate cache script), UI (deputy detail sections, Viajes tab adds international missions, new "Proyectos" view, Senate votes in senator detail + bloc cohesion table), README, real build numbers.

## Log

- L1 (user, verbatim): "Hay que buscar mas apis oficiales o con datos reales para nutrir nuestra app."
- L2 (parent): read-only survey done; ranked list presented; Deputies votes after 2020 have no official machine-readable source; OA asset declarations exclude legislators.
- L3 (user, verbatim): "4 1  2+3, y 5"
- L4 (parent): F2 real probe 256/261 names matched (98.1%). Linker follow-ups for F5: move district alias CABA→CIUDAD DE BUENOS AIRES into linkage.ts; accept a given-name subset when surname is exact and district matches ("GÓNZALEZ, Diógenes" vs "González, Diógenes Ignacio").
