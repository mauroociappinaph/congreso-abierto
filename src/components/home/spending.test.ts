import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAG_NOTE,
  missionSpending,
  moneyLabel,
  NO_AMOUNT,
  personRefs,
  travelRanking,
  type PersonRef,
} from './spending.ts';
import type { DeputyMissions, Mission, Money } from '../../lib/misiones.ts';
import type { DeputyTravel } from '../../lib/viajes.ts';

const usd = (amount: number): Money => ({ amount, currency: 'USD' });

const mission = (fechaInicio: string | null, otorgado: Money | null, consumido: Money | null = otorgado, extra: Partial<Mission> = {}): Mission => ({
  fechaInicio,
  fechaFin: fechaInicio,
  motivo: `Motivo ${fechaInicio}`,
  institucion: `Institución ${fechaInicio}`,
  lugar: `Lugar ${fechaInicio}`,
  participante: 'X',
  bloque: 'B',
  viaticosDias: otorgado ? 3 : null,
  viaticosOtorgados: otorgado,
  viaticosConsumidos: consumido,
  ...extra,
});

const own = (deputyId: string, missions: Mission[]): DeputyMissions => ({
  deputyId,
  count: missions.length,
  lugares: [],
  instituciones: [],
  viaticosOtorgados: {},
  viaticosConsumidos: {},
  missions,
});

const person = (id: string, nombre: string): PersonRef => ({
  id,
  nombre,
  url: `/diputados/${id}/`,
  bloque: { titulo: `Bloque ${id}`, url: `/bloques/diputados/${id}/` },
  provincia: { nombre: `Provincia ${id}`, url: `/provincias/${id}/` },
});

const people = new Map([
  ['a', person('a', 'Alfa, Ana')],
  ['b', person('b', 'Beta, Bruno')],
  ['c', person('c', 'Gama, Carla')],
  ['d', person('d', 'Delta, Dora')],
]);

test('moneyLabel never shows a missing amount as zero', () => {
  assert.equal(moneyLabel(null), NO_AMOUNT);
  assert.equal(NO_AMOUNT, 'sin monto publicado');
  assert.equal(moneyLabel(usd(1434.5)), 'USD 1.434,5');
  assert.equal(moneyLabel(usd(0)), 'USD 0');
});

test('missionSpending ranks current deputies by USD granted, ties by name, and drops former deputies', () => {
  const result = missionSpending(
    [
      own('b', [mission('2025-01-10', usd(500))]),
      own('a', [mission('2025-02-10', usd(500))]),
      own('c', [mission('2025-03-10', usd(900), usd(800))]),
      own('former', [mission('2025-04-10', usd(9999))]),
      own('d', []),
    ],
    people,
  );
  assert.deepEqual(result.ranked.map(r => [r.id, r.usdOtorgado, r.usdConsumido]), [
    ['c', 900, 800],
    ['a', 500, 500],
    ['b', 500, 500],
  ]);
  assert.equal(result.ranked[0].nombre, 'Gama, Carla');
  assert.equal(result.ranked[0].url, '/diputados/c/');
  assert.deepEqual(result.ranked[0].bloque, { titulo: 'Bloque c', url: '/bloques/diputados/c/' });
});

test('missionSpending counts missions without a published amount but never adds them to the sum', () => {
  const result = missionSpending(
    [own('a', [mission('2025-01-10', null, null), mission('2025-02-10', usd(300), null)]), own('b', [mission('2025-03-10', null, null)])],
    people,
  );
  const [a, b] = result.ranked;
  assert.deepEqual([a.id, a.missions, a.usdOtorgado, a.usdConsumido, a.sinMonto], ['a', 2, 300, 0, 1]);
  assert.deepEqual([b.id, b.missions, b.usdOtorgado, b.sinMonto], ['b', 1, 0, 1]);
  assert.deepEqual(result.totals, { deputies: 2, missions: 3, usdOtorgado: 300, usdConsumido: 0, sinMonto: 2 });
  // the breakdown shows the missing amount as text, not as 0
  assert.deepEqual(a.rows.map(r => [r.otorgado, r.consumido]), [
    ['USD 300', NO_AMOUNT],
    [NO_AMOUNT, NO_AMOUNT],
  ]);
});

test('missionSpending breakdown rows are newest first, undated last, with every published field', () => {
  const result = missionSpending(
    [own('a', [mission(null, usd(10)), mission('2024-05-01', usd(20)), mission('2026-01-02', usd(30), usd(25), { fechaFin: '2026-01-05', viaticosDias: 4 })])],
    people,
  );
  const rows = result.ranked[0].rows;
  assert.deepEqual(rows.map(r => r.desde), ['02/01/2026', '01/05/2024', 'N/A']);
  assert.deepEqual(rows[0], {
    desde: '02/01/2026',
    hasta: '05/01/2026',
    lugar: 'Lugar 2026-01-02',
    motivo: 'Motivo 2026-01-02',
    institucion: 'Institución 2026-01-02',
    dias: '4',
    otorgado: 'USD 30',
    consumido: 'USD 25',
  });
  assert.equal(rows[2].dias, '3');
  const noDays = missionSpending([own('a', [mission('2025-01-01', null, null)])], people).ranked[0].rows[0];
  assert.equal(noDays.dias, '—');
});

