import test from 'node:test';
import assert from 'node:assert/strict';
import type { CommitteeSummary, DeputyCommittee } from './comisiones.ts';
import {
  buildEntities,
  PROVINCES,
  provinceOf,
  searchIndexBytes,
  slugify,
  titleCase,
  uniqueSlugs,
  type EntitySources,
} from './entities.ts';
import type { Deputy, Senator } from './legislators.ts';
import type { DeputyMissions } from './misiones.ts';
import type { AuthorBills } from './proyectos.ts';
import type { SenatorVotes } from './senado-votos.ts';
import type { DeputyTravel } from './viajes.ts';

const deputy = (id: string, nombre: string, lugar: string, bloque: string): Deputy => ({
  id, nombre, lugar, bloque, mandato: '2023-2027', fechaJura: '', fechaInicio: '10/12/2023',
});
const senator = (id: string, nombre: string, lugar: string, bloque: string): Senator => ({
  id, nombre, lugar, bloque, partido: '', mandato: '', email: '', telefono: '', foto: '',
});
const UXP = 'UNIÓN POR LA PATRIA';
const LLA = 'LA LIBERTAD AVANZA';
const deputies = [
  deputy('d-aguirre', 'Aguirre, Hilda', 'LA RIOJA', UXP),
  deputy('d-cisneros', 'Cisneros, Carlos', 'TUCUMAN', UXP),
  deputy('d-yedlin', 'Yedlin, Pablo Raúl', 'TUCUMAN', UXP),
  deputy('d-monzon', 'Monzón, Roxana', 'BUENOS AIRES', UXP),
  deputy('d-campero', 'Campero, Mariano', 'TUCUMAN', LLA),
  deputy('d-leone', 'Leone, Andrés', 'CIUDAD DE BUENOS AIRES', 'PRO'),
  deputy('d-uno', 'Uno, Ana', 'BUENOS AIRES', 'UCR'),
  deputy('d-dos', 'Dos, Bea', 'CORDOBA', 'U.C.R.'),
];
const senators = [
  senator('s-manzur', 'MANZUR, JUAN LUIS', 'TUCUMÁN', 'JUSTICIALISTA'),
  senator('s-avila', 'AVILA, BEATRIZ', 'TUCUMÁN', 'INDEPENDENCIA'),
  senator('s-mayans', 'MAYANS, JOSÉ', 'FORMOSA', 'JUSTICIALISTA'),
  senator('s-lousteau', 'LOUSTEAU, MARTÍN', 'CIUDAD AUTÓNOMA DE BUENOS AIRES', 'UCR - UNIÓN CÍVICA RADICAL'),
  senator('s-bullrich', 'BULLRICH, PATRICIA', 'CIUDAD AUTÓNOMA DE BUENOS AIRES', LLA),
];

const FAR = '800–1200 km';
const NEAR = '< 100 km';
const trip = (deputyId: string, band: string | null, legs: number, legsPerMonth: number, extra: Partial<DeputyTravel> = {}): DeputyTravel => ({
  deputyId, region: null, band, homeKm: band ? 1000 : null, homeSource: band ? 'ruta' : null, legs, months: 24, legsPerMonth,
  bandMedian: band === FAR ? 5.93 : band === NEAR ? 0.33 : null, z: 0, flagged: false, eligible: true, topRoute: null, bySemester: {},
  ...extra,
});
const travel = {
  windowLabel: '2.º semestre 2024 – 1.º semestre 2026',
  analysis: {
    bands: [
      { band: NEAR, deputies: 86, medianLegsPerMonth: 0.33, medianKm: 53 },
      { band: FAR, deputies: 62, medianLegsPerMonth: 5.93, medianKm: 982 },
    ],
    deputies: [
      trip('d-aguirre', FAR, 96, 4),
      trip('d-cisneros', FAR, 0, 0, { z: -4.13 }),
      trip('d-yedlin', FAR, 185, 7.71),
      trip('d-monzon', NEAR, 64, 2.67, { z: 9.1, flagged: true }),
      trip('d-campero', FAR, 188, 7.83),
      trip('d-leone', NEAR, 2, 1, { months: 2, eligible: false, z: null }),
      trip('d-uno', NEAR, 12, 0.5),
      trip('d-dos', null, 5, 0.21, { z: null }),
    ],
  },
};

