import test from 'node:test';
import assert from 'node:assert/strict';
import type { LinkResult } from './linkage.ts';
import {
  billsByAuthor,
  effectiveStage,
  furthestStages,
  parseBills,
  STAGES,
  stageOf,
  type Bill,
  type Stage,
} from './proyectos.ts';

// Trimmed rows from proyectos_parlamentarios2.6.csv (HCDN CKAN, 2026-10-07).
const BILLS_CSV = [
  'PROYECTO_ID,TITULO,PUBLICACION_FECHA,PUBLICACION_ID,CAMARA_ORIGEN,EXP_DIPUTADOS,EXP_SENADO,TIPO,AUTOR',
  'HCDN295209,"Expresar reconocimiento a las y los deportistas argentinos que participaron en los XIII Juegos Suramericanos 2026, REALIZADOS Del 12 Al 26 de septiembre en las ciudad de Rosario, provincia de Santa Fe.",2026-10-06T00:00:00,HCDN144TP150,Diputados,5348-D-2026,,RESOLUCION,"ROSSI, AGUSTIN OSCAR"',
  'HCDN295215,EXPRESAR BENEPLÁCITO POR LOS 50 AÑOS DE LA CREACIÓN DE LA ORGANIZACIÓN FAMILIARES DE DESAPARECIDOS Y DETENIDOS POR RAZONES POLITICAS.,2026-10-06T00:00:00,HCDN144TP150,Diputados,5344-D-2026,,DECLARACION,"PIETRAGALLA CORTI, HORACIO"',
  'HCDN293593,"DECLARAR A LA CIUDAD AUTONOMA DE BUENOS AIRES ""CAPITAL NACIONAL DEL TEATRO"".",2026-08-07T00:00:00,HCDN144TP108,Diputados,3778-D-2026,0010-CD-2026,LEY,"GIAMPIERI, ANTONELA"',
  'HCDN291414,APROBACION DEL ACUERDO DE CONCILIACION CON BAINBRIDGE LTD. Y EL GRUPO DE ACREEDORES ENCABEZADO POR ATTESTOR VALUE MASTER FUND LP.,2026-04-20T00:00:00,,Senado,0020-S-2026,0098-PE-2026,MENSAJE Y PROYECTO DE LEY,"MILEI, JAVIER GERARDO"',
  'HCDN170001,PROYECTO VIEJO FUERA DE LA VENTANA,2023-12-31T00:00:00,HCDN141TP190,Diputados,7000-D-2023,,LEY,"ROSSI, AGUSTIN OSCAR"',
].join('\n');

// Trimmed rows from movimientos_proyectos3.1.csv; HCDN293593's moves are real, the rest are real
// MOVIMIENTO values attached to fixture ids.
const MOVES_CSV = [
  'PROYECTO_ID,FECHA,MOVIMIENTO,ORDEN',
  'HCDN295215,,,',
  'HCDN293593,,RESOLUCION PRESIDENCIA - SE SUPRIME EL GIRO A LA COMISION DE CULTURA,1',
  'HCDN293593,2026-08-26T00:00:00,CITACION SESION ESPECIAL,2',
  'HCDN293593,2026-08-26T00:00:00,CONSIDERACION Y APROBACION,3',
  'HCDN293593,,PASA A SENADO -,4',
  'HCDN295209,,RESOLUCION PRESIDENCIA - AMPLIACION DE GIRO A LA COMISION DE PRESUPUESTO Y HACIENDA,1',
  'HCDN295209,,CONSIDERACION Y RECHAZO (DEL DICTAMEN DE MAYORIA),2',
  'HCDN295209,,SOLICITUD DE SER COFIRMANTE DEL DIPUTADO CASTAGNETO (A SUS ANTECEDENTES),3',
  'HCDN291414,,PASA A DIPUTADOS -,4',
  'HCDN291414,2026-06-24T00:00:00,CITACION SESION ESPECIAL,5',
  'HCDN291414,2026-06-24T00:00:00,CONSIDERACION Y SANCION,6',
  'HCDN170001,,CONSIDERACION Y SANCION,1',
].join('\n');

const SINCE = { since: '2024-01-01' };

test('parseBills maps the CSV columns and keeps only bills published since the window start', () => {
  const bills = parseBills(BILLS_CSV, SINCE);
  assert.deepEqual(bills.map(b => b.id), ['HCDN295209', 'HCDN295215', 'HCDN293593', 'HCDN291414']);
  assert.deepEqual(bills[2], {
    id: 'HCDN293593',
    titulo: 'DECLARAR A LA CIUDAD AUTONOMA DE BUENOS AIRES "CAPITAL NACIONAL DEL TEATRO".',
    fecha: '2026-08-07',
    camaraOrigen: 'Diputados',
    expediente: '3778-D-2026',
    tipo: 'LEY',
    autor: 'GIAMPIERI, ANTONELA',
  });
});

