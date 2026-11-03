import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalDistrict,
  committeesByDeputy,
  parseAuthorities,
  parseCommittees,
  parseMembers,
  type CommitteeRow,
} from './comisiones.ts';
import { createLinker, type LinkResult } from './linkage.ts';

// Trimmed real rows from HCDN CKAN `comisiones` (comisiones3.2.csv, comisiones_permanentes_*1.1.csv).
const COMMITTEES_CSV = `\uFEFFID,NOMBRE,GRUPO,PERIODO_DE_INICIO,PERIODO_DE_FINALIZACION,FECHA_DE_INICIO,FECHA_DE_FINALIZACION,TIPO_DE_COMISION
HCDN00014,ESPECIAL ANALISIS DEL SISTEMA POR PEAJE Y FINANC. DE OBRAS VIALES,CD,116,999,01/03/1998,,E
HCDN00045,ASUNTOS CONSTITUCIONALES,CD,116,999,01/03/1998,,P
HCDN00048,PRESUPUESTO Y HACIENDA,CD,116,999,01/03/1998,,P
HCDN00129,"FAMILIA, MUJER, NIÑEZ Y ADOLESCENCIA",CD,120,137,09/05/2002,20/12/2019,P
`;

const MEMBERS_CSV = `COMISION_ID,DIPUTADO_NOMBRE,DISTRITO
HCDN00045,"MAYORAZ, Nicolás",SANTA FE
HCDN00045,"GONZÁLEZ, Diógenes Ignacio",CORRIENTES
HCDN00045,"CASTELNUOVO, Giselle",BUENOS AIRES
HCDN00048,"MAYORAZ, Nicolás",SANTA FE
HCDN00048,FÉRNANDEZ. ELIA MARINA,TUCUMÁN
HCDN00064,"ARABIA, Damián",CABA
`;

const AUTHORITIES_CSV = `COMISION_ID,CARGO,DIPUTADO_NOMBRE,BLOQUE,DISTRITO
HCDN00045,Presidente,MAYORAZ Nicolás,LLA,SANTA FE
HCDN00045,Vicepresidente 2,"GÓNZALEZ, Diógenes",UCR,CORRIENTES
HCDN00045,Secretario,"CASTELNUOVO, Giselle",LLA,BUENOS AIRES
HCDN00064,Presidente,"ARABIA, Damián",LLA,CABA
`;

// Composition rows as the site normalizes them (`nombre` "Apellido, Nombres", `lugar` = DISTRITO).
const DEPUTIES = [
  { id: 'dip-mayoraz', nombre: 'Mayoraz, Nicolás', lugar: 'SANTA FE' },
  { id: 'dip-gonzalez', nombre: 'González, Diógenes Ignacio', lugar: 'CORRIENTES' },
  { id: 'dip-castelnuovo', nombre: 'Castelnuovo, Giselle', lugar: 'BUENOS AIRES' },
  { id: 'dip-arabia', nombre: 'Arabia, Damián', lugar: 'CIUDAD DE BUENOS AIRES' },
];

const realLink = () => {
  const linker = createLinker(DEPUTIES);
  return (rawName: string, distrito: string) => linker.link(rawName, distrito);
};

const matched = (deputyId: string): LinkResult => ({ status: 'matched', deputyId, confidence: 1, candidates: [] });
const unmatched: LinkResult = { status: 'unmatched', deputyId: null, confidence: 0, candidates: [] };

// Links by exact raw name; anything else is unmatched.
const stubLink = (table: Record<string, LinkResult>) => (rawName: string) => table[rawName] ?? unmatched;

const member = (comisionId: string, nombre: string, distrito = 'SANTA FE'): CommitteeRow => ({ comisionId, nombre, distrito, cargo: 'integrante' });

test('parseCommittees maps ID to name and committee type, keeping quoted commas', () => {
  const committees = parseCommittees(COMMITTEES_CSV);
  assert.equal(committees.size, 4);
  assert.deepEqual(committees.get('HCDN00045'), { id: 'HCDN00045', nombre: 'ASUNTOS CONSTITUCIONALES', tipo: 'permanente' });
  assert.deepEqual(committees.get('HCDN00014'), {
    id: 'HCDN00014',
    nombre: 'ESPECIAL ANALISIS DEL SISTEMA POR PEAJE Y FINANC. DE OBRAS VIALES',
    tipo: 'especial',
  });
  assert.equal(committees.get('HCDN00129')?.nombre, 'FAMILIA, MUJER, NIÑEZ Y ADOLESCENCIA');
});

