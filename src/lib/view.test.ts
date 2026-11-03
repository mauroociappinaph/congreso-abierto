import test from 'node:test';
import assert from 'node:assert/strict';
import { cargoLabel, formatDate, formatMoney, formatShare, mergeBills, toDeputyItem, toSenatorItem, travelComparison, travelStatus } from './view.ts';

const deputy = {
  id: 'dip-a', nombre: 'Aguirre, Hilda', lugar: 'LA RIOJA', bloque: 'UXP',
  mandato: '2023-2027', fechaJura: '07/12/2023', fechaInicio: '10/12/2023',
};
const pay = { dieta: 1000, gastosRepresentacion: 200, bruto: 1200, descuentos: -300, neto: 900 };

test('toDeputyItem shows the chamber-wide pay on the card and in the detail', () => {
  const item = toDeputyItem(deputy, pay);
  assert.deepEqual(item.card, [
    ['Distrito', 'LA RIOJA'],
    ['Dieta', '$ 1.000,00'],
    ['Gastos de representación', '$ 200,00'],
  ]);
  assert.deepEqual(item.detail, [
    ['Nombre', 'Aguirre, Hilda'], ['Distrito', 'LA RIOJA'], ['Bloque', 'UXP'], ['Mandato', '2023-2027'],
    ['Fecha de jura', '07/12/2023'], ['Fecha de inicio', '10/12/2023'],
    ['Dieta', '$ 1.000,00'], ['Gastos de representación', '$ 200,00'],
    ['Total bruto', '$ 1.200,00'], ['Neto estimado', '$ 900,00'],
  ]);
  assert.equal(item.detailNote, 'Montos generales publicados por la Cámara; no son gastos individuales.');
  assert.equal(item.foto, '');
  assert.equal(item.url, '/diputados/dip-a/');
});

test('toDeputyItem adds the travel comparison to the detail when given', () => {
  const travel = {
    deputyId: 'dip-a', region: 'NOA' as const, band: '800–1200 km', homeKm: 1050, homeSource: 'ruta' as const,
    legs: 60, months: 24, legsPerMonth: 2.5, bandMedian: 1.2, z: 4.12, flagged: true, eligible: true, topRoute: null, bySemester: {},
  };
  const base = toDeputyItem(deputy, pay).detail;
  assert.deepEqual(toDeputyItem(deputy, pay, travel).detail, [
    ...base,
    ['Tramos (últimos 4 semestres)', '60'],
    ['Tramos por mes', '2,5'],
    ['Distancia estimada', '1.050 km (ruta más frecuente)'],
    ['Comparación con sus pares', 'Viaja bastante más que sus pares a distancia similar (mediana 1,2 por mes)'],
  ]);
  const inLine = { ...travel, z: 0.4, flagged: false };
  assert.equal(toDeputyItem(deputy, pay, inLine).detail.at(-1)![1], 'En línea con sus pares a distancia similar');
  const capital = { ...inLine, homeKm: 1150, homeSource: 'capital' as const };
  assert.deepEqual(toDeputyItem(deputy, pay, capital).detail.at(-2), ['Distancia estimada', '1.150 km (capital de la provincia)']);
  const noHome = { ...inLine, band: null, homeKm: null, homeSource: null, bandMedian: null, z: null };
  assert.deepEqual(toDeputyItem(deputy, pay, noHome).detail.slice(-2), [
    ['Distancia estimada', 'N/A'],
    ['Comparación con sus pares', 'No comparado (sin distancia estimada)'],
  ]);
  const newcomer = { ...travel, months: 2, eligible: false, z: null, flagged: false };
  assert.equal(toDeputyItem(deputy, pay, newcomer).detail.at(-1)![1], 'No comparado (menos de 3 meses en el cargo)');
});

