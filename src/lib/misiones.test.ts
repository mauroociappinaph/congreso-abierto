import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from './legislators.ts';
import type { LinkResult } from './linkage.ts';
import { normalizeMissionRows, summarizeMissions, type Mission } from './misiones.ts';

// Real rows from HCDN CKAN `misiones-oficiales`, trimmed to the lines each rule needs.
const CSV_2026_1S = `FECHA_INICIO,FECHA_FIN,MOTIVO,INSTITUCION_QUE_INVITA,LUGAR,PARTICIPA,VIATICOS_OTORGADOS_DIAS_Y_MONTO_SEGUN_R_P_N_1164_12,MONEDA,VIATICOS_CONSUMIDOS,BLOQUE
2026-01-23,2026-01-27,ENCUENTRO INTERNACIONAL: NUESTRA AMERICA,SENADORA LOPEZ OBREGON CLARA,"BOGOTA, COLOMBIA",DIP. TAIANA JORGE,1 DIA - U$S,U$S,-,UXP
2026-3-9,2026-3-16,FORTALECIMIENTO DE LA COOPERACION PARLAMENTARIA INTERNACIONAL Y EL INTERCAMBIO DE EXPERIENCIAS EN MATERIA DE POLITICAS PUBLICAS,GLOBAL PARLIAMENTARY NETWORK,"PARIS, FRANCIA.",DIP. LAUMANN ANDRES ARIEL,-,U$S,-,LLA
2026-4-11,2026-4-18,INTERCAMBIAR CONOCIMIENTOS Y PRACTICAS EN MATERIA DE POLITICAS PUBLICA,"HON. SVEN CLEMENT, DIPUTADO, LUXEMBURGO PRESIDENTE DE LA RED PARLAMENTARIA","WASHINGTON D.C., ESTADOS UNIDOS",DIP. SABRINA AJMECHET,3 DIAS - U$S 354,U$S,1062,LLA
`;

const CSV_2025_2S = `fecha_inicio,fecha_fin,motivo,institucion_que_invita,lugar,participa,viaticos_otorgados_dias_y_monto_segun_r_p_n_1164_12,moneda,viaticos_consumidos,bloque
2025-10-05T00:00:00Z,2025-10-06T00:00:00Z,"PARTICIPACION DE LA I SESION EXTRAORDINARIA Y LA CIII SESION ORDINARIA DEL PARLAMENTO DEL MERCOSUR, EN SU CALIDAD DE PRESIDENTE DE LA COMISION DEL MERCOSUR DE ESTA H. CAMARA",PARLAMENTO DEL MERCOSUR,"MONTEVIDEO, URUGUAY.",DIP. VALDES EDUARDO FELIX,2 DIAS - U$S 253,U$S,506,UNION POR LA PATRIA
2026-01-04T00:00:00Z,2026-01-14T00:00:00Z,"IMPULSAR EL INTERCAMBIO PARLAMENTARIO, FORTALECIENDO LA COOPERACION ENTRE CHINA Y ARGENTINA",EMBAJADA DE LA REPUBLICA POPULAR CHINA EN LA REPUBLICA ARGENTINA,"BEIJING Y SHENZHEN, CHINA",DELEGACION ENCABEZADA POR LA DIPUTADA NACIONAL JULIANA SANTILLAN,-,U$S,-,LA LIBERTAD AVANZA - PRO
2025-11-02T00:00:00Z,2025-11-06T00:00:00Z,MOTIVO,Delegacion de la Union Europea,"ROMA, ITALIA Y BRUSELAS, BELGICA",DIP. VERONICA KARINA BANFI.,-,U$S,-,UCR
`;

const CSV_2025_1S = `"fecha_inicio","fecha_fin","motivo","institucion_que_invita","lugar","participa","viaticos_otorgados_dias_y_monto_segun_r_p_n_1164_12","moneda","viaticos_consumidos","bloque"
2025-02-06,2025-02-11,"PARTICIPACIÓN EN EL PROGRAMA DE OBSERVACIÓN ELECTORAL 2025","CONSEJO NACIONAL ELECTORAL DE LA REPÚBLICA DEL ECUADOR","QUITO, REPÚBLICA DEL ECUADOR","POKOIK GARCÍA LORENA IRIS","3 DIAS - U$S324","U$S","0","UNIÓN POR LA PATRIA"
2025-03-01,2025-03-05,"12° SESIÓN PLENARIA DEL PARLAMENTO INTERNACIONAL POR LA TOLERANCIA Y LA PAZ","CONSEJO GLOBAL PARA LA TOLERANCIA Y LA PAZ","GINEBRA, CONFEDERACIÓN SUIZA","ALLENDE, WALBERTO ENRIQUE","-","-","-","UNIÓN POR LA PATRIA"
`;