test('parseCommittees leaves tipo undefined for an unknown TIPO_DE_COMISION and skips rows without ID', () => {
  const committees = parseCommittees('ID,NOMBRE,TIPO_DE_COMISION\nHCDN00999,BICAMERAL X,B\n,SIN ID,P\n');
  assert.deepEqual([...committees.keys()], ['HCDN00999']);
  assert.deepEqual(committees.get('HCDN00999'), { id: 'HCDN00999', nombre: 'BICAMERAL X', tipo: undefined });
});

test('parseMembers reads every member as integrante', () => {
  const rows = parseMembers(MEMBERS_CSV);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], { comisionId: 'HCDN00045', nombre: 'MAYORAZ, Nicolás', distrito: 'SANTA FE', cargo: 'integrante' });
  assert.deepEqual(rows[4], { comisionId: 'HCDN00048', nombre: 'FÉRNANDEZ. ELIA MARINA', distrito: 'TUCUMÁN', cargo: 'integrante' });
  assert.ok(rows.every(r => r.cargo === 'integrante'));
});

test('parseMembers skips rows without committee or name', () => {
  assert.deepEqual(parseMembers('COMISION_ID,DIPUTADO_NOMBRE,DISTRITO\n,"X, Y",SALTA\nHCDN00045,,SALTA\n'), []);
});

test('parseAuthorities normalizes the role spellings seen in the file', () => {
  const csv = `COMISION_ID,CARGO,DIPUTADO_NOMBRE,BLOQUE,DISTRITO
HCDN00045,Presidente,A,LLA,SALTA
HCDN00045,Vice Presidente 1,B,LLA,SALTA
HCDN00045,Vicepresidente 1,C,LLA,SALTA
HCDN00045,Vicepresidente 2,D,LLA,SALTA
HCDN00045,Vice Presidente 2,E,LLA,SALTA
HCDN00045,Secretario,F,LLA,SALTA
HCDN00045, VOCAL ,G,LLA,SALTA
HCDN00045,,H,LLA,SALTA
`;
  assert.deepEqual(
    parseAuthorities(csv).map(r => r.cargo),
    ['presidente', 'vicepresidente 1', 'vicepresidente 1', 'vicepresidente 2', 'vicepresidente 2', 'secretario', 'vocal', 'integrante'],
  );
  assert.deepEqual(parseAuthorities(AUTHORITIES_CSV)[0], {
    comisionId: 'HCDN00045',
    nombre: 'MAYORAZ Nicolás',
    distrito: 'SANTA FE',
    cargo: 'presidente',
  });
});

test('canonicalDistrict maps the CABA abbreviation to the composition name and keeps the rest', () => {
  assert.equal(canonicalDistrict('CABA'), 'CIUDAD DE BUENOS AIRES');
  assert.equal(canonicalDistrict(' caba '), 'CIUDAD DE BUENOS AIRES');
  assert.equal(canonicalDistrict('CIUDAD DE BUENOS AIRES'), 'CIUDAD DE BUENOS AIRES');
  assert.equal(canonicalDistrict('TUCUMÁN'), 'TUCUMÁN');
});

test('committeesByDeputy passes the canonical district to the linker', () => {
  const calls: [string, string][] = [];
  committeesByDeputy(new Map(), [member('HCDN00064', 'ARABIA, Damián', 'CABA')], [], (name, distrito) => {
    calls.push([name, distrito]);
    return unmatched;
  });
  assert.deepEqual(calls, [['ARABIA, Damián', 'CIUDAD DE BUENOS AIRES']]);
});

test('committeesByDeputy gives the authority role to the member it links to, whatever the spelling', () => {
  const result = committeesByDeputy(
    parseCommittees(COMMITTEES_CSV),
    parseMembers(MEMBERS_CSV),
    parseAuthorities(AUTHORITIES_CSV),
    realLink(),
  );
  assert.deepEqual(result.byDeputy.get('dip-mayoraz'), [
    { comisionId: 'HCDN00045', comision: 'ASUNTOS CONSTITUCIONALES', cargo: 'presidente' },
    { comisionId: 'HCDN00048', comision: 'PRESUPUESTO Y HACIENDA', cargo: 'integrante' },
  ]);
  // "GÓNZALEZ, Diógenes" drops a given name the composition has; the surname is exact and unique,
  // so the linker accepts the subset and the role reaches the member.
  assert.deepEqual(result.byDeputy.get('dip-gonzalez'), [
    { comisionId: 'HCDN00045', comision: 'ASUNTOS CONSTITUCIONALES', cargo: 'vicepresidente 2' },
  ]);
  assert.deepEqual(result.byDeputy.get('dip-arabia'), [{ comisionId: 'HCDN00064', comision: 'HCDN00064', cargo: 'presidente' }]);
});

