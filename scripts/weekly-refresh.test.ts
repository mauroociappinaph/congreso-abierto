// The weekly refresh (scripts/weekly-refresh.sh) keeps src/data/senadores.json only when the senators
// changed, under the `set -euo pipefail` that script runs with. Runs the filter line of that script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workflow = readFileSync(new URL('./weekly-refresh.sh', import.meta.url), 'utf8');
const filter = workflow
  .split('\n')
  .find(line => line.includes('src/data/senadores.json') && line.trim().startsWith('if '))!
  .trim();

const snapshot = (rows: number, fecha: string, tag = '') =>
  JSON.stringify(
    {
      fuente: 'x',
      fecha,
      rows: Array.from({ length: rows }, (_, i) => ({
        ID: String(i), BLOQUE: `B${tag}${i}`, APELLIDO: `A${tag}${i}`, NOMBRE: `N${tag}${i}`, EMAIL: `e${tag}${i}@x`, FOTO: `f${tag}${i}`.repeat(20),
      })),
    },
    null,
    2,
  ) + '\n';

function decide(before: string, after: string): 'keep' | 'drop' {
  const dir = mkdtempSync(join(tmpdir(), 'weekly-'));
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
    mkdirSync(join(dir, 'src/data'), { recursive: true });
    git('init', '-q');
    writeFileSync(join(dir, 'src/data/senadores.json'), before);
    git('add', '.');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
    writeFileSync(join(dir, 'src/data/senadores.json'), after);
    execFileSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', `${filter}\n  git checkout -- src/data/senadores.json\nfi`], { cwd: dir });
    return readFileSync(join(dir, 'src/data/senadores.json'), 'utf8') === after ? 'keep' : 'drop';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a date-only snapshot change is dropped', () => {
  assert.equal(decide(snapshot(72, '2026-11-03'), snapshot(72, '2026-11-10')), 'drop');
});

test('a small real senator change is kept', () => {
  assert.equal(decide(snapshot(72, '2026-11-03'), snapshot(72, '2026-11-10').replace('"B0"', '"NUEVO"')), 'keep');
});

test('a full renewal of the senators is kept every time', () => {
  for (let i = 0; i < 10; i++) assert.equal(decide(snapshot(72, '2026-11-03'), snapshot(72, '2026-12-11', 'new')), 'keep');
});
