import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeputyPolicy, createSenatePolicy, institutionalOrigin, linkBillAuthor, policyStatus, senateIdentities, type PolicyLinker } from './link-policy.ts';
import { parseRoster } from './roster.ts';

// Trimmed real roster rows (diputados2.1.csv); PEREZ rows are synthetic, two people with one name.
const ROSTER_CSV = `ID,APELLIDO,NOMBRE,GENERO,DISTRITO,INICIO,FIN,JURAMENTO,CESE,BLOQUE,BLOQUE_INICIO,BLOQUE_FIN
HCDN1136,ABDALA DE MATARAZZO,NORMA AMANDA,F,SANTIAGO DEL ESTERO,2017-12-10T00:00:00,2021-12-09T00:00:00,2017-12-06T00:00:00,2021-12-09T00:00:00,FRENTE DE TODOS,2019-12-10T00:00:00,2021-12-09T00:00:00
HCDN2898,LOPEZ MURPHY,RICARDO HIPOLITO,M,CIUDAD DE BUENOS AIRES,2021-12-10T00:00:00,2025-12-09T00:00:00,2021-12-07T00:00:00,2025-12-09T00:00:00,REPUBLICANOS UNIDOS,2025-03-05T00:00:00,2025-12-09T00:00:00
HCDN3077,ZULLI,CHRISTIAN ALEJANDRO,M,CORRIENTES,2023-12-10T00:00:00,2027-12-09T00:00:00,2023-12-07T00:00:00,2027-12-09T00:00:00,UNIÓN POR LA PATRIA,2023-12-10T00:00:00,2027-12-09T00:00:00
HCDN9001,PEREZ,JUAN,M,CHACO,2023-12-10T00:00:00,2027-12-09T00:00:00,2023-12-07T00:00:00,2027-12-09T00:00:00,X,2023-12-10T00:00:00,2027-12-09T00:00:00
HCDN9002,PEREZ,JUAN,M,CHACO,2023-12-10T00:00:00,2027-12-09T00:00:00,2023-12-07T00:00:00,2027-12-09T00:00:00,Y,2023-12-10T00:00:00,2027-12-09T00:00:00
`;

const people = parseRoster(ROSTER_CSV);
const CURRENT = [
  { id: 'dip-zulli', nombre: 'Zulli, Christian', lugar: 'CORRIENTES' },
  // in the composition but not (yet) in the roster
  { id: 'dip-nuevo', nombre: 'Nuevo, Ana', lugar: 'SALTA' },
];
const MAP = new Map([['dip-zulli', 'HCDN3077']]);
const PERIOD = { from: '2024-01-01', to: '2026-11-03' };

test('a current deputy links to the composition id and the roster id', () => {
  const policy = createDeputyPolicy(people, PERIOD, CURRENT, MAP);
  const link = policy.link('ZULLI, CHRISTIAN ALEJANDRO', 'CORRIENTES');
  assert.equal(link.status, 'matched');
  assert.equal(link.deputyId, 'dip-zulli');
  assert.equal(link.hcdnId, 'HCDN3077');
  assert.equal(link.current, true);
  assert.equal(policyStatus(link), 'matched-current');
});

test('a former deputy in office during the period is matched-former, with no current id', () => {
  const policy = createDeputyPolicy(people, PERIOD, CURRENT, MAP);
  const link = policy.link('DIP. LOPEZ MURPHY RICARDO');
  assert.equal(link.status, 'matched');
  assert.equal(link.deputyId, null);
  assert.equal(link.hcdnId, 'HCDN2898');
  assert.equal(link.personId, 'HCDN2898');
  assert.equal(link.current, false);
  assert.equal(policyStatus(link), 'matched-former');
  assert.deepEqual(policy.linkFn('DIP. LOPEZ MURPHY RICARDO'), {
    status: 'matched', deputyId: null, confidence: link.confidence, candidates: [],
  });
});

test('a deputy out of office during the period stays unmatched', () => {
  const policy = createDeputyPolicy(people, PERIOD, CURRENT, MAP);
  const link = policy.link('ABDALA DE MATARAZZO, NORMA AMANDA');
  assert.equal(policyStatus(link), 'unmatched');
  assert.equal(link.hcdnId, null);
  const earlier = createDeputyPolicy(people, { from: '2020-01-01', to: '2020-12-31' }, CURRENT, MAP);
  assert.equal(policyStatus(earlier.link('ABDALA DE MATARAZZO, NORMA AMANDA')), 'matched-former');
});

