# Client pagination and weekly data CI

Adds client-side pagination that respects the active filter to every filtered list, and GitHub Actions workflows that test and build on every push and rebuild weekly to refresh the data.
Read until `## Log`. Technical artifacts in English; UI copy in Spanish (Argentina). Branch feat/viajes.

## Specs

- **S1 (user, verbatim):** "paginar en el cliente, respetando el filtro activo: si filtrás por Tucumán, la paginación cuenta solo esos 9."
- **S2 (user, verbatim):** "y crea el CI para el buld semanlan para actualizarr datos y demas"
- **S3 (lists in scope, parent):** `/diputados/` and `/senado/` lists (src/components/Chamber.astro), the travel table on `/viajes/` (src/components/TravelPanel.astro: search + "solo destacados"), member tables on bloc and committee pages (src/components/entity/MemberFilter.astro).
- **S4 (CI scope, parent):** on push/PR: `npm ci`, `npm test`, `npm run check`, `npm run build`; weekly schedule + manual run: same build with real data, refresh the Senate snapshot (`npm run update-senators`) and commit changed data caches (`src/data/senado-actas.json`, `src/data/senadores.json`) back, and keep the built `dist/` as an artifact. Hosting/deploy is a user decision (no remote, no host chosen yet): not wired.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| P1 | S1, S3 | worker | done | feat(ui): paginate filtered lists |
| C1 | S2, S4 | inline + verify (risk item 5) | done | ci: test and build on every push |

## Log

- L1 (user, verbatim): "Agrega paginaciones despues. Cada cuanto se actualizan los datos ?"
- L2 (user, verbatim): "paginar en
 el cliente, respetando el filtro activo: si filtrás por Tucumán, la paginación cuenta solo esos 9.  y crea el CI para el buld semanlan para actualizarr datos y demas"
- L3 (parent): no git remote and no `.github/`; workflows are written for GitHub Actions and run once the repo is pushed. Recommended cadence: weekly (Monday 09:00 UTC = 06:00 Argentina).
- L4 (parent evidence, P1): parent browser check on /diputados/: "Mostrando 1–25 de 257", pages 1-5…11; filter "Tucumán" → "Mostrando 1–9 de 9", 9 rows, one page (S1); no console errors. Worker checked /senado/ (72 → 3 pages), /viajes/ (solo destacados → 1–2 de 2), UxP bloc (92 → 4 pages, "tucuman" → 2), Presupuesto (47 → 2), 375 px no overflow, JS off shows all rows. npm test 225/225, check 0 errors, build 442 pages.
- L5 (verifier, C1 first pass): S2/S4 failed on one blocker: the senadores.json date filter `git diff | grep | grep -qv` under GitHub's `bash -eo pipefail` silently dropped large real changes (SIGPIPE 141), e.g. a full Senate renewal. Fix: `git diff --quiet -I'"fecha"'`; regression test scripts/weekly-workflow.test.ts (RED observed on the old filter, GREEN after). Also applied advisories: persist-credentials false with the token only in the commit step, `git pull --rebase` before push, snapshot outcome in the summary, README notes (red-run causes, 60-day schedule disable). npm test 228/228, check 0 errors. Re-verify requested.
- L6 (verifier, C1 re-verify): S2 pass, S4 pass. Matrix under `bash -eo pipefail`: unchanged/date-only dropped, real changes kept (large rewrite 20/20, 24-senator renewal 10/10), actas-only committed, upstream commit rebased, real conflict stops before push; regression test fails on the old filter. Not verifiable locally: the actual push to github.com (no remote). Parent applied the last advisories: commit step only on branch refs; README lists npm ci and rebase conflicts as red-run causes.
