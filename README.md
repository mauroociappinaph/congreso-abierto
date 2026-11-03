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
| Senadores | [Senado Datos Abiertos](https://www.senado.gob.ar/micrositios/DatosAbiertos/) | If the API fails during the build, `src/data/senadores.json` is used and the page says so. |

## Layout

- `src/lib/legislators.ts`: CSV and amount parsing, normalization, filtering. Shared by the build and the browser.
- `src/lib/view.ts`: what each card and detail dialog shows.
- `src/lib/sources.ts`: build-time fetching.
- `src/components/`: pay panel, chamber list, detail dialog.
- `src/pages/index.astro`: the page and its tabs.
