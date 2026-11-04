// Fails when the committed data snapshot is older than a limit, so a stopped weekly refresh gets noticed.
// Usage: node scripts/snapshot-age.ts [maxDays=14]
import { readFileSync } from 'node:fs';

const DAY = 24 * 60 * 60 * 1000;

export function snapshotAge(meta: { generatedAt?: string }, now: Date, maxDays: number): { ok: boolean; days: number | null; message: string } {
  const generated = meta.generatedAt ? new Date(meta.generatedAt) : null;
  if (!generated || Number.isNaN(generated.getTime())) {
    return { ok: false, days: null, message: 'Snapshot meta.json has no valid generatedAt.' };
  }
  const days = Math.floor((now.getTime() - generated.getTime()) / DAY);
  const when = `Snapshot generated ${generated.toISOString().slice(0, 10)} (${days} days ago)`;
  return days <= maxDays
    ? { ok: true, days, message: `${when}.` }
    : { ok: false, days, message: `${when}, older than ${maxDays} days: check the weekly refresh on the Mac (scripts/weekly-refresh.sh).` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const meta = JSON.parse(readFileSync(new URL('../src/data/snapshot/meta.json', import.meta.url), 'utf8'));
  const result = snapshotAge(meta, new Date(), Number(process.argv[2] ?? 14));
  console.log(result.message);
  process.exit(result.ok ? 0 : 1);
}