const C1 = 'HCDN001';
const C2 = 'HCDN002';
const C3 = 'HCDN003';
const committee = (id: string, nombre: string, miembros: number, autoridades: CommitteeSummary['autoridades'] = [], tipo: CommitteeSummary['tipo'] = 'permanente'): CommitteeSummary =>
  ({ id, nombre, tipo, miembros, autoridades });
const seat = (comisionId: string, comision: string, cargo: string): DeputyCommittee => ({ comisionId, comision, cargo });
const SALUD = 'ACCION SOCIAL Y SALUD PUBLICA';
const PRESUPUESTO = 'PRESUPUESTO Y HACIENDA';
const committees = {
  period: { desde: '2025-12-10', hasta: '2026-11-03' },
  committees: new Map([
    [C1, committee(C1, SALUD, 5, [
      { cargo: 'presidente', nombre: 'YEDLIN Pablo', distrito: 'TUCUMAN', deputyId: 'd-yedlin' },
      { cargo: 'vicepresidente 1', nombre: 'CAMPERO Mariano', distrito: 'TUCUMAN', deputyId: 'd-campero' },
      { cargo: 'secretario', nombre: 'PEREZ Juan', distrito: 'CABA', deputyId: null },
    ])],
    [C2, committee(C2, PRESUPUESTO, 3, [{ cargo: 'presidente', nombre: 'CAMPERO Mariano', distrito: 'TUCUMAN', deputyId: 'd-campero' }])],
    [C3, committee(C3, 'ACCIÓN SOCIAL Y SALUD PÚBLICA', 1, [], 'especial')],
  ]),
  byDeputy: new Map([
    ['d-yedlin', [seat(C1, SALUD, 'presidente')]],
    ['d-campero', [seat(C2, PRESUPUESTO, 'presidente'), seat(C1, SALUD, 'vicepresidente 1')]],
    ['d-cisneros', [seat(C1, SALUD, 'integrante'), seat(C2, PRESUPUESTO, 'integrante')]],
    ['d-aguirre', [seat(C1, SALUD, 'integrante')]],
    ['d-monzon', [seat(C3, 'ACCIÓN SOCIAL Y SALUD PÚBLICA', 'integrante')]],
    ['d-leone', [seat(C2, PRESUPUESTO, 'integrante')]],
  ]),
};

const authored = (total: number, [p, c, d, m, s]: number[], byTipo: Record<string, number>): AuthorBills => ({
  total, byTipo, recent: [],
  stages: { presentado: p, 'en comisión': c, 'con dictamen': d, 'media sanción': m, sancionado: s },
});
const bills = {
  period: { desde: '2024-01-03', hasta: '2026-10-06' },
  byLegislator: new Map([
    ['d-yedlin', authored(69, [62, 1, 0, 0, 6], { RESOLUCION: 37, LEY: 16, DECLARACION: 16 })],
    ['d-aguirre', authored(10, [9, 0, 0, 0, 1], { RESOLUCION: 10 })],
    ['d-campero', authored(5, [5, 0, 0, 0, 0], { LEY: 5 })],
    ['s-manzur', authored(7, [6, 0, 0, 1, 0], { LEY: 7 })],
    // a former deputy: ignored
    ['r-former', authored(100, [100, 0, 0, 0, 0], { LEY: 100 })],
  ]),
};

const missionsOf = (deputyId: string, count: number): DeputyMissions => ({
  deputyId, count, lugares: [], instituciones: [], viaticosOtorgados: {}, viaticosConsumidos: {}, missions: [],
});
const missions = {
  period: { desde: '2024-03-11', hasta: '2026-05-09' },
  deputies: [missionsOf('d-yedlin', 4), missionsOf('d-monzon', 2), missionsOf('r-former', 9)],
};

