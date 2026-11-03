// Pure parsing and aggregation of HCDN CKAN `comisiones`: committee names, permanent committee members and authorities.
import { normalizeText, parseCsv } from './legislators.ts';
import type { LinkCandidate, LinkResult, LinkStatus } from './linkage.ts';

export type CommitteeType = 'permanente' | 'especial';

export interface Committee {
  id: string;
  nombre: string;
  tipo?: CommitteeType;
}

// cargo: 'presidente' | 'vicepresidente 1' | 'vicepresidente 2' | 'secretario' | 'integrante' | other lowercase role
export interface CommitteeRow {
  comisionId: string;
  nombre: string;
  distrito: string;
  cargo: string;
}

export interface DeputyCommittee {
  comisionId: string;
  comision: string;
  cargo: string;
}

export interface CommitteeAuthority {
  cargo: string;
  nombre: string;
  distrito: string;
  deputyId: string | null;
}

export interface CommitteeSummary extends Committee {
  miembros: number;
  autoridades: CommitteeAuthority[];
}

export interface CommitteeQuality {
  // distinct names across members and authorities; percent is the share matched, 0-100 with one decimal
  names: { matched: number; doubtful: number; unmatched: number; total: number; percent: number };
  rows: { linked: number; total: number };
  doubtful: { nombre: string; distrito: string; candidates: LinkCandidate[] }[];
  unmatched: { nombre: string; distrito: string }[];
  // committee ids with members but missing from the committees list
  unknownCommittees: string[];
}

export interface CommitteeReport {
  byDeputy: Map<string, DeputyCommittee[]>;
  committees: Map<string, CommitteeSummary>;
  quality: CommitteeQuality;
}

export type CommitteeLinkFn = (rawName: string, distrito: string) => LinkResult;

const TYPES: Record<string, CommitteeType> = { P: 'permanente', E: 'especial' };

export function parseCommittees(csvText: string): Map<string, Committee> {
  const committees = new Map<string, Committee>();
  for (const row of parseCsv(csvText)) {
    if (!row.ID) continue;
    committees.set(row.ID, { id: row.ID, nombre: row.NOMBRE ?? '', tipo: TYPES[(row.TIPO_DE_COMISION ?? '').toUpperCase()] });
  }
  return committees;
}

// "Vice Presidente 1" and "Vicepresidente 1" -> "vicepresidente 1"; an empty role is a plain member.
function normalizeCargo(value: string): string {
  const cargo = normalizeText(value).replace(/\s+/g, ' ').trim().replace(/^vice ?presidente/, 'vicepresidente');
  return cargo || 'integrante';
}

const toRows = (csvText: string, cargoOf: (row: Record<string, string>) => string): CommitteeRow[] =>
  parseCsv(csvText)
    .filter(row => row.COMISION_ID && row.DIPUTADO_NOMBRE)
    .map(row => ({ comisionId: row.COMISION_ID, nombre: row.DIPUTADO_NOMBRE, distrito: row.DISTRITO ?? '', cargo: cargoOf(row) }));

export function parseMembers(csvText: string): CommitteeRow[] {
  return toRows(csvText, () => 'integrante');
}

export function parseAuthorities(csvText: string): CommitteeRow[] {
  return toRows(csvText, row => normalizeCargo(row.CARGO ?? ''));
}

// The committee files write "CABA"; the composition writes "CIUDAD DE BUENOS AIRES".
const DISTRICT_ALIASES: Record<string, string> = { caba: 'CIUDAD DE BUENOS AIRES' };

export function canonicalDistrict(value: string): string {
  return DISTRICT_ALIASES[normalizeText(value).replace(/\s+/g, ' ').trim()] ?? value;
}

// presidente < vicepresidente N < secretario < other roles (vocal…) < integrante
export function cargoRank(cargo: string): number {
  if (cargo === 'presidente') return 0;
  const vice = /^vicepresidente ?(\d*)$/.exec(cargo);
  if (vice) return 1 + Number(vice[1] || 0) / 100;
  if (/^secretari[oa]/.test(cargo)) return 2;
  if (cargo === 'integrante') return 4;
  return 3;
}