test('a current deputy missing from the roster is still linkable, without a roster id', () => {
  const policy = createDeputyPolicy(people, PERIOD, CURRENT, MAP);
  const link = policy.link('NUEVO, ANA', 'SALTA');
  assert.equal(policyStatus(link), 'matched-current');
  assert.equal(link.deputyId, 'dip-nuevo');
  assert.equal(link.hcdnId, null);
});

test('two people with one name are doubtful, with named candidates', () => {
  const policy = createDeputyPolicy(people, PERIOD, CURRENT, MAP);
  const link = policy.link('PEREZ, JUAN', 'CHACO');
  assert.equal(policyStatus(link), 'doubtful');
  assert.equal(link.deputyId, null);
  assert.deepEqual(link.candidates.map(c => [c.personId, c.nombre]).sort(), [
    ['HCDN9001', 'PEREZ, JUAN'],
    ['HCDN9002', 'PEREZ, JUAN'],
  ]);
});

test('quality counts distinct names (worst outcome) and every linked row', () => {
  const policy = createDeputyPolicy(people, PERIOD, CURRENT, MAP);
  policy.link('ZULLI, CHRISTIAN ALEJANDRO', 'CORRIENTES');
  policy.link('ZULLI, CHRISTIAN ALEJANDRO', 'CORRIENTES');
  policy.link('LOPEZ MURPHY RICARDO');
  policy.link('PEREZ, JUAN', 'CHACO');
  policy.link('Pérez,  Juan', 'CHACO');
  policy.link('NADIE, NADA');
  assert.deepEqual(policy.quality(), {
    names: { matchedCurrent: 1, matchedFormer: 1, doubtful: 1, unmatched: 1, total: 4 },
    rows: { matchedCurrent: 2, matchedFormer: 1, doubtful: 2, unmatched: 1, total: 6, linkedPercent: 50 },
    doubtful: [{
      nombre: 'PEREZ, JUAN',
      lugar: 'CHACO',
      candidates: policy.link('PEREZ, JUAN', 'CHACO').candidates,
    }],
    unmatched: [{ nombre: 'NADIE, NADA', lugar: '' }],
  });
});

test('quality of an unused policy is all zeros', () => {
  const policy = createDeputyPolicy(people, PERIOD, CURRENT, MAP);
  assert.deepEqual(policy.quality(), {
    names: { matchedCurrent: 0, matchedFormer: 0, doubtful: 0, unmatched: 0, total: 0 },
    rows: { matchedCurrent: 0, matchedFormer: 0, doubtful: 0, unmatched: 0, total: 0, linkedPercent: 0 },
    doubtful: [],
    unmatched: [],
  });
});

test('senate policy: official ids win, former senators are matched-former, others go to the linker', () => {
  const current = [{ id: 'sen-546', nombre: 'ABAD, MAXIMILIANO', lugar: 'BUENOS AIRES' }];
  const former = [
    { id: 'sen-400', nombre: 'BULLRICH, PATRICIA', lugar: 'CIUDAD AUTÓNOMA DE BUENOS AIRES' },
    // the official id of a current senator never becomes a former one
    { id: 'sen-546', nombre: 'ABAD, MAXIMILIANO', lugar: 'BUENOS AIRES' },
  ];
  const ids = new Map([['ABAD, MAXIMILIANO|BUENOS AIRES', 'sen-546'], ['BULLRICH, PATRICIA|CIUDAD AUTÓNOMA DE BUENOS AIRES', 'sen-400']]);
  const policy = createSenatePolicy(current, former, (nombre, lugar) => ids.get(`${nombre}|${lugar}`) ?? null);
  const abad = policy.link('ABAD, MAXIMILIANO', 'BUENOS AIRES');
  assert.deepEqual([policyStatus(abad), abad.deputyId, abad.personId, abad.confidence], ['matched-current', 'sen-546', 'sen-546', 1]);
  const bullrich = policy.link('BULLRICH, PATRICIA', 'CIUDAD AUTÓNOMA DE BUENOS AIRES');
  assert.deepEqual([policyStatus(bullrich), bullrich.deputyId, bullrich.personId, bullrich.hcdnId], ['matched-former', null, 'sen-400', null]);
  // a bill author has no official id: linked by name
  const author = policy.link('ABAD, MAXIMILIANO DANIEL');
  assert.deepEqual([policyStatus(author), author.deputyId], ['matched-current', 'sen-546']);
  assert.equal(policyStatus(policy.link('GARCIA, JUAN')), 'unmatched');
  assert.deepEqual(policy.quality().names, { matchedCurrent: 2, matchedFormer: 1, doubtful: 0, unmatched: 1, total: 4 });
});