const votesOf = (id: string, nombre: string, actas: number, asistencia: number, lealtadBloque: number | null): SenatorVotes => ({
  id, nombre, provincia: '', bloques: [], actas, afirmativo: 0, negativo: 0, abstencion: 0, ausente: 0, otros: 0,
  asistencia, lealtadBloque, lealtadActas: actas,
});
const senateVotes = {
  actas: 345,
  period: { desde: '2024-02-23', hasta: '2026-10-29' },
  summary: {
    senators: new Map([
      ['s-manzur', votesOf('s-manzur', 'MANZUR, JUAN LUIS', 340, 0.95, 0.98)],
      ['s-mayans', votesOf('s-mayans', 'MAYANS, JOSÉ', 330, 0.9, 0.99)],
      ['s-avila', votesOf('s-avila', 'AVILA, BEATRIZ', 300, 0.722, 1)],
    ]),
    blocs: [
      { bloque: 'INDEPENDENCIA', senators: 1, actas: 340, riceMedio: 1 },
      { bloque: 'JUSTICIALISTA', senators: 22, actas: 343, riceMedio: 0.97 },
      { bloque: 'LA LIBERTAD AVANZA', senators: 22, actas: 340, riceMedio: 0.96 },
      { bloque: 'UCR - UNIÓN CÍVICA RADICAL', senators: 14, actas: 345, riceMedio: 0.93 },
      { bloque: 'UNIDAD CIUDADANA', senators: 8, actas: 120, riceMedio: 1 },
    ],
  },
};

const pay = { dieta: 6125805.18, gastosRepresentacion: 464489.12, bruto: 6590294.3, descuentos: -1402882.42, neto: 5187411.88 };

const sources: EntitySources = { asOf: '2026-11-03', deputies, senators, pay, travel, committees, bills, missions, senateVotes };
const entities = buildEntities(sources);
const bloc = (camara: string, slug: string) => entities.blocs.find(b => b.camara === camara && b.slug === slug)!;

test('slugify drops accents and punctuation and never returns an empty slug', () => {
  assert.equal(slugify('UNIÓN POR LA PATRIA'), 'union-por-la-patria');
  assert.equal(slugify('UCR - Unión Cívica Radical'), 'ucr-union-civica-radical');
  assert.equal(slugify('Tierra del Fuego, Antártida e Islas del Atlántico Sur'), 'tierra-del-fuego-antartida-e-islas-del-atlantico-sur');
  assert.equal(slugify('U.C.R.'), 'ucr');
  assert.equal(slugify("GONZALEZ D'ALESSANDRO"), 'gonzalez-dalessandro');
  assert.equal(slugify('  ¿?  '), 'sin-nombre');
});

test('uniqueSlugs gives colliding names a numbered suffix, whatever the input order', () => {
  const items = [{ key: 'UCR', label: 'UCR' }, { key: 'U.C.R.', label: 'U.C.R.' }, { key: 'PRO', label: 'PRO' }];
  const expected = new Map([['PRO', 'pro'], ['U.C.R.', 'ucr'], ['UCR', 'ucr-2']]);
  assert.deepEqual(uniqueSlugs(items), expected);
  assert.deepEqual(uniqueSlugs([...items].reverse()), expected);
});

test('titleCase keeps acronyms and lowercases joining words', () => {
  assert.equal(titleCase('UCR - UNIÓN CÍVICA RADICAL'), 'UCR - Unión Cívica Radical');
  assert.equal(titleCase('FRENTE PRO'), 'Frente PRO');
  assert.equal(titleCase('PTS-FRENTE DE IZQUIERDA Y DE TRABAJADORES UNIDAD'), 'PTS-Frente de Izquierda y de Trabajadores Unidad');
  assert.equal(titleCase('PARTIDO OBRERO EN EL FRENTE'), 'Partido Obrero en el Frente');
});