const nameKey = (nombre: string) => normalizeText(nombre).replace(/\s+/g, ' ').trim();
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const byNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

// A name seen several times keeps its worst outcome: any doubtful row makes it doubtful.
const RANK: Record<LinkStatus, number> = { unmatched: 0, matched: 1, doubtful: 2 };

export function committeesByDeputy(
  committees: Map<string, Committee>,
  members: CommitteeRow[],
  authorities: CommitteeRow[],
  linkFn: CommitteeLinkFn,
): CommitteeReport {
  const linked = [...members, ...authorities].map(row => ({ row, result: linkFn(row.nombre, canonicalDistrict(row.distrito)) }));
  const linkedAuthorities = linked.slice(members.length);

  const summaries = new Map<string, CommitteeSummary>();
  const memberNames = new Map<string, Set<string>>();
  for (const row of members) {
    if (!summaries.has(row.comisionId)) {
      const committee = committees.get(row.comisionId) ?? { id: row.comisionId, nombre: row.comisionId, tipo: undefined };
      summaries.set(row.comisionId, { ...committee, miembros: 0, autoridades: [] });
      memberNames.set(row.comisionId, new Set());
    }
    memberNames.get(row.comisionId)!.add(nameKey(row.nombre));
  }
  for (const [id, names] of memberNames) summaries.get(id)!.miembros = names.size;
  for (const { row, result } of linkedAuthorities) {
    summaries.get(row.comisionId)?.autoridades.push({ cargo: row.cargo, nombre: row.nombre, distrito: row.distrito, deputyId: result.deputyId });
  }
  for (const summary of summaries.values()) summary.autoridades.sort((a, b) => cargoRank(a.cargo) - cargoRank(b.cargo));

  // deputyId -> comisionId -> best role
  const roles = new Map<string, Map<string, string>>();
  for (const { row, result } of linked) {
    if (result.status !== 'matched' || !result.deputyId || !summaries.has(row.comisionId)) continue;
    const own = roles.get(result.deputyId) ?? new Map<string, string>();
    roles.set(result.deputyId, own);
    const current = own.get(row.comisionId);
    if (!current || cargoRank(row.cargo) < cargoRank(current)) own.set(row.comisionId, row.cargo);
  }
  const byDeputy = new Map<string, DeputyCommittee[]>();
  for (const [deputyId, own] of roles) {
    const list = [...own].map(([comisionId, cargo]) => ({ comisionId, comision: summaries.get(comisionId)!.nombre, cargo }));
    list.sort((a, b) => cargoRank(a.cargo) - cargoRank(b.cargo) || a.comision.localeCompare(b.comision, 'es'));
    byDeputy.set(deputyId, list);
  }

  const byName = new Map<string, { row: CommitteeRow; result: LinkResult }>();
  for (const entry of linked) {
    const key = nameKey(entry.row.nombre);
    const current = byName.get(key);
    if (!current || RANK[entry.result.status] > RANK[current.result.status]) byName.set(key, entry);
  }
  const names = { matched: 0, doubtful: 0, unmatched: 0 };
  for (const { result } of byName.values()) names[result.status]++;
  const outcomes = [...byName.values()];

  return {
    byDeputy,
    committees: summaries,
    quality: {
      names: { ...names, total: byName.size, percent: percent(names.matched, byName.size) },
      rows: { linked: linked.filter(l => l.result.status === 'matched').length, total: linked.length },
      doubtful: outcomes
        .filter(o => o.result.status === 'doubtful')
        .map(({ row, result }) => ({ nombre: row.nombre, distrito: row.distrito, candidates: result.candidates }))
        .sort(byNombre),
      unmatched: outcomes
        .filter(o => o.result.status === 'unmatched')
        .map(({ row }) => ({ nombre: row.nombre, distrito: row.distrito }))
        .sort(byNombre),
      unknownCommittees: [...summaries.keys()].filter(id => !committees.has(id)).sort(),
    },
  };
}
