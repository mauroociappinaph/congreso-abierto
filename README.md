# Gastos de Diputados y Senadores

Astro static site that lists Argentina's national legislators and the monthly pay the Chamber of Deputies publishes.

Data is fetched at build time, in Node, so the Senate API's missing CORS headers do not matter. Rebuild to refresh the data.

## Commands

Requires Node 22.12 or newer.

| Command | Action |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at `http://localhost:4321` |
| `npm run build` | Fetch the data and build the site into `dist/` |
| `npm run preview` | Serve the built site |
| `npm test` | Unit tests (`node:test`, Node runs the TypeScript directly) |
| `npm run check` | Type-check `.astro` and `.ts` files |
| `npm run update-senators` | Refresh the Senate fallback snapshot |

## Data

| Section | Source | Notes |
| --- | --- | --- |
| Diputados | [HCDN Legisladores](https://datos.hcdn.gob.ar/dataset/legisladores), "Composición Actual de la Cámara" | The build fails if HCDN is unreachable. |
| Remuneración | [HCDN Dietas y Gastos de Representación](https://datos.hcdn.gob.ar/dataset/dietas-y-gastos-de-representacion-legisladores-as) | One set of amounts for every deputy; no per-legislator expenses are published. |
| Viajes | [HCDN Viajes Nacionales](https://datos.hcdn.gob.ar/dataset/viajes-nacionales), every CSV resource | The 4 newest semesters found in the rows (not in the resource names) form the window. The build fails if any file cannot be loaded. |
| Senadores | [Senado Datos Abiertos](https://www.senado.gob.ar/micrositios/DatosAbiertos/) | If the API fails during the build, `src/data/senadores.json` is used and the page says so. |

## Algorithms

- **Record linkage** (`src/lib/linkage.ts`): trip files name deputies as `APELLIDO NOMBRES` with full given names; the composition uses `Apellido, Nombres` with short ones. Names are accent-stripped, tokenized and compared word by word with Jaro-Winkler: every surname token must match one of the first trip tokens, and given names (or initials) must match distinct remaining tokens. The confidence score mixes the share of matched tokens and their average similarity. A row is assigned only when the best candidate scores at least 0.9 and beats the runner-up by 0.05; ties and low scores are reported as doubtful and never assigned. The Viajes tab shows the match rate and the doubtful list.
- **Estimated distance** (`src/lib/distance.ts`, `src/data/endpoints.json`): every ORIGEN/DESTINO name in the trip files is normalized to a key and placed with public coordinates (airports from ANAC/ORSNA and Wikipedia, bus terminals at the city centre); Buenos Aires terminals (Aeroparque, Ezeiza, Retiro, Liniers) are hubs. A deputy's home is the non-hub endpoint in their own district that the most legs touch, with at least 3 legs; otherwise the district capital. The distance is the haversine km from that home to the Obelisco. It is an estimate and the page says so.
- **Robust outliers** (`src/lib/viajes.ts`): the metric is trip legs per month in office within the window. Each deputy is compared with deputies at a similar estimated distance, in bands `< 100 km`, `100–400`, `400–800`, `800–1200` and `≥ 1200 km`. Walking from the farthest band, a band with fewer than 5 eligible deputies merges into the adjacent nearer one (the nearest merges into the next), and the merged label spans both, for example `≥ 800 km`. Within a band the Iglewicz-Hoaglin modified z-score, `0.6745 × (x − median) / MAD`, keeps a few extreme values from moving the baseline. A z above 3.5 is shown as "viaja bastante más que sus pares"; deputies with fewer than 3 months in the window are not compared. The region (CABA, Buenos Aires, Centro, Cuyo, NOA, NEA, Patagonia) is only displayed.
- `src/lib/travel-report.ts` picks the window, builds the legs from matched rows only and counts the linkage quality.

## Layout

- `src/lib/legislators.ts`: CSV and amount parsing, normalization, filtering. Shared by the build and the browser.
- `src/lib/view.ts`: what each card and detail dialog shows.
- `src/lib/sources.ts`: build-time fetching.
- `src/components/`: pay panel, chamber list, travel panel, detail dialog.
- `src/pages/index.astro`: the page and its tabs.
