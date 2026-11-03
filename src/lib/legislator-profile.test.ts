import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeputyProfiles, buildSenatorProfiles, billsProfile } from './legislator-profile.ts';
import type { DeputyCommittee } from './comisiones.ts';
import type { DeputyMissions } from './misiones.ts';
import type { AuthorBills } from './proyectos.ts';
import type { SenatorVotes } from './senado-votos.ts';

const BILLS: AuthorBills = {
  total: 7,
  byTipo: { RESOLUCION: 2, LEY: 4, DECLARACION: 1 },
  stages: { presentado: 4, 'en comisión': 1, 'con dictamen': 0, 'media sanción': 1, sancionado: 1 },
  recent: [
    { titulo: 'Ley de prueba', fecha: '2026-05-02', tipo: 'LEY', expediente: '1234-D-2026', stage: 'presentado' },
  ],
};

const COMMITTEES: DeputyCommittee[] = [
  { comisionId: 'HCDN00045', comision: 'ASUNTOS CONSTITUCIONALES', cargo: 'presidente' },
  { comisionId: 'HCDN00048', comision: 'PRESUPUESTO Y HACIENDA', cargo: 'integrante' },
];

const MISSIONS: DeputyMissions = {
  deputyId: 'dip-a',
  count: 1,
  lugares: ['MADRID, ESPAÑA'],
  instituciones: ['CORTES GENERALES'],
  viaticosOtorgados: { USD: 1062 },
  viaticosConsumidos: {},
  missions: [],
};

test('billsProfile orders types by count and keeps the stage funnel in stage order, with reached counts', () => {
  assert.deepEqual(billsProfile(BILLS), {
    total: 7,
    porTipo: [
      { tipo: 'LEY', count: 4 },
      { tipo: 'RESOLUCION', count: 2 },
      { tipo: 'DECLARACION', count: 1 },
    ],
    funnel: [
      { stage: 'presentado', count: 4, alcanzado: 7 },
      { stage: 'en comisión', count: 1, alcanzado: 3 },
      { stage: 'con dictamen', count: 0, alcanzado: 2 },
      { stage: 'media sanción', count: 1, alcanzado: 2 },
      { stage: 'sancionado', count: 1, alcanzado: 1 },
    ],
    recent: BILLS.recent,
  });
});

test('buildDeputyProfiles assembles every current deputy, empty when a source has nothing for them', () => {
  const profiles = buildDeputyProfiles([{ id: 'dip-a' }, { id: 'dip-b' }], {
    committees: new Map([['dip-a', COMMITTEES]]),
    bills: new Map([['dip-a', BILLS], ['sen-1', BILLS]]),
    missions: [MISSIONS, { ...MISSIONS, deputyId: 'dip-gone' }],
  });
  assert.deepEqual([...profiles.keys()], ['dip-a', 'dip-b']);
  const { deputyId: _id, ...missions } = MISSIONS;
  assert.deepEqual(profiles.get('dip-a'), { id: 'dip-a', committees: COMMITTEES, bills: billsProfile(BILLS), missions });
  assert.deepEqual(profiles.get('dip-b'), { id: 'dip-b', committees: [], bills: null, missions: null });
});

test('buildSenatorProfiles assembles votes and Senate-origin bills per current senator', () => {
  const votes = { id: 'sen-1', nombre: 'ABAD, MAXIMILIANO', actas: 10 } as SenatorVotes;
  const profiles = buildSenatorProfiles([{ id: 'sen-1' }, { id: 'sen-2' }], {
    votes: new Map([['sen-1', votes]]),
    bills: new Map([['sen-1', BILLS]]),
  });
  assert.deepEqual(profiles.get('sen-1'), { id: 'sen-1', votes, bills: billsProfile(BILLS) });
  assert.deepEqual(profiles.get('sen-2'), { id: 'sen-2', votes: null, bills: null });
});