test('parseBills includes the window start day and uses the Senate number for Senate-origin bills', () => {
  const csv = BILLS_CSV.replace('2023-12-31T00:00:00', '2024-01-01T00:00:00');
  const bills = parseBills(csv, SINCE);
  assert.ok(bills.some(b => b.id === 'HCDN170001' && b.fecha === '2024-01-01'));
  assert.equal(bills.find(b => b.id === 'HCDN291414')?.expediente, '0098-PE-2026');
});

test('STAGES lists the ordered stages', () => {
  assert.deepEqual(STAGES, ['presentado', 'en comisión', 'con dictamen', 'media sanción', 'sancionado']);
});

test('stageOf maps real MOVIMIENTO values to stages', () => {
  const cases: [string, Stage | null][] = [
    ['RESOLUCION PRESIDENCIA - AMPLIACION DE GIRO A LA COMISION DE PRESUPUESTO Y HACIENDA', 'en comisión'],
    ['CAMBIO DE GIRO POR SOLICITUD DE UNIFICACION DE GIRO', 'en comisión'],
    ['MOCION DE EMPLAZAMIENTO A LA COMISION - ARTICULO 106 REGLAMENTO (AFIRMATIVA)', 'en comisión'],
    ['CONSIDERACION Y RECHAZO (DEL DICTAMEN DE MAYORIA)', 'con dictamen'],
    ['COMUNICACION DEL DICTAMEN', 'con dictamen'],
    ['CONSIDERACION Y APROBACION', 'media sanción'],
    ['CONSIDERACION Y APROBACION CON MODIFICACIONES (DEL SEGUNDO DICTAMEN DE MINORIA)', 'media sanción'],
    ['APROBACION ARTICULO 114 DEL REGLAMENTO DE LA H CAMARA DE DIPUTADOS; COMUNICADO EL 07/10/2025', 'media sanción'],
    ['APROBACION ARTICULO 106, PARRAFO 3 DEL REGLAMENTO DEL H SENADO', 'media sanción'],
    ['PASA A SENADO -', 'media sanción'],
    ['PASA A DIPUTADOS - 0022-S-2025', 'media sanción'],
    ['CONSIDERACION Y SANCION', 'sancionado'],
    ['TEXTO SANCION DEFINITIVA', 'sancionado'],
    ['CONSIDERACION Y RECHAZO DE LA INSISTENCIA (NO ALCANZA MAYORIA NECESARIA PARA INSISTIR - ACEPTA VETO)', 'sancionado'],
  ];
  for (const [movimiento, stage] of cases) assert.equal(stageOf(movimiento), stage, movimiento);
});

test('stageOf returns null for moves that do not show progress, and for unknown values', () => {
  for (const movimiento of [
    '',
    'CITACION SESION ESPECIAL',
    'SOLICITUD DE SER COFIRMANTE DE LA DIPUTADA IANNI (A SUS ANTECEDENTES)',
    'MOCION DE PREFERENCIA PARA LA PROXIMA SESION CON DICTAMEN (AFIRMATIVA)',
    'MOCION SOBRE TABLAS (NEGATIVA)',
    'CONSIDERACION Y APROBACION (AL ARCHIVO)',
    'SOLICITUD DEL AUTOR DE RETIRO DEL PROYECTO',
    'ALGO QUE NUNCA SE VIO',
  ]) {
    assert.equal(stageOf(movimiento), null, movimiento);
  }
});

test('furthestStages keeps the furthest stage per bill, only for the requested ids, default presentado', () => {
  const ids = new Set(['HCDN295209', 'HCDN295215', 'HCDN293593', 'HCDN291414', 'HCDN999999']);
  const stages = furthestStages(MOVES_CSV, ids);
  assert.deepEqual(Object.fromEntries(stages), {
    // giro + dictamen ends at con dictamen; the later cofirmante move does not move it back
    HCDN295209: 'con dictamen',
    // only an empty placeholder row
    HCDN295215: 'presentado',
    HCDN293593: 'media sanción',
    HCDN291414: 'sancionado',
    // no rows at all
    HCDN999999: 'presentado',
  });
  assert.equal(stages.has('HCDN170001'), false);
});

test('effectiveStage makes a chamber approval final for resolutions and declarations only', () => {
  assert.equal(effectiveStage('media sanción', 'RESOLUCION'), 'sancionado');
  assert.equal(effectiveStage('media sanción', 'DECLARACION'), 'sancionado');
  assert.equal(effectiveStage('media sanción', 'LEY'), 'media sanción');
  assert.equal(effectiveStage('media sanción', 'MENSAJE Y PROYECTO DE LEY'), 'media sanción');
  assert.equal(effectiveStage('con dictamen', 'RESOLUCION'), 'con dictamen');
});

const bill = (id: string, fecha: string, tipo: string, autor: string): Bill => ({
  id, titulo: `Proyecto ${id}`, fecha, camaraOrigen: 'Diputados', expediente: `${id}-D-2025`, tipo, autor,
});