test('senateIdentities: official ids, then name and province for former senators the Senate publishes without a link', () => {
  const current = [{ id: 'sen-546', nombre: 'ABAD, MAXIMILIANO', lugar: 'BUENOS AIRES' }];
  // latest acta first: its spelling wins
  const votes = [
    { nombre: 'ABAD, MAXIMILIANO', senadorId: 546, provincia: 'BUENOS AIRES' },
    { nombre: 'MENDOZA, SANDRA MARIELA', senadorId: 540, provincia: 'TUCUMÁN' },
    { nombre: 'LOUSTEAU, MARTÍN', senadorId: null, provincia: 'CIUDAD AUTÓNOMA DE BUENOS AIRES' },
    // a current senator in an old row without a link: left to the name linker, never a former one
    { nombre: 'ABAD, MAXIMILIANO DANIEL', senadorId: null, provincia: 'BUENOS AIRES' },
    { nombre: 'MENDOZA, SANDRA', senadorId: 540, provincia: 'TUCUMÁN' },
  ];
  const { former, idOf } = senateIdentities(votes, current);
  assert.deepEqual(former, [
    { id: 'sen-540', nombre: 'MENDOZA, SANDRA MARIELA', lugar: 'TUCUMÁN' },
    { id: 'sen-acta:lousteau, martin|ciudad autonoma de buenos aires', nombre: 'LOUSTEAU, MARTÍN', lugar: 'CIUDAD AUTÓNOMA DE BUENOS AIRES' },
  ]);
  assert.equal(idOf('ABAD, MAXIMILIANO', 'BUENOS AIRES'), 'sen-546');
  assert.equal(idOf('MENDOZA, SANDRA', 'TUCUMÁN'), 'sen-540');
  assert.equal(idOf('Lousteau, Martín', 'CIUDAD AUTÓNOMA DE BUENOS AIRES'), 'sen-acta:lousteau, martin|ciudad autonoma de buenos aires');
  assert.equal(idOf('ABAD, MAXIMILIANO DANIEL', 'BUENOS AIRES'), null);

  const policy = createSenatePolicy(current, former, idOf);
  const lousteau = policy.link('LOUSTEAU, MARTÍN', 'CIUDAD AUTÓNOMA DE BUENOS AIRES');
  assert.deepEqual([policyStatus(lousteau), lousteau.deputyId, lousteau.confidence], ['matched-former', null, 1]);
  assert.equal(policyStatus(policy.link('ABAD, MAXIMILIANO DANIEL', 'BUENOS AIRES')), 'matched-current');
  // a bill author without province still reaches the former senator by name
  assert.equal(policyStatus(policy.link('LOUSTEAU, MARTIN')), 'matched-former');
});

test('institutionalOrigin: bills filed by the Executive or official bodies, by the expediente origin code', () => {
  // real Senate-origin bills (proyectos_parlamentarios2.6.csv, since 2024-01-01)
  assert.equal(institutionalOrigin('0223-PE-2026'), 'Poder Ejecutivo');
  assert.equal(institutionalOrigin('0244-PE-2026'), 'Poder Ejecutivo');
  assert.equal(institutionalOrigin('0031-OV-2026'), 'Oficiales varios');
  assert.equal(institutionalOrigin('0012-JGM-2025'), 'Jefatura de Gabinete de Ministros');
  for (const expediente of ['0320-S-2026', '5242-D-2026', '0010-CD-2025', '', 'PE']) assert.equal(institutionalOrigin(expediente), null);
});

