import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bloqueColor,
  countByBloque,
  filterLegislators,
  formatArs,
  normalizeDeputy,
  normalizeSenator,
  parseArsAmount,
  parseConcepts,
  parseCsv,
  summarizePay,
} from './legislators.ts';

test('parseCsv handles quoted fields with commas, escaped quotes and CRLF', () => {
  const csv = 'a,b,c\r\n1,"x, y","say ""hi"""\r\n2,,z\r\n';
  assert.deepEqual(parseCsv(csv), [
    { a: '1', b: 'x, y', c: 'say "hi"' },
    { a: '2', b: '', c: 'z' },
  ]);
});

test('parseCsv strips a UTF-8 BOM and skips blank lines', () => {
  assert.deepEqual(parseCsv('\uFEFFk,v\n\n1,2\n'), [{ k: '1', v: '2' }]);
});

test('parseArsAmount reads Argentine number formats', () => {
  assert.equal(parseArsAmount('6.125.805,18'), 6125805.18);
  assert.equal(parseArsAmount('328751,12'), 328751.12);
  assert.equal(parseArsAmount('-121.367,71'), -121367.71);
  assert.equal(parseArsAmount(''), null);
  assert.equal(parseArsAmount('n/a'), null);
});

test('parseConcepts reads concept CSVs whatever the header casing and drops duplicates', () => {
  const remuneraciones = 'Concepto_descripción,importe\nDieta,"6.125.805,18"\nGastos de Representación,"464.489,12"\n';
  assert.deepEqual(parseConcepts(remuneraciones), [
    { concepto: 'Dieta', importe: 6125805.18 },
    { concepto: 'Gastos de Representación', importe: 464489.12 },
  ]);
  const movilidad = '"id","concepto_descripción","importe"\n3,"Movilidad opción 4","350.000,00"\n3,"Movilidad opción 4","350.000,00"\n';
  assert.deepEqual(parseConcepts(movilidad), [{ concepto: 'Movilidad opción 4', importe: 350000 }]);
});

test('summarizePay computes gross, discounts and net', () => {
  const summary = summarizePay(
    [{ concepto: 'Dieta', importe: 1000 }, { concepto: 'Gastos de Representación', importe: 200 }],
    [{ concepto: 'Ganancias', importe: -300 }],
  );
  assert.deepEqual(summary, { dieta: 1000, gastosRepresentacion: 200, bruto: 1200, descuentos: -300, neto: 900 });
});

test('normalizeDeputy maps the HCDN row', () => {
  const deputy = normalizeDeputy({
    APELLIDO: 'Aguirre', NOMBRE: 'Hilda', SEXO: 'F', DISTRITO: 'LA RIOJA', MANDATO: '2023-2027',
    FECHA_DE_JURA: '07/12/2023', FECHA_DE_INICIO: '10/12/2023', BLOQUE: 'UNIÓN POR LA PATRIA',
  });
  assert.deepEqual(deputy, {
    id: 'dip-aguirre-hilda-la-rioja', nombre: 'Aguirre, Hilda', lugar: 'LA RIOJA', bloque: 'UNIÓN POR LA PATRIA',
    mandato: '2023-2027', fechaJura: '07/12/2023', fechaInicio: '10/12/2023',
  });
  assert.equal(normalizeDeputy({ APELLIDO: 'X', NOMBRE: 'Y', BLOQUE: '' }).bloque, 'SIN BLOQUE');
});

test('normalizeSenator maps the Senate row', () => {
  const senator = normalizeSenator({
    ID: '546', BLOQUE: 'UCR', APELLIDO: 'ABAD', NOMBRE: 'MAXIMILIANO', PROVINCIA: 'BUENOS AIRES',
    'PARTIDO O ALIANZA': 'JUNTOS POR EL CAMBIO', D_LEGAL: '2023-12-10', C_LEGAL: '2029-12-09',
    EMAIL: 'a@senado.gob.ar', TELEFONO: '1045', FOTO: 'https://x/546.gif',
  });
  assert.deepEqual(senator, {
    id: 'sen-546', nombre: 'ABAD, MAXIMILIANO', lugar: 'BUENOS AIRES', bloque: 'UCR',
    partido: 'JUNTOS POR EL CAMBIO', mandato: '2023-12-10 a 2029-12-09', email: 'a@senado.gob.ar',
    telefono: '1045', foto: 'https://x/546.gif',
  });
});

test('filterLegislators matches name and place ignoring accents and case, and filters by bloque', () => {
  const list = [
    { nombre: 'Agüero, Guillermo', lugar: 'CHACO', bloque: 'UCR' },
    { nombre: 'Zulli, Christian', lugar: 'CORRIENTES', bloque: 'UXP' },
  ];
  assert.deepEqual(filterLegislators(list, { query: 'aguero' }).map(l => l.lugar), ['CHACO']);
  assert.deepEqual(filterLegislators(list, { query: 'corrientes' }).map(l => l.lugar), ['CORRIENTES']);
  assert.deepEqual(filterLegislators(list, { bloque: 'UXP' }).map(l => l.lugar), ['CORRIENTES']);
  assert.equal(filterLegislators(list, { query: '', bloque: 'all' }).length, 2);
});

test('countByBloque sorts bloques by size then name', () => {
  assert.deepEqual(countByBloque([{ bloque: 'B' }, { bloque: 'A' }, { bloque: 'B' }, { bloque: 'C' }]), [
    { bloque: 'B', count: 2 }, { bloque: 'A', count: 1 }, { bloque: 'C', count: 1 },
  ]);
});

test('formatArs formats pesos', () => {
  assert.equal(formatArs(6125805.18), '$ 6.125.805,18');
  assert.equal(formatArs(-1402882.42), '-$ 1.402.882,42');
  assert.equal(formatArs(null), 'Sin datos');
});

test('bloqueColor is stable per bloque', () => {
  assert.equal(bloqueColor('PRO'), bloqueColor('PRO'));
  assert.match(bloqueColor('PRO'), /^hsl\(\d+, 55%, 42%\)$/);
});