const CSV_2024 = `"fecha_inicio","fecha_fin","motivo","institucion_que_invita","lugar","participa","viaticos_otorgados_dias_y_monto_segun_r_p_n_1164_12","moneda","viaticos_consumidos","bloque"
"2024-03-11","2024-03-16","INTEGRAR LA DELEGACIÓN PARLAMENTARIA DE PARLAMÉRICAS, PARA MANTENER REUNIONES DE ALTO NIVEL Y DIÁLOGO","PARLAMÉRICAS","WASHINGTON, ESTADOS UNIDOS DE AMÉRICA","MARGARITA, STOLBIZER",NA,NA,NA,"HACEMOS COALICIÓN FEDERAL"
"2024-07-28","2024-08-04","SEMINARIO DE SISTEMAS DE SALUD E INTRODUCCIÓN A INSTITUCIONES DE EXCELENCIA DE LOS ESTADOS UNIDOS.-","DEVELOPMENT OUTCOMES ORGANIZATION (DOO) Y CONSENSO SALUD","WASHINGTON D.C., ESTADOS UNIDOS DE AMÉRICA","YEDLIN,PABLO",,,,"UNION POR LA PATRIA"
`;

const CSV_2023 = `FECHA INICIO,FECHA FIN,MOTIVO,INSTITUCION QUE INVITA,LUGAR,PARTICIPA,"VIATICOS OTORGADOS, (dias y monto según decreto N° 280/95)",MONEDA,VÍATICOS CONSUMIDOS,BLOQUE
2023-02-07,2023-02-14,Participar de una comitiva de observancia de los Derechos Humanos  a realizarse en la República del Perú,Congresista de la  República del Perú ,Lima  República del Perú,MARINO  JUAN,3 DIAS - U$S 282,U$S,U$S 846,Frente de Todos
`;

const CSV_2022_1S = `FECHA_INICIO,FECHA_FIN,MOTIVO,INSTITUCION QUE INVITA,LUGAR,PARTICIPA,MONEDA,VIATICOS OTORGADOS,VIATICOS CONSUMIDOS,BLOQUE
25/01/2022,08/02/2022,"INTEGRANTE DE LA COMITIVA",MISIONES OFICIALES DE PRESIDENCIA Y VICEPRESIDENCIA DE LA NACIÓN,"REPÚBLICA DE HONDURAS  FEDERACIÓN DE RUSIA  REPÚBLICA POPULAR CHINABARBADOS","VALDES, EDUARDO FELIX",U$S,"  * 5 DÍAS - U$S 255* 2 DÍAS - U$S 543   * 3 DÍAS - U$S 377",$ 3492.0.00,FRENTE DE TODOS
29/05/2022,08/06/2022,PARTICIPACIÓN EN LA 110° CONFERENCIA INTERNACIONAL DEL TRABAJO DE LA OIT,DR. CLAUDIO O. MORONI  MINISTRO DE TRABAJO  EMPLEO Y SEGURIDAD SOCIAL,GINEBRA  CONFEDERACIÓN SUIZA,SELVA CARLOS AMERICO,U$S,"5 DIAS - U$S 334,00"," $ 1.002,00",FRENTE DE TODOS
`;

const CSV_2022_2S = `FECHA INICIO,FECHA FIN,MOTIVO,INSTITUCION QUE INVITA,LUGAR,PARTICIPA,"VIATICOS OTORGADOS (días y monto según Decreto N° 280/95) ",MONEDA,"VIATICOS CONSUMIDOS",BLOQUE
05/07/2022,05/07/2022,"FORO INTERNACIONAL DE INTELIGENCIA Y SEGURIDAD",PRESIDENTE DE LA CÁMARA DE DIPUTADOS DE RUMANIA,"BUCAREST, REINO DE RUMANIA - MADRID, REINO DE ESPAÑA","REY, MARIA LUJAN","3 DIAS - U$S 478,00",U$S," 1.434,00",PRO
04/09/2022,07/09/2022,REUNIÓN DE LA COMISIÓN DE MEDIO AMBIENTE Y TURISMO DEL PARLAMENTO LATINOAMERICANO Y CARIBEÑO,"SECRETARIO DE COMISIONES DEL PARLAMENTO LATINOAMERICANO Y CARIBEÑO, SENADOR D. RICARDO VELAZQUEZ","JOÀO PESSOA, REPÚBLICA FEDERATIVA DE BRASIL","CAMAÑO, GRACIELA",3 DIAS - U$S 359 ,U$S,1077.00,IDENTIDAD BONAERENSE
`;