const result = (status: LinkResult['status'], deputyId: string | null = null): LinkResult => ({
  status, deputyId, confidence: status === 'unmatched' ? 0 : 0.95, candidates: status === 'doubtful' ? [{ id: 'x', confidence: 0.8 }] : [],
});

const LINKS: Record<string, LinkResult> = {
  'PAULON, ESTEBAN': result('matched', 'paulon'),
  'RUIZ, YAMILA': result('matched', 'ruiz'),
  'AGUIRRE, X': result('doubtful'),
  'H CAMARA DE DIPUTADOS': result('unmatched'),
};
const linkFn = (autor: string) => LINKS[autor];

test('billsByAuthor counts bills by tipo and stage funnel per linked legislator', () => {
  const bills = [
    bill('1', '2025-01-10', 'LEY', 'PAULON, ESTEBAN'),
    bill('2', '2025-02-10', 'LEY', 'PAULON, ESTEBAN'),
    bill('3', '2025-03-10', 'DECLARACION', 'PAULON, ESTEBAN'),
    bill('4', '2025-04-10', 'RESOLUCION', 'RUIZ, YAMILA'),
  ];
  const stages = new Map<string, Stage>([['1', 'media sanción'], ['2', 'en comisión'], ['3', 'media sanción']]);
  const { byLegislator } = billsByAuthor(bills, stages, linkFn);
  const paulon = byLegislator.get('paulon')!;
  assert.equal(paulon.total, 3);
  assert.deepEqual(paulon.byTipo, { LEY: 2, DECLARACION: 1 });
  assert.deepEqual(paulon.stages, {
    presentado: 0, 'en comisión': 1, 'con dictamen': 0, 'media sanción': 1, sancionado: 1,
  });
  // a bill missing from the stages map counts as presentado
  assert.deepEqual(byLegislator.get('ruiz')!.stages, {
    presentado: 1, 'en comisión': 0, 'con dictamen': 0, 'media sanción': 0, sancionado: 0,
  });
});

test('billsByAuthor lists the 5 most recent bills of each legislator, newest first', () => {
  const bills = ['2024-05-01', '2026-01-02', '2025-07-03', '2024-01-04', '2026-03-05', '2025-02-06'].map((fecha, i) =>
    bill(String(i), fecha, 'LEY', 'PAULON, ESTEBAN'),
  );
  const stages = new Map<string, Stage>([['4', 'sancionado']]);
  const recent = billsByAuthor(bills, stages, linkFn).byLegislator.get('paulon')!.recent;
  assert.deepEqual(recent.map(r => r.fecha), ['2026-03-05', '2026-01-02', '2025-07-03', '2025-02-06', '2024-05-01']);
  assert.deepEqual(recent[0], { titulo: 'Proyecto 4', fecha: '2026-03-05', tipo: 'LEY', expediente: '4-D-2025', stage: 'sancionado' });
});

test('billsByAuthor reports linkage quality over distinct author names and leaves unlinked bills out', () => {
  const bills = [
    bill('1', '2025-01-10', 'LEY', 'PAULON, ESTEBAN'),
    bill('2', '2025-01-11', 'LEY', 'Paulón,  Esteban'),
    bill('3', '2025-01-12', 'LEY', 'AGUIRRE, X'),
    bill('4', '2025-01-13', 'RESOLUCION', 'H CAMARA DE DIPUTADOS'),
    bill('5', '2025-01-14', 'RESOLUCION', 'H CAMARA DE DIPUTADOS'),
  ];
  const links = (autor: string) => LINKS[autor] ?? LINKS['PAULON, ESTEBAN'];
  const { byLegislator, quality } = billsByAuthor(bills, new Map(), links);
  assert.deepEqual([...byLegislator.keys()], ['paulon']);
  assert.equal(byLegislator.get('paulon')!.total, 2);
  assert.deepEqual(quality, {
    matched: 1,
    doubtful: 1,
    unmatched: 1,
    total: 3,
    bills: { linked: 2, total: 5 },
    doubtfulNames: ['AGUIRRE, X'],
    unmatchedNames: ['H CAMARA DE DIPUTADOS'],
  });
});

test('billsByAuthor strips DIP./SEN. prefixes before linking and passes the bill to the link function', () => {
  const seen: [string, string][] = [];
  const bills = [bill('1', '2025-01-10', 'LEY', 'DIP. PAULON, ESTEBAN'), { ...bill('2', '2025-01-11', 'LEY', 'SEN. RUIZ, YAMILA'), camaraOrigen: 'Senado' }];
  billsByAuthor(bills, new Map(), (autor, b) => {
    seen.push([autor, b.camaraOrigen]);
    return LINKS[autor];
  });
  assert.deepEqual(seen, [['PAULON, ESTEBAN', 'Diputados'], ['RUIZ, YAMILA', 'Senado']]);
});
