import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeTravel,
  modifiedZScores,
  monthsInWindow,
  normalizeTripRows,
  parsePeriod,
  regionOf,
  type Leg,
} from './viajes.ts';

test('parsePeriod reads month abbreviations with a two-digit year', () => {
  assert.equal(parsePeriod('jun-26'), '2026-06');
  assert.equal(parsePeriod('sept-25'), '2025-09');
  assert.equal(parsePeriod('sep-25'), '2025-09');
  assert.equal(parsePeriod('dic-25'), '2025-12');
  assert.equal(parsePeriod('ene-26'), '2026-01');
  assert.equal(parsePeriod(' ENE-26 '), '2026-01');
});

test('parsePeriod reads ISO dates', () => {
  assert.equal(parsePeriod('2025-06-01'), '2025-06');
  assert.equal(parsePeriod('2024-11-30'), '2024-11');
});

test('parsePeriod reads "YYYY - MONTH" with full Spanish month names', () => {
  assert.equal(parsePeriod('2022 - ENERO'), '2022-01');
  assert.equal(parsePeriod('2024 - SEPTIEMBRE'), '2024-09');
});

test('parsePeriod returns null for garbage', () => {
  assert.equal(parsePeriod(''), null);
  assert.equal(parsePeriod('hola'), null);
  assert.equal(parsePeriod('xyz-25'), null);
  assert.equal(parsePeriod('2025-13-01'), null);
});

test('normalizeTripRows resolves uppercase headers with accents and spaces', () => {
  const rows = [{ 'PERÍODO': 'jun-26', DIPUTADO: ' CHICONI RICARDO ABEL ', 'TIPO SOLICITUD': 'AEREO', ORIGEN: 'CABA', DESTINO: 'SAN LUIS' }];
  assert.deepEqual(normalizeTripRows(rows), [
    { period: '2026-06', nombre: 'CHICONI RICARDO ABEL', tipo: 'AEREO', origen: 'CABA', destino: 'SAN LUIS' },
  ]);
});

test('normalizeTripRows resolves PERIODO, DIPUTADOS, TIPO_SOLICITUD and PROVINCIA', () => {
  const rows = [{ PERIODO: 'dic-25', DIPUTADOS: 'PAULI JORGE SANTIAGO', TIPO_SOLICITUD: 'TERRESTRE', ORIGEN: 'USHUAIA', DESTINO: 'RIO GRANDE', PROVINCIA: 'TIERRA DEL FUEGO', BLOQUE: 'X' }];
  assert.deepEqual(normalizeTripRows(rows), [
    { period: '2025-12', nombre: 'PAULI JORGE SANTIAGO', tipo: 'TERRESTRE', origen: 'USHUAIA', destino: 'RIO GRANDE', provincia: 'TIERRA DEL FUEGO' },
  ]);
});

test('normalizeTripRows resolves lowercase and dotted header variants', () => {
  const rows = [
    { mes: '2025-06-01', diputado: 'BECERRA MONICA MARIELA', 'TIPO.SOLICITUD': 'aereo', origen: 'CABA', destino: 'SAN JUAN' },
    { periodo: '2022 - ENERO', diputado: 'BORGATTA ALEJANDRINA BELÉN', tipo_solicitud: 'AEREO', origen: 'CABA', destino: 'RESISTENCIA' },
  ];
  assert.deepEqual(normalizeTripRows(rows), [
    { period: '2025-06', nombre: 'BECERRA MONICA MARIELA', tipo: 'AEREO', origen: 'CABA', destino: 'SAN JUAN' },
    { period: '2022-01', nombre: 'BORGATTA ALEJANDRINA BELÉN', tipo: 'AEREO', origen: 'CABA', destino: 'RESISTENCIA' },
  ]);
});

