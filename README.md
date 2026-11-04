# Congreso Abierto

Live site: https://congreso-abierto-iota.vercel.app (deployed by Vercel on every push to `main`).

Astro static site that lists Argentina's national legislators and the monthly pay the Chamber of Deputies publishes.

Data is fetched at build time, in Node, so the Senate API's missing CORS headers do not matter. Rebuild to refresh the data.

The index has four tabs (Diputados, Senadores, Viajes, Proyectos). Every legislator in office also gets a static page, `/diputados/<id>/` and `/senadores/<id>/`, with the full detail (committees, bills, missions, votes); the index dialog keeps a summary and links to it, so `index.html` stays light.

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
| Misiones oficiales | [HCDN Misiones Oficiales](https://datos.hcdn.gob.ar/dataset/misiones-oficiales), every CSV named with a year since 2024 | Viajes tab and deputy pages: dates, place, purpose, inviting institution, viáticos per currency. |
| Comisiones | [HCDN Comisiones](https://datos.hcdn.gob.ar/dataset/comisiones): committees, permanent committee members and authorities | Deputy pages: each committee with the deputy's role. Linked against the deputies of the current legislative period. |
| Proyectos | [HCDN Proyectos Parlamentarios](https://datos.hcdn.gob.ar/dataset/proyectos-parlamentarios) and [Movimientos de Proyectos](https://datos.hcdn.gob.ar/dataset/movimientos-de-proyectos) | Bills published since 2024-01-01, by first signer. The furthest stage comes from the movements, which record floor and presidency actions only (no routine committee referral, no dictamen), so "presentado" means "no recorded movement shows progress" and "sancionado" is not "es ley". Proyectos tab and legislator pages. |
| Votaciones del Senado | [Senado actas](https://www.senado.gob.ar/votaciones/actas), official HTML (index per year and one detail page per acta) | Actas since 2024, cancelled ones dropped. Parsed actas are cached in `src/data/senado-actas.json` (committed data); each build fetches the index and only the actas missing from the cache (at most 4 requests at a time, 30 s timeout, retries) and rewrites the cache when it adds any. If the Senate site fails, the cache is used and the page says so. |

`HCDN Legisladores`, resource "Diputados" (the historic roster with mandate dates), is used only for linking: former deputies of a source's period count as matched, not unmatched.

The full build downloads every source once (loaders are memoized) and peaks at about 1.5 GB of memory, mostly parsing the 32 MB bills CSV; give Node that much on CI.

## Data updates

The site is static and builds from a committed data snapshot, so the data is as fresh as the last refresh.

### Snapshot

`datos.hcdn.gob.ar` refuses connections from outside Argentina (GitHub runners, cloud hosts), so fetching and building are separate steps:

| Command | `DATA_MODE` | What it does |
| --- | --- | --- |
| `npm run build` | `snapshot` (default) | Reads `src/data/snapshot/` and never touches the network. A missing entry stops the build with `Data snapshot missing: <name> — run npm run refresh-data`. |
| `npm run refresh-data` | `refresh` | Fetches every official source live, rewrites `src/data/snapshot/`, then builds from what it wrote. Needs a network that reaches the official sites. |

- `src/data/snapshot/<name>.json` holds the processed output of each page loader: `deputies`, `pay`, `senators`, `travel`, `committees`, `bills`, `missions`, `senate-votes`. The raw CSVs are not stored. Maps are written as `{"$map": [[key, value], …]}` sorted by key, with one entry per line, so unchanged data gives an unchanged file and a change shows as a small diff.
- `src/data/snapshot/meta.json`: `generatedAt` is the last refresh run. Under `sources.<name>`, `fetchedAt` is the refresh that last changed that entry, plus `contentHash` (sha256 of the file), `items` and the source `period` when it has one. Pages say "vigente al" with the date of `generatedAt`.
- Senate votes still use the cache `src/data/senado-actas.json`. A refresh adds the missing actas; a snapshot build reads the cache without fetching.
- `npm run update-senators` still refreshes `src/data/senadores.json`, the fallback a refresh uses when the Senate API is down.

### Weekly refresh

The refresh runs on the owner's Mac, which reaches the official sites; GitHub only tests, builds and watches freshness.

| Piece | When | What it does |
| --- | --- | --- |
| `scripts/weekly-refresh.sh` | Mondays 06:00 (launchd) or by hand | In a separate worktree on `origin/main` (`.refresh-worktree/`, ignored): `npm ci`, `npm run update-senators`, `npm run refresh-data`, `npm test`, `npm run build`, then commits `src/data/` and pushes to `main`. Your working copy is never touched. `senadores.json` is kept only when the senators changed, not just its date. |
| `scripts/install-weekly-refresh.sh` | Once | Installs the launchd agent `ar.congreso-abierto.weekly-refresh` (`~/Library/LaunchAgents/`), log in `~/Library/Logs/congreso-abierto/weekly-refresh.log`. A run missed while the Mac sleeps starts on wake. Remove it with `--uninstall`; run it now with `launchctl kickstart -k gui/$(id -u)/ar.congreso-abierto.weekly-refresh`. |
| `.github/workflows/ci.yml` | Every push and pull request | `npm ci`, `npm test`, `npm run check`, `npm run build` from the snapshot (no network) |
| `.github/workflows/weekly-data.yml` | Mondays 15:00 UTC (12:00 in Argentina), or manually | `node scripts/snapshot-age.ts 14`: fails when `meta.json` is older than 14 days, so a stopped Mac refresh gets noticed |

Notes:

- The push uses the Mac's git credentials (here `gh auth git-credential`); the commit author is the Mac's git identity.
- Deploy: Vercel builds every push to `main` from the snapshot (`vercel.json`: `npm ci`, `npm run build`, `dist/`), so each weekly data push publishes. `SITE_URL` (Vercel environment variable) sets absolute Open Graph URLs.
- GitHub disables scheduled workflows in public repositories after 60 days without activity; the weekly refresh commits keep it active.
- `scripts/weekly-refresh.test.ts` checks the senators-date rule under `set -euo pipefail`; `scripts/snapshot-age.test.ts` checks the freshness rule. Both run with `npm test`.

Observed publishing rhythm of the sources: Senate votes after every session; bills and movements frequently; committees and blocs when they change; pay when the amounts change; domestic trips and official missions once per semester, about two months after it ends.

## Algorithms

- **Record linkage** (`src/lib/linkage.ts`): trip files name deputies as `APELLIDO NOMBRES` with full given names; the composition uses `Apellido, Nombres` with short ones. Names are accent-stripped, tokenized and compared word by word with Jaro-Winkler: every surname token must match one of the first trip tokens, and given names (or initials) must match distinct remaining tokens. The confidence score mixes the share of matched tokens and their average similarity. A row is assigned only when the best candidate scores at least 0.9 and beats the runner-up by 0.05; ties and low scores are reported as doubtful and never assigned. The Viajes tab shows the match rate and the doubtful list.
- **Estimated distance** (`src/lib/distance.ts`, `src/data/endpoints.json`): every ORIGEN/DESTINO name in the trip files is normalized to a key and placed with public coordinates (airports from ANAC/ORSNA and Wikipedia, bus terminals at the city centre); Buenos Aires terminals (Aeroparque, Ezeiza, Retiro, Liniers) are hubs. A deputy's home is the non-hub endpoint in their own district that the most legs touch, with at least 3 legs; otherwise the district capital. The distance is the haversine km from that home to the Obelisco. It is an estimate and the page says so.
- **Robust outliers** (`src/lib/viajes.ts`): the metric is trip legs per month in office within the window. Each deputy is compared with deputies at a similar estimated distance, in bands `< 100 km`, `100–400`, `400–800`, `800–1200` and `≥ 1200 km`. Walking from the farthest band, a band with fewer than 5 eligible deputies merges into the adjacent nearer one (the nearest merges into the next), and the merged label spans both, for example `≥ 800 km`. Within a band the Iglewicz-Hoaglin modified z-score, `0.6745 × (x − median) / MAD`, keeps a few extreme values from moving the baseline. A z above 3.5 is shown as "viaja bastante más que sus pares"; deputies with fewer than 3 months in the window are not compared. The region (CABA, Buenos Aires, Centro, Cuyo, NOA, NEA, Patagonia) is only displayed.
- `src/lib/travel-report.ts` picks the window, builds the legs from matched rows only and counts the linkage quality.
- **One linker for every source** (`src/lib/link-policy.ts` on top of `src/lib/linkage.ts`): committees, missions and bills link against the deputies in office during each source's period (HCDN roster), Senate votes and Senate-origin bills against current senators plus the former ones listed in the actas. Each tab or page shows its quality box: names matched to someone in office today, to a former legislator, doubtful (never assigned) and unmatched. Rows assigned in the build of 2026-11-03: committees 99.6 % (1,612 of 1,618), missions 97 % (65 of 67), Diputados-origin bills 99.1 % (14,523 of 14,651; unmatched authors are mostly committees, the Chamber and the Executive), Senate-origin bills 51.7 % (31 of 60), Senate votes 100 % (24,912 of 24,912).
- **Senate votes** (`src/lib/senado-votos.ts`): per senator, actas in office, votes by type, attendance = (actas − ausente) / actas and bloc loyalty = share of votes cast equal to the bloc's majority in that acta (with the number of actas counted). Per bloc, the Rice index \|yes − no\| / (yes + no) averaged over the actas where the bloc voted, shown with its number of senators and actas.

## Layout

- `src/lib/legislators.ts`: CSV and amount parsing, normalization, filtering. Shared by the build and the browser.
- `src/lib/view.ts`: what each card and detail dialog shows, formatting helpers and the dataset links.
- `src/lib/sources.ts`: build-time loading, from the snapshot or live (`DATA_MODE`).
- `src/lib/snapshot.ts`: snapshot serialization (tagged Maps and Sets, stable layout) and `meta.json` updates.
- `src/lib/legislator-profile.ts`: each legislator's committees, bills, missions and votes.
- `src/components/`: pay panel, chamber list, travel, missions, bills and Senate votes panels, quality box, source line, detail dialog.
- `src/pages/index.astro`: the page and its tabs.
- `src/pages/diputados/[id].astro`, `src/pages/senadores/[id].astro`: per-legislator pages, sharing `src/layouts/LegislatorLayout.astro`.
