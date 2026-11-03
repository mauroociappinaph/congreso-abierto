import test from 'node:test';
import assert from 'node:assert/strict';
import { activeDuring, mapCurrentToHistoric, parseRoster } from './roster.ts';

// Trimmed real rows from HCDN CKAN `legisladores`, resource "Diputados" (diputados2.1.csv): one row per
// mandate and bloc span. ACEVEDO joined in 2023 as a replacement (JURAMENTO after INICIO) and left early
// (CESE before FIN); AGUERO has no JURAMENTO; STOLBIZER appears under two IDs.
const ROSTER_CSV = `ID,APELLIDO,NOMBRE,GENERO,DISTRITO,INICIO,FIN,JURAMENTO,CESE,BLOQUE,BLOQUE_INICIO,BLOQUE_FIN
HCDN1136,ABDALA DE MATARAZZO,NORMA AMANDA,F,SANTIAGO DEL ESTERO,2013-12-10T00:00:00,2017-12-09T00:00:00,2013-12-04T00:00:00,2017-12-09T00:00:00,FRENTE CIVICO POR SANTIAGO,2013-12-10T00:00:00,2017-12-09T00:00:00
HCDN1136,ABDALA DE MATARAZZO,NORMA AMANDA,F,SANTIAGO DEL ESTERO,2017-12-10T00:00:00,2021-12-09T00:00:00,2017-12-06T00:00:00,2021-12-09T00:00:00,FRENTE CIVICO POR SANTIAGO,2017-12-10T00:00:00,2019-12-09T00:00:00
HCDN1136,ABDALA DE MATARAZZO,NORMA AMANDA,F,SANTIAGO DEL ESTERO,2017-12-10T00:00:00,2021-12-09T00:00:00,2017-12-06T00:00:00,2021-12-09T00:00:00,FRENTE DE TODOS,2019-12-10T00:00:00,2021-12-09T00:00:00
HCDN0055,ACEVEDO,SERGIO,M,SANTA CRUZ,2021-12-10T00:00:00,2025-12-09T00:00:00,2023-12-07T00:00:00,2025-09-15T00:00:00,SER - SOMOS ENERGIA PARA RENOVAR,2023-12-08T00:00:00,2023-12-12T00:00:00
HCDN0055,ACEVEDO,SERGIO,M,SANTA CRUZ,2021-12-10T00:00:00,2025-12-09T00:00:00,2023-12-07T00:00:00,2025-09-15T00:00:00,POR SANTA CRUZ,2023-12-12T00:00:00,2025-09-15T00:00:00
HCDN3166,AGUERO,GUILLERMO CESAR,M,CHACO,2025-12-10T00:00:00,2029-12-09T00:00:00,,2029-12-09T00:00:00,UCR - UNIÓN CÍVICA RADICAL,2025-12-10T00:00:00,2029-12-09T00:00:00
HCDN2925,STOLBIZER,MARGARITA,F,BUENOS AIRES,2021-12-10T00:00:00,2025-12-09T00:00:00,2021-12-07T00:00:00,2025-12-09T00:00:00,ENCUENTRO FEDERAL,2021-12-10T00:00:00,2023-12-09T00:00:00
HCDN0244,STOLBIZER,MARGARITA ROSA,F,BUENOS AIRES,2009-12-10T00:00:00,2013-12-09T00:00:00,2009-12-03T00:00:00,2013-12-09T00:00:00,GEN,2009-12-10T00:00:00,2013-12-09T00:00:00
HCDN3077,ZULLI,CHRISTIAN ALEJANDRO,M,CORRIENTES,2023-12-10T00:00:00,2027-12-09T00:00:00,2023-12-07T00:00:00,2027-12-09T00:00:00,UNIÓN POR LA PATRIA,2023-12-10T00:00:00,2027-12-09T00:00:00
HCDN9001,PEREZ,JUAN,M,CHACO,2023-12-10T00:00:00,2027-12-09T00:00:00,2023-12-07T00:00:00,2027-12-09T00:00:00,X,2023-12-10T00:00:00,2027-12-09T00:00:00
HCDN9002,PEREZ,JUAN,M,CHACO,2023-12-10T00:00:00,2027-12-09T00:00:00,2023-12-07T00:00:00,2027-12-09T00:00:00,Y,2023-12-10T00:00:00,2027-12-09T00:00:00
`;