test('committeesByDeputy sorts a deputy committees by role importance, then committee name', () => {
  const committees = new Map([
    ['C1', { id: 'C1', nombre: 'TRANSPORTES' }],
    ['C2', { id: 'C2', nombre: 'AGRICULTURA' }],
    ['C3', { id: 'C3', nombre: 'MINERIA' }],
    ['C4', { id: 'C4', nombre: 'ENERGIA' }],
    ['C5', { id: 'C5', nombre: 'DEPORTES' }],
    ['C6', { id: 'C6', nombre: 'CULTURA' }],
    ['C7', { id: 'C7', nombre: 'BANCO' }],
  ]);
  const members = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map(id => member(id, 'X, Y'));
  const authorities: CommitteeRow[] = [
    { ...member('C1', 'X, Y'), cargo: 'secretario' },
    { ...member('C3', 'X, Y'), cargo: 'presidente' },
    { ...member('C4', 'X, Y'), cargo: 'vicepresidente 2' },
    { ...member('C5', 'X, Y'), cargo: 'vicepresidente 1' },
    { ...member('C6', 'X, Y'), cargo: 'vocal' },
  ];
  const result = committeesByDeputy(committees, members, authorities, stubLink({ 'X, Y': matched('dip-x') }));
  assert.deepEqual(
    result.byDeputy.get('dip-x')!.map(c => `${c.cargo}:${c.comision}`),
    [
      'presidente:MINERIA',
      'vicepresidente 1:DEPORTES',
      'vicepresidente 2:ENERGIA',
      'secretario:TRANSPORTES',
      'vocal:CULTURA',
      'integrante:AGRICULTURA',
      'integrante:BANCO',
    ],
  );
});

test('committeesByDeputy keeps the highest role when a deputy has two in one committee', () => {
  const result = committeesByDeputy(
    new Map([['C1', { id: 'C1', nombre: 'TRANSPORTES' }]]),
    [member('C1', 'X, Y')],
    [{ ...member('C1', 'X, Y'), cargo: 'secretario' }, { ...member('C1', 'X Y'), cargo: 'presidente' }],
    stubLink({ 'X, Y': matched('dip-x'), 'X Y': matched('dip-x') }),
  );
  assert.deepEqual(result.byDeputy.get('dip-x'), [{ comisionId: 'C1', comision: 'TRANSPORTES', cargo: 'presidente' }]);
});

test('committeesByDeputy adds a matched authority missing from the member rows', () => {
  const result = committeesByDeputy(
    new Map([['C1', { id: 'C1', nombre: 'TRANSPORTES' }]]),
    [member('C1', 'OTRO, Nombre')],
    [{ ...member('C1', 'X, Y'), cargo: 'presidente' }],
    stubLink({ 'X, Y': matched('dip-x') }),
  );
  assert.deepEqual(result.byDeputy.get('dip-x'), [{ comisionId: 'C1', comision: 'TRANSPORTES', cargo: 'presidente' }]);
  assert.equal(result.committees.get('C1')!.miembros, 1);
});

test('committeesByDeputy leaves names that are not matched out of the per-deputy lists', () => {
  const doubtful: LinkResult = { status: 'doubtful', deputyId: null, confidence: 0.8, candidates: [{ id: 'dip-x', confidence: 0.8 }] };
  const result = committeesByDeputy(
    new Map([['C1', { id: 'C1', nombre: 'TRANSPORTES' }]]),
    [member('C1', 'DUDA, Nombre'), member('C1', 'NADIE, Nombre')],
    [],
    stubLink({ 'DUDA, Nombre': doubtful }),
  );
  assert.equal(result.byDeputy.size, 0);
});

