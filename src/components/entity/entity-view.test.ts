import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BandMedian, TravelPoint } from '../../lib/entities.ts';
import { blocSegments, committeeTitle, flaggedSentence, searchText, travelRows, travelTag } from './entity-view.ts';

const NEAR = '< 100 km';
const FAR = '800–1200 km';
const point = (id: string, nombre: string, legsPerMonth: number, band: string | null, status: TravelPoint['status']): TravelPoint => ({
  id, nombre, legs: Math.round(legsPerMonth * 24), legsPerMonth, band, flagged: status === 'viaja-mas', status,
});
const bands: BandMedian[] = [
  { band: NEAR, deputies: 86, median: 0.33 },
  { band: '100–400 km', deputies: 32, median: 3.23 },
  { band: FAR, deputies: 62, median: 5.93 },
];

test('committeeTitle names the committee published without a name by its id', () => {
  assert.equal(committeeTitle('HCDN00064', 'Hcdn00064'), 'Comisión sin nombre publicado (HCDN00064)');
  assert.equal(committeeTitle('HCDN00064', ''), 'Comisión sin nombre publicado (HCDN00064)');
  assert.equal(committeeTitle('HCDN00064', '  '), 'Comisión sin nombre publicado (HCDN00064)');
  assert.equal(committeeTitle('HCDN00002', 'Accion Social y Salud Publica'), 'Accion Social y Salud Publica');
});

test('travelRows keeps one row per band with members, flags who travels more and leaves the uncompared out', () => {
  const { rows, omitted } = travelRows(
    [
      point('a', 'Monzón, Roxana', 2.67, NEAR, 'viaja-mas'),
      point('b', 'Aguirre, Hilda', 0.29, NEAR, 'en-linea'),
      point('c', 'Cisneros, Carlos', 0, FAR, 'sin-tramos'),
      point('d', 'Yedlin, Pablo Raúl', 7.71, FAR, 'en-linea'),
      point('e', 'Nuevo, Juan', 1, FAR, 'no-comparado'),
      point('f', 'Lejos, Ana', 3, null, 'sin-distancia'),
    ],
    bands,
  );
  assert.equal(omitted, 2);
  assert.deepEqual(rows.map(r => [r.label, r.median, r.points.length]), [[NEAR, 0.33, 2], [FAR, 5.93, 2]]);
  assert.deepEqual(rows[0].points[0], { value: 2.67, flag: true, label: 'Monzón 2,67' });
  assert.deepEqual(rows[0].points[1], { value: 0.29, flag: false, label: undefined });
  assert.deepEqual(rows[1].points.map(p => p.value), [0, 7.71]);
});

test('travelTag lists only the non-empty outcomes with S4 wording', () => {
  assert.equal(
    travelTag({ 'en-linea': 91, 'viaja-mas': 1, 'sin-tramos': 0, 'no-comparado': 0, 'sin-distancia': 0 }),
    '91 en línea · 1 viaja bastante más que sus pares',
  );
  assert.equal(
    travelTag({ 'en-linea': 1, 'viaja-mas': 2, 'sin-tramos': 3, 'no-comparado': 1, 'sin-distancia': 2 }),
    '1 en línea · 2 viajan bastante más que sus pares · 3 sin tramos registrados · 3 no comparados',
  );
  assert.equal(travelTag({ 'en-linea': 0, 'viaja-mas': 0, 'sin-tramos': 0, 'no-comparado': 0, 'sin-distancia': 0 }), 'Sin datos de viajes');
});

test('flaggedSentence describes the gap with its band median, never a judgment', () => {
  assert.equal(
    flaggedSentence(point('a', 'Monzón, Roxana', 2.67, NEAR, 'viaja-mas'), bands),
    'Monzón, Roxana: 2,67 tramos por mes frente a una mediana de 0,33 en su grupo (< 100 km); viaja bastante más que sus pares a distancia similar.',
  );
});

test('blocSegments keeps the largest blocs, groups the rest and shares add up to the total', () => {
  const mix = [7, 5, 4, 3, 2, 1, 1].map((count, i) => ({ slug: `b${i}`, titulo: `Bloque ${i}`, url: `/bloques/diputados/b${i}/`, count }));
  const segments = blocSegments(mix, 4);
  assert.deepEqual(segments.map(s => [s.label, s.count, s.color]), [
    ['Bloque 0', 7, 'var(--bloc-1)'],
    ['Bloque 1', 5, 'var(--bloc-2)'],
    ['Bloque 2', 4, 'var(--bloc-3)'],
    ['Bloque 3', 3, 'var(--bloc-4)'],
    ['Otros 3 bloques', 4, 'var(--bloc-other)'],
  ]);
  assert.equal(segments[0].url, '/bloques/diputados/b0/');
  assert.equal(segments.at(-1)!.url, null);
  assert.equal(Math.round(segments.reduce((t, s) => t + s.share, 0) * 1000) / 1000, 1);
  assert.deepEqual(blocSegments(mix.slice(0, 2), 4).map(s => s.label), ['Bloque 0', 'Bloque 1']);
  assert.deepEqual(blocSegments(mix.slice(0, 5), 4).at(-1), { label: 'Bloque 4', count: 2, share: 2 / 21, color: 'var(--bloc-other)', url: '/bloques/diputados/b4/' });
  assert.deepEqual(blocSegments([], 4), []);
});

test('searchText folds accents and case for the client filter', () => {
  assert.equal(searchText('Monzón, Roxana', 'Entre Ríos'), 'monzon, roxana entre rios');
});