test('parseRoster groups mandate and bloc rows by ID, with effective start and end dates', () => {
  const people = parseRoster(ROSTER_CSV);
  assert.equal(people.length, 8);
  const abdala = people.find(p => p.hcdnId === 'HCDN1136')!;
  assert.deepEqual(abdala, {
    hcdnId: 'HCDN1136',
    nombre: 'ABDALA DE MATARAZZO, NORMA AMANDA',
    distrito: 'SANTIAGO DEL ESTERO',
    mandates: [
      { inicio: '2013-12-10', fin: '2017-12-09', distrito: 'SANTIAGO DEL ESTERO' },
      { inicio: '2017-12-10', fin: '2021-12-09', distrito: 'SANTIAGO DEL ESTERO' },
    ],
  });
  assert.deepEqual(people.find(p => p.hcdnId === 'HCDN0055')!.mandates, [
    { inicio: '2023-12-07', fin: '2025-09-15', distrito: 'SANTA CRUZ' },
  ]);
  assert.deepEqual(people.find(p => p.hcdnId === 'HCDN3166')!.mandates, [
    { inicio: '2025-12-10', fin: '2029-12-09', distrito: 'CHACO' },
  ]);
});

test('parseRoster skips rows without ID or dates', () => {
  const csv = 'ID,APELLIDO,NOMBRE,DISTRITO,INICIO,FIN,JURAMENTO,CESE\n,X,Y,CHACO,2023-12-10,2027-12-09,,\nHCDN1,A,B,CHACO,,,,\n';
  assert.deepEqual(parseRoster(csv), []);
});

test('activeDuring keeps people with a mandate overlapping the period, bounds included', () => {
  const people = parseRoster(ROSTER_CSV);
  const ids = (from: string, to: string) => activeDuring(people, from, to).map(p => p.hcdnId).sort();
  assert.deepEqual(ids('2025-09-16', '2025-12-09'), ['HCDN2925', 'HCDN3077', 'HCDN9001', 'HCDN9002']);
  assert.deepEqual(ids('2025-09-15', '2025-09-15'), ['HCDN0055', 'HCDN2925', 'HCDN3077', 'HCDN9001', 'HCDN9002']);
  assert.deepEqual(ids('2029-12-09', '2030-01-01'), ['HCDN3166']);
  assert.deepEqual(ids('2000-01-01', '2001-01-01'), []);
});

test('mapCurrentToHistoric links composition ids by exact name and district, then by the linker', () => {
  const people = parseRoster(ROSTER_CSV);
  const current = [
    // exact after accents and case are normalized
    { id: 'dip-aguero', nombre: 'Agüero, Guillermo César', lugar: 'CHACO' },
    // given-name subset: only the linker finds it
    { id: 'dip-zulli', nombre: 'Zulli, Christian', lugar: 'CORRIENTES' },
    // two roster people with the same exact name and district: never guessed
    { id: 'dip-perez', nombre: 'Pérez, Juan', lugar: 'CHACO' },
    // not active on the date
    { id: 'dip-abdala', nombre: 'Abdala de Matarazzo, Norma Amanda', lugar: 'SANTIAGO DEL ESTERO' },
  ];
  const { byDeputyId, unmapped } = mapCurrentToHistoric(current, people, '2026-11-03');
  assert.deepEqual([...byDeputyId], [
    ['dip-aguero', 'HCDN3166'],
    ['dip-zulli', 'HCDN3077'],
  ]);
  assert.deepEqual(unmapped, [current[2], current[3]]);
});

test('mapCurrentToHistoric does not give one roster person to two deputies', () => {
  const people = parseRoster(ROSTER_CSV);
  const current = [
    { id: 'dip-zulli-a', nombre: 'Zulli, Christian Alejandro', lugar: 'CORRIENTES' },
    { id: 'dip-zulli-b', nombre: 'Zulli, Christian', lugar: 'CORRIENTES' },
  ];
  const { byDeputyId, unmapped } = mapCurrentToHistoric(current, people, '2026-11-03');
  assert.deepEqual([...byDeputyId], [['dip-zulli-a', 'HCDN3077']]);
  assert.deepEqual(unmapped, [current[1]]);
});
