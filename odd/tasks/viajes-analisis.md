# Viajes: record linkage + robust travel analysis

Feature for the Astro site in this repo. Adds HCDN "Viajes Nacionales" data, links each trip row to a current deputy, and compares travel per deputy against regional peers.
Read until `## Log`. Technical artifacts in English; UI copy in Spanish (Argentina).

## Specs

- **S1 (approved idea 1, verbatim):** "Emparejar registros entre fuentes (record linkage). Es la base de todo lo demás. Encontrar a qué diputado corresponde cada viaje, aunque cambien el orden de los nombres, las tildes, las mayúsculas o falte un segundo nombre. Se arma normalizando el texto y comparando los nombres por palabras, con una medida de parecido (Jaro-Winkler) y un puntaje de confianza. Los casos que quedan dudosos se reportan y no se asignan a ciegas."
- **S2 (linkage examples that must hold, from real data):** deputy `Chiconi, Abel` ↔ trip name `CHICONI RICARDO ABEL`; `Pauli, Santiago` ↔ `PAULI JORGE SANTIAGO`; `Herrera Ahuad, Oscar A.` ↔ `HERRERA AHUAD OSCAR ALBERTO` (initial `A.` matches `ALBERTO`); `Borgatta, Alejandrina` ↔ `BORGATTA ALEJANDRINA BELÉN`; `Becerra, Mónica` ↔ `BECERRA MONICA MARIELA`. A trip name whose surname matches no current deputy (for example a former deputy) stays unmatched. When two deputies tie (for example two `Torres`), the row is reported as doubtful, never assigned.
- **S3 (approved idea 2, verbatim):** "Análisis de viajes con estadística robusta. Viajes por diputado y por semestre, y las rutas más frecuentes. Valores atípicos contra el resto, comparando de forma justa: no es lo mismo un diputado de Jujuy que uno de la Ciudad de Buenos Aires. Se mide cuánto se aparta cada uno de la mediana de su zona (desvío absoluto mediano), así un par de casos extremos no distorsionan la comparación."
- **S4 (wording rule, verbatim):** "hay que decir 'viaja más que sus pares', nunca 'abusa'."
- **S5 (data quality is shown):** the page reports how many distinct trip names were matched, doubtful, and unmatched, and lists the doubtful ones.
- **S6 (the CV claim must be true):** "X % emparejado automáticamente, 0 errores en los casos verificados" — the numbers shown come from the real build output, and the S2 examples are pinned by tests.

- **S7 (user decision, verbatim choice):** "Comparar por distancia (Recomendado)" — option text: "Estimar la distancia de cada diputado a Buenos Aires según su ruta habitual y comparar contra pares a distancia similar. Más justo y más algoritmo, pero es una estimación y se aclara como tal."

## Design decisions (parent)

