import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  actaDetailUrl,
  actaIndexRequest,
  normalizeVote,
  parseActaDetail,
  parseActaIndex,
  summarizeSenateVotes,
  type ActaDetail,
  type ActaVote,
} from './senado-votos.ts';
import type { LinkResult } from './linkage.ts';

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/senado/${name}`, import.meta.url), 'utf8');

test('actaIndexRequest posts the year filter form', () => {
  assert.deepEqual(actaIndexRequest(2025), {
    url: 'https://www.senado.gob.ar/votaciones/actas',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'busqueda_actas%5Banio%5D=2025&busqueda_actas%5Btitulo%5D=',
  });
  assert.throws(() => actaIndexRequest(1982), /year/);
  assert.throws(() => actaIndexRequest(2025.5), /year/);
  assert.equal(actaDetailUrl(2623), 'https://www.senado.gob.ar/votaciones/detalleActa/2623');
});

test('parseActaIndex reads each acta row from the real index markup', () => {
  const actas = parseActaIndex(fixture('actas-index.html'));
  assert.deepEqual(actas, [
    {
      id: 2623,
      numero: 1,
      fecha: '2026-02-11',
      titulo: 'Modernización Laboral.',
      tipo: 'EN GENERAL',
      resultado: 'AFIRMATIVO',
      mayoria: 'SIMPLE',
      detalle: true,
    },
    {
      id: 2603,
      numero: 1,
      fecha: '2025-11-28',
      titulo: 'Incorporación de senadores electos.',
      tipo: 'EN GENERAL',
      resultado: 'AFIRMATIVO',
      mayoria: 'SIMPLE',
      detalle: false,
    },
    {
      id: 2448,
      numero: 4,
      fecha: '2024-06-12',
      titulo: 'Ley de Bases. Título I: Declaración de emergencia.',
      tipo: 'EN PARTICULAR',
      resultado: 'EMPATE',
      mayoria: 'SIMPLE',
      detalle: true,
    },
    {
      id: 2473,
      numero: 29,
      fecha: '2024-06-12',
      titulo: 'Medidas Fiscales Paliativas y Relevantes. Título VIII: Otras Medidas Fiscales. Artículo 112.',
      tipo: 'EN PARTICULAR',
      resultado: 'CANCELADA LEV.VOT.',
      mayoria: 'SIMPLE',
      detalle: true,
    },
  ]);
});

test('parseActaIndex returns no actas for a page without the table', () => {
  assert.deepEqual(parseActaIndex('<html><body>Sin resultados</body></html>'), []);
});

test('parseActaDetail reads the header and every vote type', () => {
  const acta = parseActaDetail(fixture('detalle-2542.html'), 2542);
  assert.deepEqual(
    { ...acta, votos: undefined },
    {
      id: 2542,
      numero: 2,
      fecha: '2025-04-03',
      hora: '20:21',
      titulo: 'Pliego para designar al doctor Ariel Lijo como juez de la Corte Suprema de Justicia.',
      resultado: 'NEGATIVO',
      tipo: 'EN GENERAL Y EN PARTICULAR',
      tipoMayoria: 'DOS TERCIOS DE VOTOS EMITIDOS',
      totales: { afirmativo: 27, negativo: 43, abstencion: 1, ausente: 1 },
      votos: undefined,
    },
  );
  assert.deepEqual(acta.votos, [
    { nombre: 'ROMERO, JUAN CARLOS', senadorId: null, bloque: 'CAMBIO FEDERAL', provincia: 'SALTA', voto: 'afirmativo' },
    { nombre: 'TERENZI, EDITH ELIZABETH', senadorId: 528, bloque: 'DESPIERTA CHUBUT', provincia: 'CHUBUT', voto: 'ausente' },
    { nombre: 'DE ANGELI, ALFREDO LUIS', senadorId: null, bloque: 'FRENTE PRO', provincia: 'ENTRE RÍOS', voto: 'negativo' },
    { nombre: 'PAGOTTO, JUAN CARLOS', senadorId: null, bloque: 'LA LIBERTAD AVANZA', provincia: 'LA RIOJA', voto: 'abstencion' },
  ]);
});

test('parseActaDetail reads a title with expediente links and a simple majority', () => {
  const acta = parseActaDetail(fixture('detalle-2623.html'), 2623);
  assert.equal(acta.numero, 1);
  assert.equal(acta.fecha, '2026-02-11');
  assert.equal(acta.hora, '01:21');
  assert.equal(acta.titulo, 'Modernización Laboral.');
  assert.equal(acta.resultado, 'AFIRMATIVO');
  assert.equal(acta.tipo, 'EN GENERAL');
  assert.equal(acta.tipoMayoria, 'SIMPLE');
  assert.deepEqual(acta.totales, { afirmativo: 42, negativo: 30, abstencion: 0, ausente: 0 });
  assert.deepEqual(
    acta.votos.map(v => [v.nombre, v.senadorId, v.bloque, v.provincia, v.voto]),
    [
      ['MENDOZA, SANDRA MARIELA', 540, 'CONVICCIÓN FEDERAL', 'TUCUMÁN', 'negativo'],
      ['MOISES, MARÍA CAROLINA', 554, 'CONVICCIÓN FEDERAL', 'JUJUY', 'negativo'],
      ['TERENZI, EDITH ELIZABETH', 528, 'DESPIERTA CHUBUT', 'CHUBUT', 'afirmativo'],
    ],
  );
});

test('parseActaDetail rejects a page without the votes table', () => {
  assert.throws(() => parseActaDetail('<html><body>Error</body></html>', 1), /acta 1/);
});

test('normalizeVote maps the official labels and keeps unknown ones readable', () => {
  assert.equal(normalizeVote(' AFIRMATIVO '), 'afirmativo');
  assert.equal(normalizeVote('NEGATIVO'), 'negativo');
  assert.equal(normalizeVote('ABSTENCIÓN'), 'abstencion');
  assert.equal(normalizeVote('AUSENTE'), 'ausente');
  assert.equal(normalizeVote('Presidente  de la Sesión'), 'presidente de la sesion');
});

// --- aggregation ---------------------------------------------------------------

const vote = (nombre: string, bloque: string, voto: ActaVote['voto']): ActaVote => ({
  nombre,
  senadorId: null,
  bloque,
  provincia: 'SALTA',
  voto,
});

const acta = (id: number, fecha: string, votos: ActaVote[]): ActaDetail => ({
  id,
  numero: id,
  fecha,
  hora: null,
  titulo: `Acta ${id}`,
  resultado: 'AFIRMATIVO',
  tipo: 'EN GENERAL',
  tipoMayoria: 'SIMPLE',
  totales: null,
  votos,
});

const linkFn = (nombre: string): LinkResult => {
  if (nombre.startsWith('DUDOSO')) {
    return { status: 'doubtful', deputyId: null, confidence: 0.8, candidates: [{ id: 'sen-x', confidence: 0.8 }] };
  }
  if (nombre.startsWith('DESCONOCIDO')) return { status: 'unmatched', deputyId: null, confidence: 0, candidates: [] };
  return { status: 'matched', deputyId: 'sen-' + nombre.toLowerCase(), confidence: 1, candidates: [] };
};

// Bloc A: A1, A2, A3. Bloc B: B1, B2.
const ACTAS: ActaDetail[] = [
  acta(1, '2024-03-01', [
    vote('A1', 'A', 'afirmativo'),
    vote('A2', 'A', 'afirmativo'),
    vote('A3', 'A', 'negativo'),
    vote('B1', 'B', 'negativo'),
    vote('B2', 'B', 'negativo'),
  ]),
  acta(2, '2024-05-10', [
    vote('A1', 'A', 'afirmativo'),
    vote('A2', 'A', 'negativo'),
    vote('A3', 'A', 'ausente'),
    vote('B1', 'B', 'afirmativo'),
    vote('B2', 'B', 'afirmativo'),
  ]),
  acta(3, '2025-08-20', [
    vote('A1', 'A', 'ausente'),
    vote('A2', 'A', 'abstencion'),
    vote('A3', 'A', 'ausente'),
    vote('B1', 'B', 'ausente'),
    vote('B2', 'B', 'negativo'),
    vote('DUDOSO, X', 'B', 'negativo'),
    vote('DESCONOCIDO, Y', 'B', 'afirmativo'),
  ]),
];

test('summarizeSenateVotes counts votes and attendance per senator', () => {
  const summary = summarizeSenateVotes(ACTAS, linkFn);
  const a1 = summary.senators.get('sen-a1')!;
  assert.equal(a1.actas, 3);
  assert.equal(a1.afirmativo, 2);
  assert.equal(a1.negativo, 0);
  assert.equal(a1.abstencion, 0);
  assert.equal(a1.ausente, 1);
  assert.equal(a1.asistencia, 2 / 3);
  const a3 = summary.senators.get('sen-a3')!;
  assert.deepEqual([a3.actas, a3.negativo, a3.ausente, a3.asistencia], [3, 1, 2, 1 / 3]);
  assert.deepEqual(summary.periodo, { desde: '2024-03-01', hasta: '2025-08-20', actas: 3 });
});

test('summarizeSenateVotes measures bloc loyalty and skips tied blocs', () => {
  const summary = summarizeSenateVotes(ACTAS, linkFn);
  // Acta 1: bloc A majority afirmativo (2-1). Acta 2: A ties 1-1 -> not counted. Acta 3: A cast one abstention.
  const a1 = summary.senators.get('sen-a1')!;
  assert.deepEqual([a1.lealtadBloque, a1.lealtadActas], [1, 1]);
  const a2 = summary.senators.get('sen-a2')!;
  assert.deepEqual([a2.lealtadBloque, a2.lealtadActas], [1, 2]);
  const a3 = summary.senators.get('sen-a3')!;
  assert.deepEqual([a3.lealtadBloque, a3.lealtadActas], [0, 1]);
  // Acta 3: bloc B cast negativo, negativo, afirmativo -> majority negativo.
  const b2 = summary.senators.get('sen-b2')!;
  assert.deepEqual([b2.lealtadBloque, b2.lealtadActas], [1, 3]);
});

test('summarizeSenateVotes leaves loyalty empty when no acta counted', () => {
  const summary = summarizeSenateVotes(
    [acta(1, '2024-01-01', [vote('A1', 'A', 'ausente'), vote('A2', 'A', 'afirmativo')])],
    linkFn,
  );
  const a1 = summary.senators.get('sen-a1')!;
  assert.deepEqual([a1.lealtadBloque, a1.lealtadActas, a1.asistencia], [null, 0, 0]);
});

test('summarizeSenateVotes computes the Rice index for a split and a unanimous bloc', () => {
  const summary = summarizeSenateVotes(ACTAS, linkFn);
  const a = summary.blocs.find(b => b.bloque === 'A')!;
  // Acta 1: |2-1|/3, acta 2: |1-1|/2 = 0, acta 3: no yes/no -> skipped.
  assert.equal(a.senators, 3);
  assert.equal(a.actas, 2);
  assert.ok(Math.abs(a.riceMedio! - (1 / 3 + 0) / 2) < 1e-12);
  const b = summary.blocs.find(b => b.bloque === 'B')!;
  // Acta 1: 2-0 -> 1, acta 2: 2-0 -> 1, acta 3: |1-2|/3.
  assert.equal(b.senators, 4);
  assert.equal(b.actas, 3);
  assert.ok(Math.abs(b.riceMedio! - (1 + 1 + 1 / 3) / 3) < 1e-12);
  const unanimous = summarizeSenateVotes(ACTAS.slice(0, 1), linkFn).blocs.find(x => x.bloque === 'B')!;
  assert.equal(unanimous.riceMedio, 1);
});

test('summarizeSenateVotes keeps votes without a bloc out of bloc statistics', () => {
  const summary = summarizeSenateVotes(
    [acta(1, '2024-01-01', [vote('A1', '', 'negativo'), vote('A2', '', 'afirmativo'), vote('A3', '', 'afirmativo')])],
    linkFn,
  );
  assert.deepEqual(summary.blocs, []);
  const a1 = summary.senators.get('sen-a1')!;
  assert.deepEqual([a1.negativo, a1.asistencia, a1.lealtadBloque, a1.lealtadActas, a1.bloques], [1, 1, null, 0, []]);
});

test('summarizeSenateVotes reports linking quality by distinct name', () => {
  const summary = summarizeSenateVotes(ACTAS, linkFn);
  assert.deepEqual(summary.quality, { matched: 5, doubtful: 1, unmatched: 1 });
  assert.deepEqual(summary.doubtful, [
    { nombre: 'DUDOSO, X', provincia: 'SALTA', candidates: [{ id: 'sen-x', confidence: 0.8 }] },
  ]);
  assert.deepEqual(summary.unmatched, [{ nombre: 'DESCONOCIDO, Y', provincia: 'SALTA' }]);
  assert.equal(summary.senators.size, 5);
});

test('summarizeSenateVotes counts a senator once per acta when the source repeats the table', () => {
  // Real case: acta 2850 publishes all 72 senators twice with the same votes.
  const repeated = acta(9, '2026-10-29', [
    vote('A1', 'A', 'afirmativo'), vote('B1', 'B', 'negativo'),
    vote('B1', 'B', 'negativo'), vote('A1', 'A', 'afirmativo'),
  ]);
  const summary = summarizeSenateVotes([repeated], linkFn);
  assert.deepEqual([summary.senators.get('sen-a1')!.actas, summary.senators.get('sen-a1')!.afirmativo], [1, 1]);
  assert.equal(summary.blocs.find(b => b.bloque === 'B')!.riceMedio, 1);
  assert.deepEqual(summary.inconsistencias, { actasConFilasRepetidas: [9], votosDescartados: 0 });
});

test('summarizeSenateVotes drops a senator vote that the source repeats with different values', () => {
  const conflicting = acta(10, '2026-10-29', [vote('A1', 'A', 'afirmativo'), vote('A1', 'A', 'negativo'), vote('A2', 'A', 'afirmativo')]);
  const summary = summarizeSenateVotes([conflicting], linkFn);
  assert.equal(summary.senators.has('sen-a1'), false);
  assert.equal(summary.senators.get('sen-a2')!.actas, 1);
  assert.deepEqual(summary.inconsistencias, { actasConFilasRepetidas: [10], votosDescartados: 1 });
});
