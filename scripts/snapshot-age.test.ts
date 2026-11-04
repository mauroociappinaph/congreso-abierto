import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotAge } from './snapshot-age.ts';

const now = new Date('2026-11-20T12:00:00Z');

test('a snapshot generated within the limit is fresh', () => {
  assert.deepEqual(snapshotAge({ generatedAt: '2026-11-16T09:00:00Z' }, now, 14), { ok: true, days: 4, message: 'Snapshot generated 2026-11-16 (4 days ago).' });
});

test('a snapshot older than the limit is stale and says how to fix it', () => {
  const result = snapshotAge({ generatedAt: '2026-11-01T09:00:00Z' }, now, 14);
  assert.equal(result.ok, false);
  assert.equal(result.days, 19);
  assert.equal(result.message, 'Snapshot generated 2026-11-01 (19 days ago), older than 14 days: check the weekly refresh on the Mac (scripts/weekly-refresh.sh).');
});

test('a missing or invalid date is stale', () => {
  assert.equal(snapshotAge({}, now, 14).ok, false);
  assert.equal(snapshotAge({ generatedAt: 'ayer' }, now, 14).message, 'Snapshot meta.json has no valid generatedAt.');
});