const CSV_2021_2S = `fecha_inicio,fecha_fin,motivo,institucion_que_invita,ciudad/pais,diputado_nombre,viaticos_otorgados,viaticos_consumidos,diputado_bloque
01/07/2021,31/07/2021,"NO SE REALIZARON VIAJES EN EL MES DE JULIO ",S/N,S/N,S/N,S/N,S/N,S/N
29/09/2021,04/10/2021,A FIN DE PARTICIPAR EN THE NORMANDY WORLD PEACE FORUM,OPEN DIPLOMACY INSTITUTE,"CAEN, REPÚBLICA FRANCESA","IGLESIAS, FERNANDO ADOLFO",NO,NO,PRO
05/10/2021,11/10/2021,MOTIVO,INSTITUCION,"CIUDAD, PAIS","CAMAÑO, GRACIELA",3  DIAS - U$S 394,U$S 1182,CONSENSO FEDERAL
`;

const CSV_2020_2S = `fecha_inicio,fecha_fin,motivo,institucion_que_invita,ciudad-pais,diputado_nombre,viaticos_otorgados,viaticos_consumidos,diputado_bloque
01/07/2020,31/07/2020,"NO SE REALIZARON VIAJES EN EL MES DE JULIO ",,,,,,
01/09/2020,31/09/2020,MOTIVO,INSTITUCION,"CIUDAD, PAIS","GROSSO, LEONARDO",3  DIAS - U$S  229,U$S 687,FRENTE DE TODOS
16/10/2022,22/10/20200,MOTIVO,INSTITUCION,"CIUDAD, PAIS","FAGIOLI, FEDERICO",5  DIAS - U$S 232,U$S 1160,FRENTE DE TODOS
`;

const CSV_2019 = `viaje_desc,Insituticion_que_invita,fecha_inicio_viaje,fecha_fin_viaje,pais_destino_id,pais_destino_nombre,ciudad_viaje,diputado_id,diputado_nombre,bloque_id,bloque_nombre,dias_viaticos_otorgados,moneda_viaticos_otorgados_id,monto_viaticos_otorgados,moneda_viaticos_consumidos_id,monto_viaticos_consumidos
A FIN DE PARTICIPAR DE LA MISION INVERSA A LA REPUBLICA FRANCESA,ASAMBLEA NACIONAL DE LA REPUBLICA FRANCESA,4/2/2019,15/2/2019,FRA,FRANCIA,PARÍS,HCDN02371,CRESTO MAYDA,HCDN00001,JUSTICIALISTA,3,USD,1206,USD,1206
A FIN DE PARTICIPAR DEL EVENTO MOBILE WORLD CONGRESS 2019 BARCELONA (MWC19),INVITADO POR LOS ORGANIZADORES DEL EVENTO,22/2/2019,27/2/2019,ESP,ESPAÑA,BARCELONA,HCDN01450,BOSSIO DIEGO LUIS,HCDN00001,JUSTICIALISTA,NO,NO,NO,NO,NO
`;

const CSV_2018 = `viaje_desc,Insituticion_que_invita,fecha_inicio_viaje,fecha_fin_viaje,pais_destino_id,pais_destino_nombre,ciudad_viaje,diputado_id,diputado_nombre,bloque_id,bloque_nombre,viaticos_cantidad,moneda_id,monto_total_viaticos
MOTIVO,INSTITUCION,8/1/2018,11/1/2018,ESP,ESPAÃ‘A,MADRID,HCDN01250,"BRÃœGGE, JUAN FERNANDO",HCDN00178,CORDOBA FEDERAL,3,USD,1062
`;

const parse = (csv: string) => normalizeMissionRows(parseCsv(csv));