test('provinceOf reads the 24 districts in every spelling the sources use', () => {
  assert.equal(PROVINCES.length, 24);
  assert.equal(new Set(PROVINCES.map(p => p.slug)).size, 24);
  for (const name of ['CABA', 'CIUDAD DE BUENOS AIRES', 'CIUDAD AUTÓNOMA DE BUENOS AIRES', 'Capital Federal']) {
    assert.equal(provinceOf(name)?.slug, 'ciudad-de-buenos-aires', name);
  }
  assert.equal(provinceOf('TIERRA DEL FUEGO, ANTÁRTIDA E ISLAS DEL ATLÁNTICO SUR')?.nombre, 'Tierra del Fuego');
  assert.equal(provinceOf('TUCUMAN')?.nombre, 'Tucumán');
  assert.equal(provinceOf('TUCUMÁN')?.slug, 'tucuman');
  assert.equal(provinceOf('BUENOS AIRES')?.slug, 'buenos-aires');
  assert.equal(provinceOf('Narnia'), null);
});

test('blocs are pages per chamber: same-named blocs stay apart and UxP never merges with Justicialista', () => {
  const list = (camara: string) => entities.blocs.filter(b => b.camara === camara).map(b => [b.slug, b.seats]);
  assert.deepEqual(list('diputados'), [['union-por-la-patria', 4], ['la-libertad-avanza', 1], ['pro', 1], ['ucr', 1], ['ucr-2', 1]]);
  assert.deepEqual(list('senado'), [['justicialista', 2], ['independencia', 1], ['la-libertad-avanza', 1], ['ucr-union-civica-radical', 1]]);
  assert.equal(bloc('diputados', 'la-libertad-avanza').url, '/bloques/diputados/la-libertad-avanza/');
  assert.equal(bloc('senado', 'la-libertad-avanza').url, '/bloques/senado/la-libertad-avanza/');
  assert.deepEqual(bloc('senado', 'la-libertad-avanza').members.map(m => m.id), ['s-bullrich']);
  assert.deepEqual(bloc('senado', 'justicialista').members.map(m => m.id), ['s-manzur', 's-mayans']);
});

test('a Diputados bloc page has members, districts, chairs, bills, travel points and missions', () => {
  const uxp = bloc('diputados', 'union-por-la-patria');
  assert.equal(uxp.nombre, UXP);
  assert.equal(uxp.titulo, 'Unión por la Patria');
  assert.equal(uxp.camara, 'diputados');
  assert.equal(uxp.rank, 1);
  assert.equal(uxp.chamberSeats, 8);
  assert.deepEqual(uxp.members[0], {
    id: 'd-aguirre', nombre: 'Aguirre, Hilda', distrito: 'La Rioja', provinciaSlug: 'la-rioja', url: '/diputados/d-aguirre/',
  });
  assert.deepEqual(uxp.members.map(m => m.id), ['d-aguirre', 'd-cisneros', 'd-monzon', 'd-yedlin']);
  assert.deepEqual(uxp.byDistrict, [
    { slug: 'tucuman', nombre: 'Tucumán', count: 2 },
    { slug: 'buenos-aires', nombre: 'Buenos Aires', count: 1 },
    { slug: 'la-rioja', nombre: 'La Rioja', count: 1 },
  ]);
  assert.equal(uxp.districts, 3);
  const chair = { comisionId: C1, slug: 'accion-social-y-salud-publica', titulo: 'Accion Social y Salud Publica', url: '/comisiones/accion-social-y-salud-publica/', cargo: 'presidente', memberId: 'd-yedlin', memberNombre: 'Yedlin, Pablo Raúl' };
  assert.deepEqual(uxp.chairs, [chair]);
  assert.deepEqual(uxp.authorities, [chair]);
  const lla = bloc('diputados', 'la-libertad-avanza');
  assert.deepEqual(lla.chairs.map(c => c.comisionId), [C2]);
  assert.deepEqual(lla.authorities.map(c => [c.comisionId, c.cargo]), [[C2, 'presidente'], [C1, 'vicepresidente 1']]);

  assert.deepEqual(uxp.bills, {
    total: 79,
    authors: 2,
    porTipo: [{ tipo: 'RESOLUCION', count: 47 }, { tipo: 'DECLARACION', count: 16 }, { tipo: 'LEY', count: 16 }],
    funnel: [
      { stage: 'presentado', count: 71, alcanzado: 79 },
      { stage: 'en comisión', count: 1, alcanzado: 8 },
      { stage: 'con dictamen', count: 0, alcanzado: 7 },
      { stage: 'media sanción', count: 0, alcanzado: 7 },
      { stage: 'sancionado', count: 7, alcanzado: 7 },
    ],
  });
  assert.deepEqual(uxp.travel?.points.find(p => p.id === 'd-monzon'), {
    id: 'd-monzon', nombre: 'Monzón, Roxana', legs: 64, legsPerMonth: 2.67, band: NEAR, flagged: true, status: 'viaja-mas',
  });
  assert.equal(uxp.travel?.points.find(p => p.id === 'd-cisneros')?.status, 'sin-tramos');
  assert.deepEqual(uxp.travel?.bands, [{ band: NEAR, deputies: 86, median: 0.33 }, { band: FAR, deputies: 62, median: 5.93 }]);
  assert.deepEqual(uxp.travel?.counts, { 'en-linea': 2, 'viaja-mas': 1, 'sin-tramos': 1, 'no-comparado': 0, 'sin-distancia': 0 });
  assert.deepEqual(uxp.missions, { count: 6, members: 2 });
  assert.equal(uxp.votes, null);
  assert.equal(uxp.provenance.travel.label, '2.º semestre 2024 – 1.º semestre 2026');
  assert.equal(uxp.provenance.bills.label, '03/01/2024 – 06/10/2026');
  assert.equal(uxp.provenance.missions.label, '11/03/2024 – 09/05/2026');
  assert.equal(uxp.provenance.committees.label, 'composición al 03/11/2026');
  assert.equal(uxp.provenance.members.label, 'vigente al 03/11/2026');
  assert.ok(uxp.provenance.travel.sources.some(s => s.href.includes('viajes-nacionales')));
  assert.equal(bloc('diputados', 'ucr-2').bills, null);
});

