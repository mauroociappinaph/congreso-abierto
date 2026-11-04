import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, matchRanges, searchEntries, type SearchEntry } from './search.ts';

const entries: SearchEntry[] = [
  { type: 'Diputados', name: 'Yedlin, Pablo Raúl', meta: 'Tucumán · Unión por la Patria', href: '/diputados/yedlin/' },
  { type: 'Diputados', name: 'Campero, Mariano', meta: 'Tucumán · La Libertad Avanza', href: '/diputados/campero/' },
  { type: 'Senadores', name: 'Manzur, Juan Luis', meta: 'Tucumán · Justicialista', href: '/senadores/manzur/' },
  { type: 'Provincias', name: 'Tucumán', meta: '9 diputados · 3 senadores', href: '/provincias/tucuman/' },
  { type: 'Comisiones', name: 'Acción Social y Salud Pública', meta: 'Diputados', href: '/comisiones/1/' },
  { type: 'Bloques', name: 'Unión por la Patria', meta: 'Diputados', href: '/bloques/uxp/' },
];

test('fold drops accents and case', () => {
  assert.equal(fold('Tucumán ACCIÓN Ñandú'), 'tucuman accion nandu');
});

test('searchEntries matches without accents and groups by type in the given order', () => {
  const groups = searchEntries(entries, 'tucu', { order: ['Provincias', 'Diputados', 'Senadores'] });
  assert.deepEqual(groups.map(g => [g.type, g.total, g.entries.map(e => e.name)]), [
    ['Provincias', 1, ['Tucumán']],
    ['Diputados', 2, ['Campero, Mariano', 'Yedlin, Pablo Raúl']],
    ['Senadores', 1, ['Manzur, Juan Luis']],
  ]);
});

test('searchEntries ranks name matches before meta matches and needs every word', () => {
  const groups = searchEntries(entries, 'union patria');
  assert.deepEqual(groups.map(g => [g.type, g.entries.map(e => e.name)]), [
    ['Diputados', ['Yedlin, Pablo Raúl']],
    ['Bloques', ['Unión por la Patria']],
  ]);
  assert.deepEqual(searchEntries(entries, 'salud publica').map(g => g.entries[0].name), ['Acción Social y Salud Pública']);
  assert.deepEqual(searchEntries(entries, 'accion tucuman'), []);
});

test('searchEntries ignores queries shorter than two letters and caps each group', () => {
  assert.deepEqual(searchEntries(entries, ' t '), []);
  const [diputados] = searchEntries(entries, 'tucuman', { order: ['Diputados'], perGroup: 1 });
  assert.equal(diputados.total, 2);
  assert.deepEqual(diputados.entries.map(e => e.name), ['Campero, Mariano']);
});

test('matchRanges finds each query word in the original text, accents included', () => {
  assert.deepEqual(matchRanges('Acción Social y Salud Pública', 'accion publica'), [[0, 6], [22, 29]]);
  assert.deepEqual(matchRanges('Tucumán', 'tucuman'), [[0, 7]]);
  assert.deepEqual(matchRanges('Tucumán', 'salta'), []);
});

test('searchEntries also matches hidden keywords such as province aliases, ranked like meta matches', () => {
  const entries: SearchEntry[] = [
    { type: 'Provincias', name: 'Ciudad de Buenos Aires', meta: '25 diputados · 3 senadores', href: '/provincias/ciudad-de-buenos-aires/', keywords: 'caba capital federal' },
    { type: 'Provincias', name: 'Buenos Aires', meta: '70 diputados · 3 senadores', href: '/provincias/buenos-aires/' },
  ];
  const groups = searchEntries(entries, 'caba');
  assert.deepEqual(groups.map(g => g.entries.map(e => e.name)), [['Ciudad de Buenos Aires']]);
});