test('normalizeTripRows drops rows without a parsable period or a name', () => {
  const rows = [
    { PERIODO: 'total', DIPUTADO: 'X', TIPO_SOLICITUD: 'AEREO', ORIGEN: 'A', DESTINO: 'B' },
    { PERIODO: 'jun-26', DIPUTADO: '  ', TIPO_SOLICITUD: 'AEREO', ORIGEN: 'A', DESTINO: 'B' },
    { PERIODO: 'jun-26', DIPUTADO: 'Y', TIPO_SOLICITUD: 'AEREO', ORIGEN: 'A', DESTINO: 'B' },
  ];
  assert.deepEqual(normalizeTripRows(rows).map(r => r.nombre), ['Y']);
});

test('regionOf maps every district of the six regions accent-insensitively', () => {
  const expected: Record<string, string> = {
    'CIUDAD DE BUENOS AIRES': 'AMBA', 'Buenos Aires': 'AMBA',
    'CÓRDOBA': 'Centro', 'SANTA FE': 'Centro', 'Entre Ríos': 'Centro', 'LA PAMPA': 'Centro',
    'MENDOZA': 'Cuyo', 'SAN JUAN': 'Cuyo', 'SAN LUIS': 'Cuyo',
    'JUJUY': 'NOA', 'SALTA': 'NOA', 'TUCUMAN': 'NOA', 'Tucumán': 'NOA', 'CATAMARCA': 'NOA', 'SANTIAGO DEL ESTERO': 'NOA', 'LA RIOJA': 'NOA',
    'CHACO': 'NEA', 'CORRIENTES': 'NEA', 'FORMOSA': 'NEA', 'MISIONES': 'NEA',
    'NEUQUÉN': 'Patagonia', 'RÍO NEGRO': 'Patagonia', 'CHUBUT': 'Patagonia', 'SANTA CRUZ': 'Patagonia', 'TIERRA DEL FUEGO': 'Patagonia',
  };
  for (const [district, region] of Object.entries(expected)) assert.equal(regionOf(district), region, district);
  assert.equal(regionOf(''), null);
  assert.equal(regionOf('ATLANTIDA'), null);
});

const window6 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

test('monthsInWindow counts window months on or after the start month', () => {
  assert.equal(monthsInWindow(window6, '10/12/2023'), 6);
  assert.equal(monthsInWindow(window6, '15/04/2026'), 3);
  assert.equal(monthsInWindow(window6, '01/07/2026'), 0);
});

test('modifiedZScores uses 0.6745 × (x − median) / MAD', () => {
  // median 3, deviations [2,1,0,1,7] → MAD 1
  const z = modifiedZScores([1, 2, 3, 4, 10]);
  const expected = [-2, -1, 0, 1, 7].map(d => 0.6745 * d);
  assert.equal(z.length, 5);
  z.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-12, `z[${i}] = ${v}`));
});

test('modifiedZScores falls back to 1.253314 × mean absolute deviation when MAD is 0', () => {
  // median 2, deviations [0,0,0,0,8] → MAD 0, mean abs dev 1.6
  const z = modifiedZScores([2, 2, 2, 2, 10]);
  const expected = 8 / (1.253314 * 1.6);
  assert.deepEqual(z.slice(0, 4), [0, 0, 0, 0]);
  assert.ok(Math.abs(z[4] - expected) < 1e-12);
});

test('modifiedZScores returns all zeros when MAD and mean absolute deviation are 0', () => {
  assert.deepEqual(modifiedZScores([5, 5, 5]), [0, 0, 0]);
  assert.deepEqual(modifiedZScores([]), []);
});

const legsFor = (deputyId: string, count: number, origen = 'CABA', destino = 'X'): Leg[] =>
  Array.from({ length: count }, (_, i) => ({ deputyId, period: window6[i % 6], tipo: 'AEREO', origen, destino }));