test('a Senate bloc page has its Rice index, actas and members attendance and loyalty, no trips', () => {
  const pj = bloc('senado', 'justicialista');
  assert.deepEqual(pj.votes, {
    riceMedio: 0.97, actas: 343, senators: 22,
    members: [
      { id: 's-manzur', nombre: 'MANZUR, JUAN LUIS', actas: 340, asistencia: 0.95, lealtadBloque: 0.98 },
      { id: 's-mayans', nombre: 'MAYANS, JOSÉ', actas: 330, asistencia: 0.9, lealtadBloque: 0.99 },
    ],
  });
  assert.equal(pj.travel, null);
  assert.equal(pj.missions, null);
  assert.deepEqual(pj.chairs, []);
  assert.deepEqual(pj.bills?.total, 7);
  assert.equal(pj.provenance.votes.label, '345 actas, 23/02/2024 – 29/10/2026');
  assert.deepEqual(pj.byDistrict.map(d => d.slug), ['formosa', 'tucuman']);
  // a bloc with no votes recorded has no index
  const lla = bloc('senado', 'la-libertad-avanza');
  assert.equal(lla.votes?.riceMedio, 0.96);
  assert.deepEqual(lla.votes?.members, []);
});

test('every one of the 24 provinces gets a page; Tucumán lists its legislators, blocs, trips and committees', () => {
  assert.equal(entities.provinces.length, 24);
  const tucuman = entities.provinces.find(p => p.slug === 'tucuman')!;
  assert.equal(tucuman.url, '/provincias/tucuman/');
  assert.equal(tucuman.nombre, 'Tucumán');
  assert.deepEqual(tucuman.deputies.map(d => d.id), ['d-campero', 'd-cisneros', 'd-yedlin']);
  assert.deepEqual(tucuman.senators.map(s => s.id), ['s-avila', 's-manzur']);
  assert.deepEqual(tucuman.blocs.diputados, [
    { slug: 'union-por-la-patria', titulo: 'Unión por la Patria', url: '/bloques/diputados/union-por-la-patria/', seats: 2 },
    { slug: 'la-libertad-avanza', titulo: 'La Libertad Avanza', url: '/bloques/diputados/la-libertad-avanza/', seats: 1 },
  ]);
  assert.deepEqual(tucuman.blocs.senado.map(b => [b.slug, b.seats]), [['independencia', 1], ['justicialista', 1]]);
  assert.deepEqual(tucuman.travel, { medianLegsPerMonth: 7.71, deputies: 3, bands: [FAR] });
  assert.deepEqual(tucuman.committees, {
    seats: 5,
    committees: 2,
    chairs: [
      { comisionId: C1, slug: 'accion-social-y-salud-publica', titulo: 'Accion Social y Salud Publica', url: '/comisiones/accion-social-y-salud-publica/', cargo: 'presidente', memberId: 'd-yedlin', memberNombre: 'Yedlin, Pablo Raúl' },
      { comisionId: C2, slug: 'presupuesto-y-hacienda', titulo: 'Presupuesto y Hacienda', url: '/comisiones/presupuesto-y-hacienda/', cargo: 'presidente', memberId: 'd-campero', memberNombre: 'Campero, Mariano' },
    ],
  });
  const caba = entities.provinces.find(p => p.slug === 'ciudad-de-buenos-aires')!;
  assert.deepEqual([caba.deputies.length, caba.senators.length], [1, 2]);
  // Leone is not compared (under 3 months): no median for the city
  assert.deepEqual(caba.travel, { medianLegsPerMonth: null, deputies: 0, bands: [] });
  const salta = entities.provinces.find(p => p.slug === 'salta')!;
  assert.deepEqual([salta.deputies, salta.senators, salta.blocs.diputados], [[], [], []]);
});

