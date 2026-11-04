#!/usr/bin/env bash
# Weekly data refresh. Runs on a machine that can reach datos.hcdn.gob.ar (GitHub's runners cannot):
# refreshes the snapshot in a separate worktree on origin/main, tests and builds it, then commits and pushes.
# The working copy you develop in is never touched.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
worktree="$repo/.refresh-worktree"
branch="main"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

cleanup() {
  cd "$repo"
  git worktree remove --force "$worktree" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "Refresh started in $repo"
cd "$repo"
git fetch --quiet origin "$branch"
git worktree remove --force "$worktree" >/dev/null 2>&1 || true
git worktree add --quiet --detach "$worktree" "origin/$branch"
cd "$worktree"

log "Installing dependencies"
npm ci --no-audit --no-fund --loglevel=error

# The senators snapshot is only the fallback for a Senate outage, so a failure here must not stop the refresh.
log "Refreshing the Senate snapshot"
npm run --silent update-senators || log "WARNING: Senate snapshot refresh failed; keeping the committed one"

log "Fetching official sources (npm run refresh-data)"
npm run --silent refresh-data

log "Testing and building from the new snapshot"
npm test --silent
npm run --silent build

# meta.json records when the data was fetched, so the weekly run is always committed: the CI freshness check
# relies on it. The senators snapshot is kept only when the senators changed, not just its date.
if git diff --quiet -I'"fecha"' -- src/data/senadores.json; then
  git checkout -- src/data/senadores.json
fi
git add src/data
if git diff --cached --quiet; then
  log "No data changes to commit"
  exit 0
fi
git commit --quiet -m "chore(data): weekly refresh of official sources"

# Someone may have pushed while the refresh ran.
git pull --quiet --rebase origin "$branch"
git push --quiet origin "HEAD:$branch"
log "Pushed $(git rev-parse --short HEAD) to $branch"