test('analyzeTravel flags an outlier only against its own region (regional fairness)', () => {
  const amba = [0, 1, 2, 2, 3, 18];        // per month: 0, .17, .33, .33, .5, 3
  const patagonia = [30, 36, 42, 42, 48];  // per month: 5, 6, 7, 7, 8
  const deputies = [
    ...amba.map((_, i) => ({ id: `amba${i}`, lugar: 'CIUDAD DE BUENOS AIRES', fechaInicio: '10/12/2023' })),
    ...patagonia.map((_, i) => ({ id: `pat${i}`, lugar: 'NEUQUÉN', fechaInicio: '10/12/2023' })),
  ];
  const legs = [...amba.flatMap((n, i) => legsFor(`amba${i}`, n)), ...patagonia.flatMap((n, i) => legsFor(`pat${i}`, n))];
  const { deputies: stats, regions } = analyzeTravel(deputies, legs, window6);
  const byId = Object.fromEntries(stats.map(s => [s.deputyId, s]));

  assert.equal(byId.amba5.legsPerMonth, 3);
  assert.equal(byId.amba5.regionMedian, 0.33);
  assert.equal(byId.amba5.flagged, true);
  assert.ok((byId.amba5.z ?? 0) > 3.5);
  // Every Patagonia deputy travels more than the AMBA outlier, yet none is flagged.
  for (let i = 0; i < patagonia.length; i++) {
    assert.ok(byId[`pat${i}`].legsPerMonth > byId.amba5.legsPerMonth);
    assert.equal(byId[`pat${i}`].flagged, false);
    assert.equal(byId[`pat${i}`].regionMedian, 7);
  }
  assert.equal(byId.amba0.legs, 0);
  assert.equal(byId.amba0.legsPerMonth, 0);
  assert.equal(byId.amba0.flagged, false);
  assert.deepEqual(regions, [
    { region: 'AMBA', deputies: 6, medianLegsPerMonth: 0.33 },
    { region: 'Patagonia', deputies: 5, medianLegsPerMonth: 7 },
  ]);
});

test('analyzeTravel rounds legsPerMonth, regionMedian and z to 2 decimals', () => {
  const deputies = ['a', 'b', 'c'].map(id => ({ id, lugar: 'SALTA', fechaInicio: '10/12/2023' }));
  const legs = [...legsFor('a', 1), ...legsFor('b', 2), ...legsFor('c', 7)];
  const { deputies: stats } = analyzeTravel(deputies, legs, window6);
  assert.deepEqual(stats.map(s => s.legsPerMonth), [0.17, 0.33, 1.17]);
  assert.deepEqual(stats.map(s => s.regionMedian), [0.33, 0.33, 0.33]);
  // median 2/6, MAD 1/6 → z = 0.6745 × (x − 2) / 1
  assert.deepEqual(stats.map(s => s.z), [-0.67, 0, 3.37]);
});

test('analyzeTravel excludes deputies with fewer than 3 months from peers and flags', () => {
  const deputies = [
    ...['a', 'b', 'c'].map(id => ({ id, lugar: 'SALTA', fechaInicio: '10/12/2023' })),
    { id: 'new', lugar: 'SALTA', fechaInicio: '05/05/2026' },
  ];
  const legs = [...legsFor('a', 6), ...legsFor('b', 6), ...legsFor('c', 6),
    ...Array.from({ length: 40 }, () => ({ deputyId: 'new', period: '2026-06', tipo: 'AEREO', origen: 'A', destino: 'B' }))];
  const { deputies: stats, regions } = analyzeTravel(deputies, legs, window6);
  const fresh = stats.find(s => s.deputyId === 'new')!;
  assert.equal(fresh.months, 2);
  assert.equal(fresh.eligible, false);
  assert.equal(fresh.z, null);
  assert.equal(fresh.flagged, false);
  assert.equal(fresh.legsPerMonth, 20);
  assert.equal(fresh.regionMedian, 1);
  assert.deepEqual(regions, [{ region: 'NOA', deputies: 3, medianLegsPerMonth: 1 }]);
});