test('committeesByDeputy summarizes each committee: member count and authorities by role', () => {
  const result = committeesByDeputy(
    parseCommittees(COMMITTEES_CSV),
    parseMembers(MEMBERS_CSV),
    parseAuthorities(AUTHORITIES_CSV),
    realLink(),
  );
  assert.deepEqual(result.committees.get('HCDN00045'), {
    id: 'HCDN00045',
    nombre: 'ASUNTOS CONSTITUCIONALES',
    tipo: 'permanente',
    miembros: 3,
    autoridades: [
      { cargo: 'presidente', nombre: 'MAYORAZ Nicolás', distrito: 'SANTA FE', deputyId: 'dip-mayoraz' },
      { cargo: 'vicepresidente 2', nombre: 'GÓNZALEZ, Diógenes', distrito: 'CORRIENTES', deputyId: 'dip-gonzalez' },
      { cargo: 'secretario', nombre: 'CASTELNUOVO, Giselle', distrito: 'BUENOS AIRES', deputyId: 'dip-castelnuovo' },
    ],
  });
  assert.equal(result.committees.get('HCDN00048')!.miembros, 2);
  assert.deepEqual(result.committees.get('HCDN00048')!.autoridades, []);
  // Listed committees without members stay out; committees with members but no listed name keep their id.
  assert.equal(result.committees.has('HCDN00014'), false);
  assert.equal(result.committees.get('HCDN00064')!.nombre, 'HCDN00064');
  assert.equal(result.committees.get('HCDN00064')!.tipo, undefined);
});

test('committeesByDeputy keeps an unlinked authority in its committee with a null deputyId', () => {
  const result = committeesByDeputy(
    new Map([['C1', { id: 'C1', nombre: 'TRANSPORTES' }]]),
    [member('C1', 'NADIE, Nombre')],
    [{ ...member('C1', 'NADIE, Nombre'), cargo: 'presidente' }],
    stubLink({}),
  );
  assert.deepEqual(result.committees.get('C1')!.autoridades, [
    { cargo: 'presidente', nombre: 'NADIE, Nombre', distrito: 'SANTA FE', deputyId: null },
  ]);
});

test('committeesByDeputy counts distinct names by link status and lists the doubtful and unmatched ones', () => {
  const doubtful: LinkResult = { status: 'doubtful', deputyId: null, confidence: 0.8, candidates: [{ id: 'dip-x', confidence: 0.8 }] };
  const result = committeesByDeputy(
    new Map([['C1', { id: 'C1', nombre: 'TRANSPORTES' }], ['C2', { id: 'C2', nombre: 'MINERIA' }]]),
    [
      member('C1', 'X, Y'),
      member('C2', 'X, Y'),
      member('C1', 'DUDA, Nombre', 'SALTA'),
      member('C2', 'Duda,  Nombre', 'SALTA'),
      member('C1', 'NADIE, Nombre', 'JUJUY'),
    ],
    [{ ...member('C1', 'X Y'), cargo: 'presidente' }],
    stubLink({ 'X, Y': matched('dip-x'), 'X Y': matched('dip-x'), 'DUDA, Nombre': doubtful, 'Duda,  Nombre': doubtful }),
  );
  assert.deepEqual(result.quality.names, { matched: 2, doubtful: 1, unmatched: 1, total: 4, percent: 50 });
  assert.deepEqual(result.quality.doubtful, [{ nombre: 'DUDA, Nombre', distrito: 'SALTA', candidates: [{ id: 'dip-x', confidence: 0.8 }] }]);
  assert.deepEqual(result.quality.unmatched, [{ nombre: 'NADIE, Nombre', distrito: 'JUJUY' }]);
  assert.deepEqual(result.quality.rows, { linked: 3, total: 6 });
  assert.deepEqual(result.quality.unknownCommittees, []);
});

test('committeesByDeputy reports committee ids with members but no name in the committees list', () => {
  const result = committeesByDeputy(
    parseCommittees(COMMITTEES_CSV),
    parseMembers(MEMBERS_CSV),
    parseAuthorities(AUTHORITIES_CSV),
    realLink(),
  );
  assert.deepEqual(result.quality.unknownCommittees, ['HCDN00064']);
  assert.deepEqual(result.quality.doubtful.map(d => d.nombre), []);
  // FÉRNANDEZ. ELIA MARINA is not in the trimmed composition.
  assert.deepEqual(result.quality.unmatched, [{ nombre: 'FÉRNANDEZ. ELIA MARINA', distrito: 'TUCUMÁN' }]);
});
