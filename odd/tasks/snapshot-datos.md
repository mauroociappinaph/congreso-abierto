# Data snapshot and weekly refresh from Argentina

datos.hcdn.gob.ar refuses connections from GitHub's runners (ETIMEDOUT), and any cloud host would hit the same wall. Split "fetch data" from "build": a refresh run fetches the official sources and writes a committed snapshot; every build (CI, hosting, local) reads only the snapshot. A weekly task on the owner's Mac refreshes and pushes.
Read until `## Log`. Technical artifacts in English. Branch: main (pushed to github.com/mauroociappinaph/congreso-abierto).

## Specs

- **S1 (user choice, verbatim):** "Snapshot + tarea semanal en mi Mac (Recomendado)" — option text: "Los datos se bajan en tu Mac con launchd y se pushean; CI y hosting compilan desde el snapshot commiteado, sin depender de la red oficial."
- **S2 (build offline):** `npm run build` (default) never touches the network and fails loudly with a clear message when a snapshot entry is missing. `npm run refresh-data` fetches every official source live, writes the snapshot, then the build uses it.
- **S3 (snapshot content):** store the outputs of the public loaders the pages use (deputies, pay, senators, travel report, committees, bills, missions, Senate votes; Senate actas cache stays as is), compact JSON with Maps serialized, deterministic ordering and formatting so unchanged data produces no diff, plus `meta.json` with fetch date per source. Keep the repository small: report sizes; prefer processed data over raw files.
- **S4 (weekly refresh on the Mac):** a script that pulls, refreshes, runs tests and build, commits the snapshot only when it changed, and pushes to main with the owner's existing git credentials; a launchd agent runs it weekly (Monday 06:00 local) with logs; install/uninstall commands documented.
- **S5 (CI):** `ci.yml` builds from the snapshot (green on GitHub). `weekly-data.yml` no longer fetches; it checks snapshot freshness weekly and fails when `meta.json` is older than 14 days (so a stopped Mac task is noticed).

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| N1 | S2, S3 | worker | done | feat(data): build from a committed snapshot |
| N2 | S4, S5 | inline | done | ci: refresh data weekly from the Mac |

## Log

- L1 (evidence): CI on GitHub failed three times: "HCDN: could not load dataset … fetch failed (ETIMEDOUT: )" for `legisladores` and `dietas-y-gastos-de-representacion-legisladores-as`; locally the same fetches succeed.
- L2 (user choice, verbatim): "Snapshot + tarea semanal en mi Mac (Recomendado)". Self-hosted GitHub runner rejected: on a public repo, PRs from forks could run code on the owner's machine.
- L3 (evidence, N1): offline build with fetch/http/https/net blocked: 442 pages, dist byte-identical to the refresh build and to the earlier live build. Snapshot 728 KB (117 KB gz). Two refreshes in a row differ only in meta.generatedAt. Missing entry fails with "Data snapshot missing: travel — run npm run refresh-data". npm test 242/242.
- L4 (evidence, N2 end to end): launchd agent `ar.congreso-abierto.weekly-refresh` installed (Mondays 06:00); first run via kickstart: worktree on origin/main, npm ci, update-senators, refresh-data (27 s), tests 245/245, build, pushed 24b78ca (only meta.json changed, same day), exit 0, worktree removed. GitHub: CI green on 24b78ca; "Weekly snapshot freshness" (workflow_dispatch) green: "Snapshot generated 2026-11-04 (0 days ago)". Note: CI on GitHub was red three times before the snapshot (ETIMEDOUT), green since 9237f9d.