test('analyzeTravel computes months from a mid-window start and ignores legs outside office or window', () => {
  const deputies = [{ id: 'mid', lugar: 'MENDOZA', fechaInicio: '20/03/2026' }];
  const legs: Leg[] = [
    { deputyId: 'mid', period: '2026-02', tipo: 'AEREO', origen: 'A', destino: 'B' },
    { deputyId: 'mid', period: '2025-12', tipo: 'AEREO', origen: 'A', destino: 'B' },
    { deputyId: 'mid', period: '2026-03', tipo: 'AEREO', origen: 'A', destino: 'B' },
    { deputyId: 'mid', period: '2026-06', tipo: 'AEREO', origen: 'A', destino: 'B' },
  ];
  const [stat] = analyzeTravel(deputies, legs, window6).deputies;
  assert.equal(stat.months, 4);
  assert.equal(stat.legs, 2);
  assert.equal(stat.legsPerMonth, 0.5);
  assert.equal(stat.eligible, true);
});

test('analyzeTravel treats A→B and B→A as one route, ordered and tie-broken alphabetically', () => {
  const deputies = [
    { id: 'r', lugar: 'JUJUY', fechaInicio: '10/12/2023' },
    { id: 't', lugar: 'JUJUY', fechaInicio: '10/12/2023' },
    { id: 'none', lugar: 'JUJUY', fechaInicio: '10/12/2023' },
  ];
  const legs: Leg[] = [
    { deputyId: 'r', period: '2026-01', tipo: 'AEREO', origen: 'SAN SALVADOR DE JUJUY', destino: 'CABA' },
    { deputyId: 'r', period: '2026-01', tipo: 'AEREO', origen: 'CABA', destino: 'SAN SALVADOR DE JUJUY' },
    { deputyId: 'r', period: '2026-02', tipo: 'AEREO', origen: 'CABA', destino: 'SALTA' },
    { deputyId: 'r', period: '2026-02', tipo: 'AEREO', origen: 'CABA', destino: 'SALTA' },
    { deputyId: 'r', period: '2026-02', tipo: 'AEREO', origen: 'SAN SALVADOR DE JUJUY', destino: 'CABA' },
    { deputyId: 't', period: '2026-01', tipo: 'AEREO', origen: 'SALTA', destino: 'CABA' },
    { deputyId: 't', period: '2026-01', tipo: 'AEREO', origen: 'JUJUY', destino: 'CABA' },
  ];
  const stats = analyzeTravel(deputies, legs, window6).deputies;
  assert.deepEqual(stats[0].topRoute, { origen: 'CABA', destino: 'SAN SALVADOR DE JUJUY', count: 3 });
  assert.deepEqual(stats[1].topRoute, { origen: 'CABA', destino: 'JUJUY', count: 1 });
  assert.equal(stats[2].topRoute, null);
});

test('analyzeTravel counts legs per semester', () => {
  const window = ['2025-11', '2025-12', '2026-01', '2026-02'];
  const deputies = [{ id: 'd', lugar: 'CHACO', fechaInicio: '10/12/2023' }];
  const legs: Leg[] = ['2025-11', '2025-12', '2025-12', '2026-02'].map(period => ({ deputyId: 'd', period, tipo: 'AEREO', origen: 'A', destino: 'B' }));
  const [stat] = analyzeTravel(deputies, legs, window).deputies;
  assert.deepEqual(stat.bySemester, { '2025-S2': 3, '2026-S1': 1 });
});

test('analyzeTravel gives deputies without a known region null region and z', () => {
  const { deputies: stats, regions } = analyzeTravel(
    [{ id: 'x', lugar: 'ATLANTIDA', fechaInicio: '10/12/2023' }],
    legsFor('x', 3),
    window6,
  );
  assert.equal(stats[0].region, null);
  assert.equal(stats[0].z, null);
  assert.equal(stats[0].regionMedian, null);
  assert.equal(stats[0].flagged, false);
  assert.equal(stats[0].eligible, true);
  assert.equal(stats[0].legs, 3);
  assert.deepEqual(regions, []);
});