test('upper-case snake headers (2026-1S): Y-M-D dates without padding, DIP. prefix, "1 DIA - U$S" and "-" give null', () => {
  const [taiana, laumann, ajmechet] = parse(CSV_2026_1S);
  assert.deepEqual(taiana, {
    fechaInicio: '2026-01-23',
    fechaFin: '2026-01-27',
    motivo: 'ENCUENTRO INTERNACIONAL: NUESTRA AMERICA',
    institucion: 'SENADORA LOPEZ OBREGON CLARA',
    lugar: 'BOGOTA, COLOMBIA',
    participante: 'TAIANA JORGE',
    bloque: 'UXP',
    viaticosDias: 1,
    viaticosOtorgados: null,
    viaticosConsumidos: null,
  });
  assert.equal(laumann.fechaInicio, '2026-03-09');
  assert.equal(laumann.fechaFin, '2026-03-16');
  assert.equal(laumann.lugar, 'PARIS, FRANCIA');
  assert.equal(laumann.viaticosDias, null);
  assert.equal(laumann.viaticosOtorgados, null);
  assert.equal(ajmechet.participante, 'SABRINA AJMECHET');
  assert.deepEqual(ajmechet.viaticosOtorgados, { amount: 1062, currency: 'USD' });
  assert.deepEqual(ajmechet.viaticosConsumidos, { amount: 1062, currency: 'USD' });
});

test('lower-case snake headers (2025-2S): ISO timestamps and "DELEGACION ENCABEZADA POR LA DIPUTADA NACIONAL" prefix', () => {
  const [valdes, santillan, banfi] = parse(CSV_2025_2S);
  assert.equal(valdes.fechaInicio, '2025-10-05');
  assert.equal(valdes.fechaFin, '2025-10-06');
  assert.equal(valdes.participante, 'VALDES EDUARDO FELIX');
  assert.equal(valdes.institucion, 'PARLAMENTO DEL MERCOSUR');
  assert.equal(valdes.bloque, 'UNION POR LA PATRIA');
  assert.deepEqual(valdes.viaticosOtorgados, { amount: 506, currency: 'USD' });
  assert.deepEqual(valdes.viaticosConsumidos, { amount: 506, currency: 'USD' });
  assert.equal(santillan.participante, 'JULIANA SANTILLAN');
  assert.equal(banfi.participante, 'VERONICA KARINA BANFI');
});

test('quoted snake headers (2025-1S): "U$S324" without space, consumed "0" is a real zero, "-" currency gives null', () => {
  const [pokoik, allende] = parse(CSV_2025_1S);
  assert.equal(pokoik.participante, 'POKOIK GARCÍA LORENA IRIS');
  assert.equal(pokoik.viaticosDias, 3);
  assert.deepEqual(pokoik.viaticosOtorgados, { amount: 972, currency: 'USD' });
  assert.deepEqual(pokoik.viaticosConsumidos, { amount: 0, currency: 'USD' });
  assert.equal(allende.viaticosOtorgados, null);
  assert.equal(allende.viaticosConsumidos, null);
});

test('2024 files: NA and empty viáticos give null; the name is kept as published', () => {
  const [stolbizer, yedlin] = parse(CSV_2024);
  assert.equal(stolbizer.participante, 'MARGARITA, STOLBIZER');
  assert.equal(stolbizer.viaticosDias, null);
  assert.equal(stolbizer.viaticosOtorgados, null);
  assert.equal(stolbizer.viaticosConsumidos, null);
  assert.equal(yedlin.participante, 'YEDLIN,PABLO');
  assert.equal(yedlin.viaticosOtorgados, null);
  assert.equal(yedlin.viaticosConsumidos, null);
});

test('spaced headers with accents (2023): currency inside the consumed value, repeated spaces collapsed', () => {
  const [marino] = parse(CSV_2023);
  assert.equal(marino.fechaInicio, '2023-02-07');
  assert.equal(marino.participante, 'MARINO JUAN');
  assert.equal(marino.institucion, 'Congresista de la República del Perú');
  assert.equal(marino.lugar, 'Lima República del Perú');
  assert.equal(marino.bloque, 'Frente de Todos');
  assert.deepEqual(marino.viaticosOtorgados, { amount: 846, currency: 'USD' });
  assert.deepEqual(marino.viaticosConsumidos, { amount: 846, currency: 'USD' });
});

test('2022-1S: DD/MM/YYYY dates, several day blocks summed, MONEDA wins over a bare "$", malformed amount gives null', () => {
  const [valdes, selva] = parse(CSV_2022_1S);
  assert.equal(valdes.fechaInicio, '2022-01-25');
  assert.equal(valdes.fechaFin, '2022-02-08');
  assert.equal(valdes.viaticosDias, 10);
  assert.deepEqual(valdes.viaticosOtorgados, { amount: 5 * 255 + 2 * 543 + 3 * 377, currency: 'USD' });
  assert.equal(valdes.viaticosConsumidos, null);
  assert.deepEqual(selva.viaticosOtorgados, { amount: 1670, currency: 'USD' });
  assert.deepEqual(selva.viaticosConsumidos, { amount: 1002, currency: 'USD' });
});

