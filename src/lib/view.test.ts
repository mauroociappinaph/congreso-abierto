import test from 'node:test';
import assert from 'node:assert/strict';
import { toDeputyItem, toSenatorItem } from './view.ts';

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
});

test('toDeputyItem adds the travel comparison to the detail when given', () => {
  const travel = {
    deputyId: 'dip-a', region: 'NOA' as const, legs: 60, months: 24, legsPerMonth: 2.5, regionMedian: 1.2,
    z: 4.12, flagged: true, eligible: true, topRoute: null, bySemester: {},
  };
  const base = toDeputyItem(deputy, pay).detail;
  assert.deepEqual(toDeputyItem(deputy, pay, travel).detail, [
    ...base,
    ['Tramos (últimos 4 semestres)', '60'],
    ['Tramos por mes', '2,5'],
    ['Comparación regional', 'Viaja bastante más que sus pares de NOA (mediana 1,2 por mes)'],
  ]);
  const inLine = { ...travel, z: 0.4, flagged: false };
  assert.equal(toDeputyItem(deputy, pay, inLine).detail.at(-1)![1], 'En línea con su región (NOA)');
  const newcomer = { ...travel, months: 2, eligible: false, z: null, flagged: false };
  assert.equal(toDeputyItem(deputy, pay, newcomer).detail.at(-1)![1], 'No comparado (menos de 3 meses en el cargo)');
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
});