- **Window:** the 4 most recent semesters published (today 2S2024, 1S2025, 2S2025, 1S2026). Resolve resources via CKAN `package_show?id=viajes-nacionales`, CSV only, choose by the period parsed from the rows, not by resource name.
- **Row normalization:** headers vary: period `PERIODO|PERÍODO|periodo|mes` with values `jun-26`, `sept-25`, `dic-25`, `2025-06-01`; name `DIPUTADO|DIPUTADOS|diputado`; type `TIPO_SOLICITUD|TIPO.SOLICITUD|TIPO SOLICITUD|tipo_solicitud` (`AEREO|TERRESTRE`); `ORIGEN`, `DESTINO`; optional `PROVINCIA`, `BLOQUE` (2024 files). Match headers case- and accent-insensitively. Normalize the period to `YYYY-MM`.
- **Linkage algorithm:** tokens = accent-stripped, lowercased words; drop particles (`de`, `del`, `la`, `las`, `los`, `y`). Deputy tokens split into surname tokens (before the comma) and given-name tokens. Candidate score: every surname token must match a trip token (Jaro-Winkler ≥ 0.93); each given-name token must match a distinct trip token (JW ≥ 0.9, or an initial like `a`/`a.` matching a token's first letter). Confidence = weighted share of the deputy's tokens matched plus the average JW. Match when confidence ≥ 0.9 and beats the runner-up by ≥ 0.05; doubtful when the best is ≥ 0.75 but fails either rule; otherwise unmatched. When a row has `PROVINCIA`, a district mismatch makes it doubtful. Cache by distinct raw name.
- **Fair metric:** trip legs per month in office within the window. Months in office = months in the window on or after the deputy's `FECHA_DE_INICIO` month. Deputies with fewer than 3 months in the window are excluded from the outlier check (shown, not flagged).
- **Peer groups (regions by district):** AMBA = CIUDAD DE BUENOS AIRES, BUENOS AIRES; Centro = CORDOBA, SANTA FE, ENTRE RIOS, LA PAMPA; Cuyo = MENDOZA, SAN JUAN, SAN LUIS; NOA = JUJUY, SALTA, TUCUMAN, CATAMARCA, SANTIAGO DEL ESTERO, LA RIOJA; NEA = CHACO, CORRIENTES, FORMOSA, MISIONES; Patagonia = NEUQUEN, RIO NEGRO, CHUBUT, SANTA CRUZ, TIERRA DEL FUEGO. Match district names accent-insensitively.
- **Outliers:** modified z = 0.6745 × (x − median) / MAD within the region; when MAD = 0 use (x − median) / (1.253314 × mean absolute deviation); when both are 0, z = 0. Flag z > 3.5 as "viaja bastante más que sus pares" (Iglewicz-Hoaglin). Only the high side is flagged.
- **UI:** third tab "Viajes": methodology box (plain Spanish, S4 wording, a note that more legs does not imply irregularity), regional summary (median legs/month per region), a sortable-by-default table (by legs/month desc) with name, district, region, legs, legs/month, region median, z, flag, and top route; data-quality box (S5) with the doubtful list in a `<details>`. In the Diputados detail dialog add "Tramos (últimos 4 semestres)" and "Tramos por mes".
- **Tests:** `node:test`, `.ts` imports with extension, inline fixtures only (no network). Build proves the real numbers.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| T0 | — | inline | done | baseline |
| T1 | S1, S2, S6 | worker + parent | done | `feat(viajes): link trip names` |
| T2 | S3 | worker | done | see git log `feat(viajes): normalize trip files` |
| T3 | S3, S4, S5, S6 | worker | done | b490f40 |
| T4 | S3, S7 | worker | done | feat(viajes): compare deputies against peers at a similar estimated distance |

- T0: commit the existing Astro site as the baseline on branch `feat/viajes`.
- T1: `src/lib/linkage.ts` + tests: normalization, Jaro-Winkler, candidate scoring, match/doubtful/unmatched with confidence.
- T2: `src/lib/viajes.ts` + tests: row normalization across header variants, period parsing, aggregation per deputy (legs, months in office, legs/month, top route), regions, robust z and flags.
- T3: `src/lib/sources.ts` loader for the 4-semester window, wiring into `index.astro` (tab "Viajes", data quality, detail fields), README section, build passes with real data.

## Log

- L1 (user, verbatim): "Hace la 1 y 2"
- L2 (parent evidence): latest semester has 217 distinct trip names; only 85 match the composition by exact token set, because the composition uses short names (`Chiconi, Abel`) and the trips full names (`CHICONI RICARDO ABEL`). Votaciones nominales stop in January 2020, so they are out of scope.
- L3 (parent evidence, T1 first pass on real data): 1S2026 213 matched / 1 doubtful / 3 unmatched. Older semesters showed defects: surname matched against a trip given name (`BARLETTA MARIO DOMINGO` → `Marino, Juan`), former deputies sharing a surname reported doubtful instead of unmatched (`AGUIRRE MANUEL IGNACIO` → `Aguirre, Hilda`), quoted nicknames (`Alí, Ernesto "Pipi"`), mojibake in source (`BELÃ‰N`, `BRÃœGGE`, `BELA?N`). Fixes: surname tokens must sit in the first positions of the trip name; no given-name match → unmatched; drop nicknames; repair mojibake.
- L4 (user, verbatim): "Hay que buscar mas apis oficiales o con datos reales para nutrir nuestra app." → read-only source survey delegated; new sources need the user's pick before implementation.
- L5 (parent decision): S1 "aunque cambien el orden" means the composition's "Apellido, Nombres" versus the trips' "APELLIDO NOMBRES", and given names in any order; surnames come first in every real trip file, so surname-last names stay unmatched. PROVINCIA (2024 files) narrows candidates to its district, breaking same-name ties. Real result after T1: 1S2026 214 matched / 0 doubtful / 3 unmatched; remaining doubtful rows elsewhere are unrecoverable source mojibake (`JOSA?`, `INA?S`, `RAAsL`) and one same-name case, reported per S1.
- L6 (parent evidence): with regions AMBA, 4 BUENOS AIRES deputies were flagged (Santillán Juárez Brahim z 9.44, López z 7.88, Carrancio z 5.57, Monzón z 3.64), top routes Aeroparque↔Mar del Plata and Necochea↔Retiro: commuting home. Splitting CABA from the province kept the same 4 (province median 0.38). User chose S7.
- L7 (parent evidence, T4 real build): bands <100 (86, median 0.33/mo), 100-400 (32, 3.23), 400-800 (45, 5.58), 800-1200 (62, 5.93), >=1200 (30, 6.08); the four L6 deputies are no longer flagged (Mar del Plata 377 km, Necochea 440 km); flagged: Monzón (z 4.72, home fallback La Plata, top route Aeroparque-Posadas) and Arabia (z 3.54, CABA, Aeroparque-Bariloche). Endpoint coverage 99.99% of matched legs; coordinates spot-checked (AEP, BRC, RES, USH, MDZ) against known values.