test('senate bill authors: every senator links; the Executive and committees are institutional, outside the denominator', () => {
  const current = [
    { id: 'sen-540', nombre: 'MENDOZA, SANDRA MARIELA', lugar: 'TUCUMÁN' },
    { id: 'sen-546', nombre: 'ABAD, MAXIMILIANO', lugar: 'BUENOS AIRES' },
  ];
  const votes = [{ nombre: 'BLANCO, PABLO DANIEL', senadorId: null, provincia: 'TIERRA DEL FUEGO, ANTÁRTIDA E ISLAS DEL ATLÁNTICO SUR' }];
  const policy = createSenatePolicy(current, senateIdentities(votes, current).former);
  // real AUTOR and expediente pairs of Senate-origin bills
  const bills = [
    ['MENDOZA, SANDRA MARIELA', '0320-S-2026'],
    ['MENDOZA, SANDRA MARIELA', '0252-S-2026'],
    ['ABAD, MAXIMILIANO', '0096-S-2026'],
    ['BLANCO, PABLO DANIEL', '1720-S-2025'],
    ['MILEI, JAVIER GERARDO', '0223-PE-2026'],
    ['MILEI, JAVIER GERARDO', '0159-PE-2025'],
    ['SANTILLI, DIEGO', '0244-PE-2026'],
    ['ASUNTOS CONSTITUCIONALES', '0031-OV-2026'],
  ];
  const results = bills.map(([autor, expediente]) => {
    const origen = institutionalOrigin(expediente);
    return origen ? policy.linkInstitutional(autor, origen) : policy.linkFn(autor);
  });
  assert.deepEqual(results.map(r => [r.status, r.deputyId]), [
    ['matched', 'sen-540'],
    ['matched', 'sen-540'],
    ['matched', 'sen-546'],
    ['matched', null],
    ['unmatched', null],
    ['unmatched', null],
    ['unmatched', null],
    ['unmatched', null],
  ]);
  assert.deepEqual(policy.quality(), {
    names: { matchedCurrent: 2, matchedFormer: 1, doubtful: 0, unmatched: 0, total: 3 },
    rows: { matchedCurrent: 3, matchedFormer: 1, doubtful: 0, unmatched: 0, total: 4, linkedPercent: 100 },
    doubtful: [],
    unmatched: [],
    institutional: {
      names: 3,
      rows: 4,
      authors: [
        { nombre: 'ASUNTOS CONSTITUCIONALES', origen: 'Oficiales varios', rows: 1 },
        { nombre: 'MILEI, JAVIER GERARDO', origen: 'Poder Ejecutivo', rows: 2 },
        { nombre: 'SANTILLI, DIEGO', origen: 'Poder Ejecutivo', rows: 1 },
      ],
    },
  });
});

test('an institutional author is never linked to a legislator with the same name', () => {
  const current = [{ id: 'sen-900', nombre: 'SANTILLI, DIEGO', lugar: 'BUENOS AIRES' }];
  const policy = createSenatePolicy(current, []);
  assert.deepEqual(policy.linkInstitutional('SANTILLI, DIEGO', 'Poder Ejecutivo'), { status: 'unmatched', deputyId: null, confidence: 0, candidates: [] });
  assert.equal(policyStatus(policy.link('SANTILLI, DIEGO')), 'matched-current');
  const quality = policy.quality();
  assert.deepEqual([quality.rows.total, quality.names.total, quality.institutional?.rows], [1, 1, 1]);
});

test('bill authors: Executive bills of either chamber are institutional, never credited to a legislator with that name', () => {
  const calls: string[] = [];
  const stub = (chamber: string): PolicyLinker => ({
    link: () => { throw new Error('unused'); },
    linkFn: rawName => { calls.push(`${chamber} person ${rawName}`); return { status: 'matched', deputyId: `${chamber}-id`, confidence: 1, candidates: [] }; },
    linkInstitutional: (rawName, origen) => { calls.push(`${chamber} institutional ${rawName} ${origen}`); return { status: 'unmatched', deputyId: null, confidence: 0, candidates: [] }; },
    quality: () => { throw new Error('unused'); },
  });
  const diputados = stub('dip');
  const senado = stub('sen');
  // Real cases: Santilli and Petri were or are deputies, but these expedientes were filed by the Executive.
  assert.equal(linkBillAuthor('SANTILLI, DIEGO', { camaraOrigen: 'Diputados', expediente: '0012-PE-2026' }, diputados, senado).deputyId, null);
  assert.equal(linkBillAuthor('PETRI, LUIS ALFONSO', { camaraOrigen: 'Diputados', expediente: '0003-JGM-2025' }, diputados, senado).deputyId, null);
  assert.equal(linkBillAuthor('YEDLIN, PABLO RAUL', { camaraOrigen: 'Diputados', expediente: '4981-D-2026' }, diputados, senado).deputyId, 'dip-id');
  assert.equal(linkBillAuthor('MILEI, JAVIER GERARDO', { camaraOrigen: 'Senado', expediente: '0223-PE-2026' }, diputados, senado).deputyId, null);
  assert.equal(linkBillAuthor('ABAD, MAXIMILIANO', { camaraOrigen: 'Senado', expediente: '0096-S-2026' }, diputados, senado).deputyId, 'sen-id');
  assert.deepEqual(calls, [
    'dip institutional SANTILLI, DIEGO Poder Ejecutivo',
    'dip institutional PETRI, LUIS ALFONSO Jefatura de Gabinete de Ministros',
    'dip person YEDLIN, PABLO RAUL',
    'sen institutional MILEI, JAVIER GERARDO Poder Ejecutivo',
    'sen person ABAD, MAXIMILIANO',
  ]);
});