test('travelComparison says a deputy with no legs in the window has none, never that they are in line', () => {
  const travel = {
    deputyId: 'dip-c', region: 'NOA' as const, band: '800–1200 km', homeKm: 1085, homeSource: 'capital' as const,
    legs: 0, months: 24, legsPerMonth: 0, bandMedian: 5.93, z: -4.13, flagged: false, eligible: true, topRoute: null, bySemester: {},
  };
  assert.equal(travelComparison(travel), 'Sin tramos registrados en el período');
  assert.equal(travelStatus(travel), 'sin-tramos');
  assert.equal(toDeputyItem(deputy, pay, travel).detail.at(-1)![1], 'Sin tramos registrados en el período');
  // without an estimated home the zero still reads as no legs
  assert.equal(travelComparison({ ...travel, band: null, homeKm: null, homeSource: null, bandMedian: null, z: null }), 'Sin tramos registrados en el período');
  // a newcomer is still "not compared" first
  assert.equal(travelComparison({ ...travel, months: 2, eligible: false }), 'No comparado (menos de 3 meses en el cargo)');
  assert.equal(travelStatus({ ...travel, months: 2, eligible: false }), 'no-comparado');
  assert.equal(travelStatus({ ...travel, legs: 40, legsPerMonth: 1.67, z: -2 }), 'en-linea');
  assert.equal(travelStatus({ ...travel, legs: 300, legsPerMonth: 12.5, z: 5, flagged: true }), 'viaja-mas');
  assert.equal(travelStatus({ ...travel, legs: 3, band: null, bandMedian: null, z: null }), 'sin-distancia');
});

test('toSenatorItem shows no pay and fills empty fields with N/A', () => {
  const item = toSenatorItem({
    id: 'sen-1', nombre: 'ABAD, MAXIMILIANO', lugar: 'BUENOS AIRES', bloque: 'UCR', partido: '',
    mandato: '2023-12-10 a 2029-12-09', email: 'a@senado.gob.ar', telefono: '', foto: 'https://x/1.gif',
  });
  assert.deepEqual(item.card, [['Provincia', 'BUENOS AIRES'], ['Mandato', '2023-12-10 a 2029-12-09']]);
  assert.deepEqual(item.detail, [
    ['Nombre', 'ABAD, MAXIMILIANO'], ['Provincia', 'BUENOS AIRES'], ['Bloque', 'UCR'], ['Partido o alianza', 'N/A'],
    ['Mandato', '2023-12-10 a 2029-12-09'], ['Email', 'a@senado.gob.ar'], ['Teléfono', 'N/A'],
  ]);
  assert.equal(item.detailNote, 'El Senado no publica dietas ni gastos en sus datos abiertos.');
  assert.equal(item.foto, 'https://x/1.gif');
  assert.equal(item.url, '/senadores/sen-1/');
});

test('formatDate shows ISO days as dd/mm/aaaa and N/A when missing', () => {
  assert.equal(formatDate('2024-02-23'), '23/02/2024');
  assert.equal(formatDate(null), 'N/A');
  assert.equal(formatDate(''), 'N/A');
});

test('formatShare shows a 0-1 share as a percent with one decimal', () => {
  assert.equal(formatShare(0.9356), '93,6 %');
  assert.equal(formatShare(1), '100 %');
  assert.equal(formatShare(null), 'N/A');
});

test('formatMoney lists each currency with its total, by currency code', () => {
  assert.equal(formatMoney({ USD: 1200.5, ARS: 50000 }), 'ARS 50.000; USD 1.200,5');
  assert.equal(formatMoney({}), 'Sin datos');
});

test('cargoLabel capitalizes the committee role', () => {
  assert.equal(cargoLabel('vicepresidente 1'), 'Vicepresidente 1');
  assert.equal(cargoLabel('integrante'), 'Integrante');
});

test('mergeBills adds totals, types and stages of several authors', () => {
  const stages = (p: number, s: number) => ({ presentado: p, 'en comisión': 0, 'con dictamen': 0, 'media sanción': 0, sancionado: s });
  const merged = mergeBills([
    { total: 3, byTipo: { PROYECTO: 2, RESOLUCION: 1 }, stages: stages(2, 1), recent: [] },
    { total: 2, byTipo: { PROYECTO: 1, DECLARACION: 1 }, stages: stages(1, 1), recent: [] },
  ]);
  assert.deepEqual(merged, {
    total: 5,
    byTipo: { PROYECTO: 3, RESOLUCION: 1, DECLARACION: 1 },
    stages: stages(3, 2),
    recent: [],
  });
});