test('2022-2S: Argentine thousands ("1.434,00") and decimal point ("1077.00") amounts', () => {
  const [rey, camano] = parse(CSV_2022_2S);
  assert.deepEqual(rey.viaticosOtorgados, { amount: 1434, currency: 'USD' });
  assert.deepEqual(rey.viaticosConsumidos, { amount: 1434, currency: 'USD' });
  assert.deepEqual(camano.viaticosOtorgados, { amount: 1077, currency: 'USD' });
  assert.deepEqual(camano.viaticosConsumidos, { amount: 1077, currency: 'USD' });
});

test('2020-2021 headers (ciudad/pais, diputado_nombre, diputado_bloque): placeholder rows dropped, "NO" gives null', () => {
  const rows = parse(CSV_2021_2S);
  assert.equal(rows.length, 2);
  const [iglesias, camano] = rows;
  assert.equal(iglesias.participante, 'IGLESIAS, FERNANDO ADOLFO');
  assert.equal(iglesias.lugar, 'CAEN, REPÚBLICA FRANCESA');
  assert.equal(iglesias.bloque, 'PRO');
  assert.equal(iglesias.viaticosOtorgados, null);
  assert.equal(iglesias.viaticosConsumidos, null);
  assert.deepEqual(camano.viaticosOtorgados, { amount: 1182, currency: 'USD' });
  assert.deepEqual(camano.viaticosConsumidos, { amount: 1182, currency: 'USD' });
});

test('impossible dates give null instead of a shifted date', () => {
  const rows = parse(CSV_2020_2S);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fechaInicio, '2020-09-01');
  assert.equal(rows[0].fechaFin, null);
  assert.equal(rows[1].fechaInicio, '2022-10-16');
  assert.equal(rows[1].fechaFin, null);
});

test('2019 headers: separate days, currency and total columns; city and country joined; "NO" gives null', () => {
  const [cresto, bossio] = parse(CSV_2019);
  assert.deepEqual(cresto, {
    fechaInicio: '2019-02-04',
    fechaFin: '2019-02-15',
    motivo: 'A FIN DE PARTICIPAR DE LA MISION INVERSA A LA REPUBLICA FRANCESA',
    institucion: 'ASAMBLEA NACIONAL DE LA REPUBLICA FRANCESA',
    lugar: 'PARÍS, FRANCIA',
    participante: 'CRESTO MAYDA',
    bloque: 'JUSTICIALISTA',
    viaticosDias: 3,
    viaticosOtorgados: { amount: 1206, currency: 'USD' },
    viaticosConsumidos: { amount: 1206, currency: 'USD' },
  });
  assert.equal(bossio.viaticosDias, null);
  assert.equal(bossio.viaticosOtorgados, null);
  assert.equal(bossio.viaticosConsumidos, null);
});

test('2015-2018 headers (viaticos_cantidad, moneda_id, monto_total_viaticos): mojibake repaired, total is the granted amount', () => {
  const [brugge] = parse(CSV_2018);
  assert.equal(brugge.participante, 'BRÜGGE, JUAN FERNANDO');
  assert.equal(brugge.lugar, 'MADRID, ESPAÑA');
  assert.equal(brugge.viaticosDias, 3);
  assert.deepEqual(brugge.viaticosOtorgados, { amount: 1062, currency: 'USD' });
  assert.equal(brugge.viaticosConsumidos, null);
});

const mission = (over: Partial<Mission>): Mission => ({
  fechaInicio: null,
  fechaFin: null,
  motivo: '',
  institucion: '',
  lugar: '',
  participante: '',
  bloque: '',
  viaticosDias: null,
  viaticosOtorgados: null,
  viaticosConsumidos: null,
  ...over,
});

const results: Record<string, LinkResult> = {
  'VALDES EDUARDO FELIX': { status: 'matched', deputyId: 'dip-valdes', confidence: 0.98, candidates: [] },
  'VALDES, EDUARDO FELIX': { status: 'matched', deputyId: 'dip-valdes', confidence: 0.99, candidates: [] },
  'YEDLIN,PABLO': { status: 'matched', deputyId: 'dip-yedlin', confidence: 0.95, candidates: [] },
  'JULIANA SANTILLAN': {
    status: 'doubtful', deputyId: null, confidence: 0.8,
    candidates: [{ id: 'dip-santillan', confidence: 0.8 }],
  },
};
const unmatched: LinkResult = { status: 'unmatched', deputyId: null, confidence: 0, candidates: [] };
const linkFn = (name: string) => results[name] ?? unmatched;