test('a committee page has members with role, bloc mix, districts and the members bills', () => {
  const salud = entities.committees.find(c => c.id === C1)!;
  assert.equal(salud.slug, 'accion-social-y-salud-publica');
  assert.equal(salud.url, '/comisiones/accion-social-y-salud-publica/');
  assert.equal(salud.tipo, 'permanente');
  assert.equal(salud.integrantes, 5);
  assert.equal(salud.unlinked, 1);
  assert.deepEqual(salud.members.map(m => [m.id, m.cargo]), [
    ['d-yedlin', 'presidente'], ['d-campero', 'vicepresidente 1'], ['d-aguirre', 'integrante'], ['d-cisneros', 'integrante'],
  ]);
  assert.deepEqual(salud.members[0], {
    id: 'd-yedlin', nombre: 'Yedlin, Pablo Raúl', url: '/diputados/d-yedlin/', cargo: 'presidente', distrito: 'Tucumán', provinciaSlug: 'tucuman',
    bloc: { slug: 'union-por-la-patria', titulo: 'Unión por la Patria', url: '/bloques/diputados/union-por-la-patria/' },
  });
  assert.deepEqual(salud.blocMix, [
    { slug: 'union-por-la-patria', titulo: 'Unión por la Patria', url: '/bloques/diputados/union-por-la-patria/', count: 3 },
    { slug: 'la-libertad-avanza', titulo: 'La Libertad Avanza', url: '/bloques/diputados/la-libertad-avanza/', count: 1 },
  ]);
  assert.deepEqual(salud.districts, [{ slug: 'tucuman', nombre: 'Tucumán', count: 3 }, { slug: 'la-rioja', nombre: 'La Rioja', count: 1 }]);
  assert.deepEqual(salud.authorities.map(a => [a.cargo, a.url]), [
    ['presidente', '/diputados/d-yedlin/'], ['vicepresidente 1', '/diputados/d-campero/'], ['secretario', null],
  ]);
  assert.equal(salud.bills?.total, 84);
  assert.equal(salud.bills?.authors, 3);
  assert.equal(salud.bills?.label, 'Proyectos de sus integrantes como primer firmante, de cualquier tema');
  assert.equal(salud.bills?.funnel.at(-1)?.alcanzado, 7);
  const especial = entities.committees.find(c => c.id === C3)!;
  assert.equal(especial.slug, 'accion-social-y-salud-publica-2');
  assert.equal(especial.tipo, 'especial');
  assert.equal(especial.bills, null);
});

