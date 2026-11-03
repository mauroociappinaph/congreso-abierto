import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTravelReport, semesterLabel } from './travel-report.ts';
import type { TripRow } from './viajes.ts';

const deputies = [
  { id: 'dip-chiconi', nombre: 'Chiconi, Abel', lugar: 'LA PAMPA', fechaInicio: '10/12/2023' },
  { id: 'dip-torres-jujuy', nombre: 'Torres, Juan', lugar: 'JUJUY', fechaInicio: '10/12/2023' },
  { id: 'dip-torres-salta', nombre: 'Torres, Juan', lugar: 'SALTA', fechaInicio: '10/12/2023' },
];

const trip = (period: string, nombre: string, provincia?: string): TripRow => ({
  period, nombre, tipo: 'AEREO', origen: 'AEROPARQUE', destino: 'SANTA ROSA', ...(provincia ? { provincia } : {}),
});

// 2024 style file with PROVINCIA: 2024-S1 (dropped), 2024-S2, 2025-S1.
const fileA = [
  trip('2024-03', 'GOMEZ ANA', 'Salta'),
  trip('2024-08', 'CHICONI RICARDO ABEL', 'La Pampa'),
  trip('2025-02', 'CHICONI RICARDO ABEL', 'La Pampa'),
  trip('2025-02', 'PEREZ ROBERTO', 'Chaco'),
];
// Newer file without PROVINCIA: 2025-S2, 2026-S1.
const fileB = [
  trip('2025-09', 'CHICONI RICARDO ABEL'),
  trip('2025-09', 'TORRES JUAN CARLOS'),
  trip('2026-01', 'CHICONI RICARDO ABEL'),
  trip('2026-06', 'CHICONI RICARDO ABEL'),
  trip('2026-06', 'TORRES JUAN CARLOS'),
];

test('semesterLabel writes the semester in Spanish', () => {
  assert.equal(semesterLabel('2024-S2'), '2.º semestre 2024');
  assert.equal(semesterLabel('2026-S1'), '1.º semestre 2026');
});

test('buildTravelReport keeps the 4 newest semesters found in the rows', () => {
  const report = buildTravelReport(deputies, [fileB, fileA]);
  assert.deepEqual(report.semesters, ['2024-S2', '2025-S1', '2025-S2', '2026-S1']);
  assert.deepEqual(report.windowMonths, ['2024-08', '2025-02', '2025-09', '2026-01', '2026-06']);
  assert.equal(report.windowLabel, '2.º semestre 2024 – 1.º semestre 2026');
  assert.equal(report.latestLabel, '1.º semestre 2026');
});

test('buildTravelReport builds legs only from matched rows', () => {
  const report = buildTravelReport(deputies, [fileA, fileB]);
  const chiconi = report.analysis.deputies.find(d => d.deputyId === 'dip-chiconi')!;
  assert.equal(chiconi.legs, 5);
  assert.equal(chiconi.months, 5);
  assert.equal(chiconi.legsPerMonth, 1);
  for (const id of ['dip-torres-jujuy', 'dip-torres-salta']) {
    assert.equal(report.analysis.deputies.find(d => d.deputyId === id)!.legs, 0);
  }
  assert.deepEqual(report.quality.legs, { linked: 5, total: 8, percent: 62.5 });
});

test('buildTravelReport counts distinct names matched, doubtful and unmatched', () => {
  const { quality } = buildTravelReport(deputies, [fileA, fileB]);
  assert.deepEqual(quality.overall, { matched: 1, doubtful: 1, unmatched: 1, total: 3, percent: 33.3 });
  assert.deepEqual(quality.latest, { matched: 1, doubtful: 1, unmatched: 0, total: 2, percent: 50 });
  assert.equal(quality.doubtful.length, 1);
  const [doubtful] = quality.doubtful;
  assert.equal(doubtful.nombre, 'TORRES JUAN CARLOS');
  assert.equal(doubtful.provincia, '');
  assert.deepEqual(doubtful.candidates.map(c => `${c.nombre} (${c.lugar})`).sort(), [
    'Torres, Juan (JUJUY)',
    'Torres, Juan (SALTA)',
  ]);
  assert.ok(doubtful.candidates.every(c => c.confidence >= 0.75));
});

test('buildTravelReport keeps one file per semester when a file is republished', () => {
  const republished = fileB.filter(row => row.period === '2026-06');
  const report = buildTravelReport(deputies, [fileA, fileB, republished]);
  assert.equal(report.analysis.deputies.find(d => d.deputyId === 'dip-chiconi')!.legs, 5);
  assert.equal(report.quality.legs.total, 8);
});

test('buildTravelReport fails loudly when no row has a valid period', () => {
  assert.throws(() => buildTravelReport(deputies, [[]]), /Viajes: no trip rows/);
});

test('buildTravelReport estimates homes from the endpoint table it is given', () => {
  const endpoints = {
    'santa rosa': { lat: -36.5883, lon: -64.2757, provincia: 'LA PAMPA', kind: 'airport' as const },
    aeroparque: { lat: -34.5592, lon: -58.4156, provincia: 'CIUDAD DE BUENOS AIRES', kind: 'airport' as const, hub: true },
  };
  const withTable = buildTravelReport(deputies, [fileA, fileB], endpoints).analysis.deputies.find(d => d.deputyId === 'dip-chiconi')!;
  assert.equal(withTable.homeSource, 'ruta');
  // the two Torres (≥ 1200 km, fewer than 5) merge into Chiconi's nearer band
  assert.equal(withTable.band, '≥ 400 km');
  const withoutTable = buildTravelReport(deputies, [fileA, fileB]).analysis.deputies.find(d => d.deputyId === 'dip-chiconi')!;
  assert.equal(withoutTable.homeSource, 'capital');
});