const missions: Mission[] = [
  mission({
    participante: 'VALDES EDUARDO FELIX', fechaInicio: '2025-10-05', lugar: 'MONTEVIDEO, URUGUAY', institucion: 'PARLAMENTO DEL MERCOSUR',
    viaticosOtorgados: { amount: 506, currency: 'USD' }, viaticosConsumidos: { amount: 506, currency: 'USD' },
  }),
  mission({
    participante: 'VALDES, EDUARDO FELIX', fechaInicio: '2024-12-02', lugar: 'BRASILIA, BRASIL', institucion: 'PARLAMENTO DEL MERCOSUR',
    viaticosOtorgados: { amount: 1077, currency: 'USD' }, viaticosConsumidos: null,
  }),
  mission({
    participante: 'VALDES EDUARDO FELIX', fechaInicio: '2026-03-09', lugar: 'Montevideo,  Uruguay', institucion: 'ALADI',
    viaticosOtorgados: { amount: 100.5, currency: 'EUR' }, viaticosConsumidos: { amount: 0, currency: 'USD' },
  }),
  mission({ participante: 'YEDLIN,PABLO', fechaInicio: null, lugar: 'WASHINGTON D.C., ESTADOS UNIDOS' }),
  mission({ participante: 'YEDLIN,PABLO', fechaInicio: '2024-07-28', lugar: 'WASHINGTON D.C., ESTADOS UNIDOS' }),
  mission({ participante: 'JULIANA SANTILLAN', fechaInicio: '2026-01-04' }),
  mission({ participante: 'NADIE CONOCIDO', fechaInicio: '2025-01-01' }),
  mission({ participante: 'nadie  conocido', fechaInicio: '2025-02-01' }),
];

test('summarizeMissions groups matched missions per deputy with counts, places and institutions', () => {
  const { deputies } = summarizeMissions(missions, linkFn);
  assert.deepEqual(deputies.map(d => [d.deputyId, d.count]), [['dip-valdes', 3], ['dip-yedlin', 2]]);
  const valdes = deputies[0];
  assert.deepEqual(valdes.lugares, ['BRASILIA, BRASIL', 'MONTEVIDEO, URUGUAY']);
  assert.deepEqual(valdes.instituciones, ['ALADI', 'PARLAMENTO DEL MERCOSUR']);
});

test('summarizeMissions sums granted and consumed viáticos per currency, skipping nulls', () => {
  const [valdes, yedlin] = summarizeMissions(missions, linkFn).deputies;
  assert.deepEqual(valdes.viaticosOtorgados, { EUR: 100.5, USD: 1583 });
  assert.deepEqual(valdes.viaticosConsumidos, { USD: 506 });
  assert.deepEqual(yedlin.viaticosOtorgados, {});
  assert.deepEqual(yedlin.viaticosConsumidos, {});
});

test('summarizeMissions lists each deputy\'s missions newest first, undated last', () => {
  const [valdes, yedlin] = summarizeMissions(missions, linkFn).deputies;
  assert.deepEqual(valdes.missions.map(m => m.fechaInicio), ['2026-03-09', '2025-10-05', '2024-12-02']);
  assert.deepEqual(yedlin.missions.map(m => m.fechaInicio), ['2024-07-28', null]);
});

test('summarizeMissions reports linkage quality over distinct names, with doubtful candidates and unmatched names', () => {
  const { quality } = summarizeMissions(missions, linkFn);
  assert.deepEqual(quality, {
    names: { matched: 3, doubtful: 1, unmatched: 1, total: 5, percent: 60 },
    missions: { linked: 5, total: 8, percent: 62.5 },
    doubtful: [{ nombre: 'JULIANA SANTILLAN', candidates: [{ id: 'dip-santillan', confidence: 0.8 }] }],
    unmatched: ['NADIE CONOCIDO'],
  });
});

test('summarizeMissions with no missions returns empty results and zero percentages', () => {
  assert.deepEqual(summarizeMissions([], linkFn), {
    deputies: [],
    quality: {
      names: { matched: 0, doubtful: 0, unmatched: 0, total: 0, percent: 0 },
      missions: { linked: 0, total: 0, percent: 0 },
      doubtful: [],
      unmatched: [],
    },
  });
});