test('relations give each legislator the links of the relation strip', () => {
  assert.deepEqual(entities.relations.get('d-yedlin'), {
    id: 'd-yedlin',
    camara: 'diputados',
    url: '/diputados/d-yedlin/',
    bloc: { slug: 'union-por-la-patria', nombre: UXP, titulo: 'Unión por la Patria', url: '/bloques/diputados/union-por-la-patria/', seats: 4, chamberSeats: 8 },
    province: { slug: 'tucuman', nombre: 'Tucumán', url: '/provincias/tucuman/', deputies: 3, senators: 2 },
    committees: [{ id: C1, slug: 'accion-social-y-salud-publica', titulo: 'Accion Social y Salud Publica', cargo: 'presidente', url: '/comisiones/accion-social-y-salud-publica/' }],
    counts: { bills: 69, sancionados: 6, legs: 185, missions: 4, votes: null },
  });
  assert.deepEqual(entities.relations.get('s-manzur'), {
    id: 's-manzur',
    camara: 'senado',
    url: '/senadores/s-manzur/',
    bloc: { slug: 'justicialista', nombre: 'JUSTICIALISTA', titulo: 'Justicialista', url: '/bloques/senado/justicialista/', seats: 2, chamberSeats: 5 },
    province: { slug: 'tucuman', nombre: 'Tucumán', url: '/provincias/tucuman/', deputies: 3, senators: 2 },
    committees: [],
    counts: { bills: 7, sancionados: 0, legs: null, missions: null, votes: 340 },
  });
  assert.deepEqual(entities.relations.get('d-uno')?.counts, { bills: 0, sancionados: 0, legs: 12, missions: 0, votes: null });
  assert.equal(entities.relations.size, 13);
});

