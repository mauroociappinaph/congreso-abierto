// Pure parsing and aggregation of HCDN bills (proyectos-parlamentarios) and their moves (movimientos-de-proyectos).
import { normalizeText, parseCsv } from './legislators.ts';
import type { LinkResult, LinkStatus } from './linkage.ts';

export const STAGES = ['presentado', 'en comisión', 'con dictamen', 'media sanción', 'sancionado'] as const;
export type Stage = (typeof STAGES)[number];

export interface Bill {
  id: string;
  titulo: string;
  // YYYY-MM-DD
  fecha: string;
  camaraOrigen: string;
  expediente: string;
  tipo: string;
  // raw AUTOR: the first signer, "APELLIDO, NOMBRES", or a body such as "H CAMARA DE DIPUTADOS"
  autor: string;
}

export interface RecentBill {
  titulo: string;
  fecha: string;
  tipo: string;
  expediente: string;
  stage: Stage;
}

export interface AuthorBills {
  total: number;
  byTipo: Record<string, number>;
  stages: Record<Stage, number>;
  recent: RecentBill[];
}

export interface BillLinkQuality {
  // distinct author names
  matched: number;
  doubtful: number;
  unmatched: number;
  total: number;
  bills: { linked: number; total: number };
  doubtfulNames: string[];
  unmatchedNames: string[];
}

export const RECENT_BILLS = 5;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseBills(csvText: string, { since }: { since: string }): Bill[] {
  return parseCsv(csvText)
    .map(row => {
      const camaraOrigen = row.CAMARA_ORIGEN ?? '';
      const [own, other] = camaraOrigen === 'Senado' ? [row.EXP_SENADO, row.EXP_DIPUTADOS] : [row.EXP_DIPUTADOS, row.EXP_SENADO];
      return {
        id: row.PROYECTO_ID ?? '',
        titulo: (row.TITULO ?? '').replace(/\s+/g, ' '),
        fecha: (row.PUBLICACION_FECHA ?? '').slice(0, 10),
        camaraOrigen,
        expediente: own || other || '',
        tipo: row.TIPO ?? '',
        autor: row.AUTOR ?? '',
      };
    })
    .filter(bill => bill.id && ISO_DAY.test(bill.fecha) && bill.fecha >= since);
}

// MOVIMIENTO -> stage, first match wins, tested on accent-free lowercase text. Derived from the distinct
// values in movimientos_proyectos3.1.csv (2026-10-07). The file records floor and presidency actions, not
// the routine referral to committee nor the committee report itself, so:
// - "en comisión": presidency changes of referral (giro) and motions to compel a committee (emplazamiento).
// - "con dictamen": floor moves that name a committee report ("... DEL DICTAMEN DE MAYORIA").
// - "media sanción": approval by one chamber, incl. art. 114 HCDN / art. 106 Senado approvals and "PASA A ...".
// - "sancionado": final sanction, and insistence or veto moves, which only exist after a sanction.
// Motions ("preferencia con dictamen", "sobre tablas"), cosigner requests, sessions, withdrawals and
// approvals "al archivo" show no progress: null, like any unknown value.
const STAGE_RULES: [RegExp, Stage | null][] = [
  [/\bal archivo\b/, null],
  [/^(continua )?consideracion y sancion|^sancion\b|sancion definitiva|insistencia|observa totalmente|veto parcial y promulgacion|decreto \d+ de promulgacion/, 'sancionado'],
  [/^(continua )?consideracion y aprobacion|^aprobacion articulo 114\b|^aprobacion articulo 106, parrafo 3\b|^(pasa|vuelve) a (senado|diputados)\b|^texto de la media sancion/, 'media sanción'],
  [/^(?!(mocion|solicitud|retiro)\b)(?!.*sin dictamen).*\bdictamen\b/, 'con dictamen'],
  [/\bgir(o|ado|ada)\b|emplazamiento a (la|las) comision|camara en comision|orden de las comisiones/, 'en comisión'],
];

export function stageOf(movimiento: string): Stage | null {
  const text = normalizeText(movimiento).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  for (const [pattern, stage] of STAGE_RULES) if (pattern.test(text)) return stage;
  return null;
}