test('missionSpending keeps other currencies separate and never converts them', () => {
  const eur: Money = { amount: 700, currency: 'EUR' };
  const result = missionSpending([own('a', [mission('2025-01-01', eur, eur), mission('2025-02-01', usd(100))]), own('b', [mission('2025-03-01', eur, null)])], people);
  assert.deepEqual(result.ranked.map(r => [r.id, r.usdOtorgado]), [['a', 100], ['b', 0]]);
  assert.deepEqual(result.ranked[0].otorgado, { EUR: 700, USD: 100 });
  assert.equal(result.totals.usdOtorgado, 100);
  assert.deepEqual(result.otherCurrencies, [
    { id: 'a', nombre: 'Alfa, Ana', url: '/diputados/a/', currency: 'EUR', otorgado: 700, consumido: 700 },
    { id: 'b', nombre: 'Beta, Bruno', url: '/diputados/b/', currency: 'EUR', otorgado: 700, consumido: 0 },
  ]);
  assert.equal(result.ranked[0].rows[1].otorgado, 'EUR 700');
});

test('missionSpending top keeps the first 10', () => {
  const many = new Map(Array.from({ length: 12 }, (_, i) => [`p${i}`, person(`p${i}`, `Persona ${String(i).padStart(2, '0')}`)]));
  const result = missionSpending(
    [...many.keys()].map((id, i) => own(id, [mission('2025-01-01', usd(100 + i))])),
    many,
  );
  assert.equal(result.ranked.length, 12);
  assert.equal(result.top.length, 10);
  assert.equal(result.top[0].id, 'p11');
  assert.equal(result.top.at(-1)!.id, 'p2');
});

const trip = (deputyId: string, legs: number, legsPerMonth: number, extra: Partial<DeputyTravel> = {}): DeputyTravel => ({
  deputyId,
  region: null,
  band: '800–1200 km',
  homeKm: 1000,
  homeSource: null,
  legs,
  months: 24,
  legsPerMonth,
  bandMedian: 2,
  z: 0,
  flagged: false,
  eligible: true,
  topRoute: { origen: 'AEP', destino: 'TUC', count: legs },
  bySemester: {},
  ...extra,
});

test('travelRanking ranks current deputies by legs, then legs per month, then name, top 10', () => {
  const rows = travelRanking(
    [trip('a', 40, 2), trip('b', 40, 3), trip('c', 50, 1, { flagged: true }), trip('d', 0, 0), trip('former', 99, 9)],
    people,
  );
  assert.deepEqual(rows.map(r => [r.id, r.legs]), [['c', 50], ['b', 40], ['a', 40]]);
  assert.deepEqual(rows[0], {
    id: 'c',
    nombre: 'Gama, Carla',
    url: '/diputados/c/',
    bloque: { titulo: 'Bloque c', url: '/bloques/diputados/c/' },
    provincia: { nombre: 'Provincia c', url: '/provincias/c/' },
    legs: 50,
    legsPerMonth: 1,
    months: 24,
    band: '800–1200 km',
    route: 'AEP ↔ TUC (50)',
    flag: FLAG_NOTE,
  });
  assert.equal(FLAG_NOTE, 'viaja bastante más que sus pares a distancia similar');
  assert.equal(rows[1].flag, null);
  const many = new Map(Array.from({ length: 12 }, (_, i) => [`p${i}`, person(`p${i}`, `P${i}`)]));
  assert.equal(travelRanking([...many.keys()].map((id, i) => trip(id, i + 1, 1)), many).length, 10);
  assert.equal(travelRanking([trip('a', 3, 1, { band: null, topRoute: null })], people)[0].route, '—');
});

test('personRefs falls back to the published bloc and district without relations', () => {
  const refs = personRefs(
    [
      { id: 'a', nombre: 'Alfa, Ana', lugar: 'TUCUMAN', bloque: 'BLOQUE X', mandato: '', fechaJura: '', fechaInicio: '' },
      { id: 'b', nombre: 'Beta, Bruno', lugar: 'SALTA', bloque: 'BLOQUE Y', mandato: '', fechaJura: '', fechaInicio: '' },
    ],
    new Map([['a', { url: '/diputados/a/', bloc: { slug: 'x', titulo: 'Bloque X', url: '/bloques/diputados/x/' }, province: { nombre: 'Tucumán', url: '/provincias/tucuman/' } }]]),
  );
  assert.deepEqual(refs.get('a'), { id: 'a', nombre: 'Alfa, Ana', url: '/diputados/a/', bloque: { titulo: 'Bloque X', url: '/bloques/diputados/x/' }, provincia: { nombre: 'Tucumán', url: '/provincias/tucuman/' } });
  assert.deepEqual(refs.get('b'), { id: 'b', nombre: 'Beta, Bruno', url: '/diputados/b/', bloque: { titulo: 'BLOQUE Y', url: null }, provincia: { nombre: 'SALTA', url: null } });
});