test('the search index has one short entry per legislator, bloc, province and committee', () => {
  const { search } = entities;
  const count = (type: string) => search.filter(e => e.type === type).length;
  assert.deepEqual([count('diputado'), count('senador'), count('bloque'), count('provincia'), count('comision')], [8, 5, 9, 24, 3]);
  assert.deepEqual(search.find(e => e.url === '/diputados/d-yedlin/'), {
    type: 'diputado', label: 'Yedlin, Pablo Raúl', sub: 'Tucumán · Unión por la Patria', url: '/diputados/d-yedlin/',
    keywords: 'yedlin pablo raul tucuman union por la patria',
  });
  assert.deepEqual(search.find(e => e.url === '/bloques/senado/justicialista/'), {
    type: 'bloque', label: 'Justicialista', sub: 'Senado · 2 senadores', url: '/bloques/senado/justicialista/', keywords: 'justicialista senado',
  });
  assert.deepEqual(search.find(e => e.url === '/provincias/ciudad-de-buenos-aires/'), {
    type: 'provincia', label: 'Ciudad de Buenos Aires', sub: '1 diputado · 2 senadores', url: '/provincias/ciudad-de-buenos-aires/',
    keywords: 'ciudad de buenos aires caba capital federal autonoma',
  });
  assert.deepEqual(search.find(e => e.url === '/comisiones/accion-social-y-salud-publica/'), {
    type: 'comision', label: 'Accion Social y Salud Publica', sub: 'Diputados · 5 integrantes · preside Yedlin, Pablo Raúl',
    url: '/comisiones/accion-social-y-salud-publica/', keywords: 'accion social y salud publica comision diputados',
  });
  for (const entry of search) {
    assert.deepEqual(Object.keys(entry), ['type', 'label', 'sub', 'url', 'keywords']);
    assert.ok(entry.sub.length <= 80, entry.sub);
    assert.equal(entry.keywords, entry.keywords.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  }
  assert.equal(entities.searchBytes, new TextEncoder().encode(JSON.stringify(search)).length);
  assert.equal(searchIndexBytes([]), 2);
});

test('topic summaries give the home cards their numbers, each with source and period', () => {
  const { topics } = entities;
  assert.deepEqual(
    Object.fromEntries(Object.entries(topics.numbers).map(([k, v]) => [k, v.value])),
    { diputados: 8, senadores: 5, proyectos: 84, actas: 345, misiones: 6, comisiones: 3 },
  );
  assert.equal(topics.numbers.misiones.sub, 'de 2 diputados en funciones');
  for (const metric of Object.values(topics.numbers)) assert.ok(metric.provenance.sources.length > 0 && metric.provenance.label);

  assert.deepEqual(topics.travel.bands, [{ band: NEAR, deputies: 86, median: 0.33 }, { band: FAR, deputies: 62, median: 5.93 }]);
  assert.deepEqual(topics.travel.flagged, [{ id: 'd-monzon', nombre: 'Monzón, Roxana', url: '/diputados/d-monzon/', band: NEAR, legsPerMonth: 2.67, bandMedian: 0.33 }]);
  assert.equal(topics.travel.provenance.label, '2.º semestre 2024 – 1.º semestre 2026');

  assert.equal(topics.pay.bruto, 6590294.3);
  assert.equal(topics.pay.neto, 5187411.88);
  assert.deepEqual([Math.round(topics.pay.shares.dieta * 100), Math.round(topics.pay.shares.gastosRepresentacion * 100)], [93, 7]);
  assert.equal(topics.pay.provenance.label, 'vigente al 03/11/2026');

  assert.equal(topics.bills.total, 84);
  assert.deepEqual(topics.bills.funnel.map(f => [f.stage, f.alcanzado]), [
    ['presentado', 84], ['en comisión', 8], ['con dictamen', 7], ['media sanción', 7], ['sancionado', 7],
  ]);
  assert.equal(topics.bills.funnel[0].share, 1);
  assert.equal(topics.bills.funnel[4].share, 7 / 84);

  assert.deepEqual(topics.senate.blocs.map(b => [b.titulo, b.senators, b.riceMedio, b.url]), [
    ['Justicialista', 22, 0.97, '/bloques/senado/justicialista/'],
    ['La Libertad Avanza', 22, 0.96, '/bloques/senado/la-libertad-avanza/'],
    ['UCR - Unión Cívica Radical', 14, 0.93, '/bloques/senado/ucr-union-civica-radical/'],
    ['Unidad Ciudadana', 8, 1, null],
    ['Independencia', 1, 1, '/bloques/senado/independencia/'],
  ]);
  assert.deepEqual(topics.senate.attendance, {
    min: { id: 's-avila', nombre: 'AVILA, BEATRIZ', value: 0.722 },
    max: { id: 's-manzur', nombre: 'MANZUR, JUAN LUIS', value: 0.95 },
  });
  assert.equal(topics.senate.provenance.label, '345 actas, 23/02/2024 – 29/10/2026');

  assert.equal(topics.committees.total, 3);
  assert.deepEqual(topics.committees.largest.map(c => [c.id, c.integrantes, c.url]), [
    [C1, 5, '/comisiones/accion-social-y-salud-publica/'],
    [C2, 3, '/comisiones/presupuesto-y-hacienda/'],
    [C3, 1, '/comisiones/accion-social-y-salud-publica-2/'],
  ]);
});

test('a committee published without a name gets an explicit title, also in search', () => {
  const unnamed = 'HCDN00064';
  const withUnnamed: EntitySources = {
    ...sources,
    committees: {
      ...committees,
      committees: new Map([...committees.committees, [unnamed, committee(unnamed, unnamed, 1)]]),
      byDeputy: new Map([...committees.byDeputy, ['d-leone', [seat(C2, PRESUPUESTO, 'integrante'), seat(unnamed, unnamed, 'integrante')]]]),
    },
  };
  const result = buildEntities(withUnnamed);
  const page = result.committees.find(c => c.id === unnamed)!;
  assert.equal(page.titulo, 'Comisión sin nombre publicado (HCDN00064)');
  assert.ok(result.search.some(s => s.type === 'comision' && s.label === 'Comisión sin nombre publicado (HCDN00064)'));
});