const rank = (stage: Stage) => STAGES.indexOf(stage);

// Keeps only the requested bills, so the caller can pass every move of the file.
export function furthestStages(movimientosCsv: string, billIds: Set<string>): Map<string, Stage> {
  const stages = new Map<string, Stage>([...billIds].map(id => [id, 'presentado']));
  for (const row of parseCsv(movimientosCsv)) {
    const current = stages.get(row.PROYECTO_ID);
    if (!current) continue;
    const stage = stageOf(row.MOVIMIENTO ?? '');
    if (stage && rank(stage) > rank(current)) stages.set(row.PROYECTO_ID, stage);
  }
  return stages;
}

// Resolutions and declarations are acts of one chamber: its approval is final.
const ONE_CHAMBER = new Set(['resolucion', 'declaracion']);

export function effectiveStage(stage: Stage, tipo: string): Stage {
  return stage === 'media sanción' && ONE_CHAMBER.has(normalizeText(tipo).trim()) ? 'sancionado' : stage;
}

const PREFIX = /^\s*(dip(utad[oa])?|sen(ador(a)?)?)\.?\s+/i;
const cleanAuthor = (autor: string) => autor.replace(PREFIX, '').trim();
const nameKey = (nombre: string) => normalizeText(nombre).replace(/\s+/g, ' ').trim();

// A name seen with several outcomes keeps its worst one: any doubtful link makes it doubtful.
const RANK: Record<LinkStatus, number> = { unmatched: 0, matched: 1, doubtful: 2 };

const emptyFunnel = () => Object.fromEntries(STAGES.map(s => [s, 0])) as Record<Stage, number>;

export function billsByAuthor(
  bills: Bill[],
  stages: Map<string, Stage>,
  linkFn: (autor: string, bill: Bill) => LinkResult,
): { byLegislator: Map<string, AuthorBills>; quality: BillLinkQuality } {
  const byLegislator = new Map<string, AuthorBills>();
  const recent = new Map<string, (RecentBill & { id: string })[]>();
  const names = new Map<string, { nombre: string; status: LinkStatus }>();
  let linked = 0;

  for (const bill of bills) {
    const autor = cleanAuthor(bill.autor);
    const result = linkFn(autor, bill);
    const key = nameKey(autor);
    const seen = names.get(key);
    if (!seen) names.set(key, { nombre: autor, status: result.status });
    else if (RANK[result.status] > RANK[seen.status]) seen.status = result.status;
    if (result.status !== 'matched' || !result.deputyId) continue;

    linked++;
    const id = result.deputyId;
    const stage = effectiveStage(stages.get(bill.id) ?? 'presentado', bill.tipo);
    let entry = byLegislator.get(id);
    if (!entry) byLegislator.set(id, (entry = { total: 0, byTipo: {}, stages: emptyFunnel(), recent: [] }));
    entry.total++;
    entry.byTipo[bill.tipo] = (entry.byTipo[bill.tipo] ?? 0) + 1;
    entry.stages[stage]++;
    const list = recent.get(id) ?? [];
    list.push({ id: bill.id, titulo: bill.titulo, fecha: bill.fecha, tipo: bill.tipo, expediente: bill.expediente, stage });
    recent.set(id, list);
  }

  for (const [id, list] of recent) {
    byLegislator.get(id)!.recent = list
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
      .slice(0, RECENT_BILLS)
      .map(({ id: _id, ...rest }) => rest);
  }

  const counts = { matched: 0, doubtful: 0, unmatched: 0 };
  for (const { status } of names.values()) counts[status]++;
  const namesWith = (status: LinkStatus) =>
    [...names.values()].filter(n => n.status === status).map(n => n.nombre).sort((a, b) => a.localeCompare(b, 'es'));

  return {
    byLegislator,
    quality: {
      ...counts,
      total: names.size,
      bills: { linked, total: bills.length },
      doubtfulNames: namesWith('doubtful'),
      unmatchedNames: namesWith('unmatched'),
    },
  };
}
