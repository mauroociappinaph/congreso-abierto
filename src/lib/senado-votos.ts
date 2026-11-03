import { normalizeText } from './legislators.ts';
import type { LinkCandidate, LinkResult, LinkStatus } from './linkage.ts';

export const SENADO_ACTAS_URL = 'https://www.senado.gob.ar/votaciones/actas';
const DETAIL_URL = 'https://www.senado.gob.ar/votaciones/detalleActa/';
const FIRST_YEAR = 1983;

export type VoteValue = 'afirmativo' | 'negativo' | 'abstencion' | 'ausente' | (string & {});

export interface ActaIndexEntry {
  id: number;
  numero: number | null;
  fecha: string | null;
  titulo: string;
  tipo: string;
  resultado: string;
  mayoria: string;
  // False when the index row has no "Detalle de votación" link (no per-senator votes published).
  detalle: boolean;
}

export interface ActaVote {
  nombre: string;
  senadorId: number | null;
  bloque: string;
  provincia: string;
  voto: VoteValue;
}

export interface ActaTotals {
  afirmativo: number;
  negativo: number;
  abstencion: number;
  ausente: number;
}

export interface ActaDetail {
  id: number;
  numero: number | null;
  fecha: string | null;
  hora: string | null;
  titulo: string;
  resultado: string;
  tipo: string;
  tipoMayoria: string;
  totales: ActaTotals | null;
  votos: ActaVote[];
}

export interface ActaIndexRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

// The index ignores query strings: the year filter is the page's own POST form.
export function actaIndexRequest(year: number): ActaIndexRequest {
  if (!Number.isInteger(year) || year < FIRST_YEAR) throw new Error(`Invalid year for Senate actas: ${year}`);
  const body = new URLSearchParams({ 'busqueda_actas[anio]': String(year), 'busqueda_actas[titulo]': '' });
  return {
    url: SENADO_ACTAS_URL,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  };
}

export function actaDetailUrl(id: number): string {
  return DETAIL_URL + id;
}

// --- HTML helpers --------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

const text = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// Visible text before the first link: titles are followed by expediente and O.D. links.
const leadingText = (html: string) => text(html.split(/<a[\s>]/i)[0]);

function tableBody(html: string, tableId: string): string | null {
  const start = html.search(new RegExp(`<table[^>]*\\bid="${tableId}"`, 'i'));
  if (start < 0) return null;
  const rest = html.slice(start);
  const open = rest.search(/<tbody[^>]*>/i);
  const close = rest.search(/<\/tbody>/i);
  if (open < 0 || close < open) return null;
  return rest.slice(open, close);
}

const rows = (body: string) => [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
const cells = (row: string) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);

const toInt = (value: string | undefined) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : null;
};

function isoDate(value: string): string | null {
  const m = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// --- Parsers -------------------------------------------------------------------

// Index columns: fecha, nro, título, tipo, resultado, acta (descarga), mayoría, detalle, video.
export function parseActaIndex(html: string): ActaIndexEntry[] {
  const body = tableBody(html, 'actasTable');
  if (!body) return [];
  const entries: ActaIndexEntry[] = [];
  for (const row of rows(body)) {
    const td = cells(row);
    if (td.length < 7) continue;
    const detail = row.match(/\/votaciones\/detalleActa\/(\d+)/);
    const id = toInt((detail ?? row.match(/\/votaciones\/verActaVotacion\/(\d+)/) ?? row.match(/mostrar\((\d+)\)/))?.[1]);
    if (id === null) continue;
    // The first cell hides a sortable YYYYMMDD before the visible DD/MM/YYYY.
    const sortable = td[0].match(/>(\d{4})(\d{2})(\d{2})</);
    entries.push({
      id,
      numero: toInt(text(td[1])),
      fecha: sortable ? `${sortable[1]}-${sortable[2]}-${sortable[3]}` : isoDate(text(td[0])),
      titulo: leadingText(td[2]),
      tipo: text(td[3]),
      // The result cell repeats it as hidden "positivo"/"negativo"; the visible label is in the div.
      resultado: text(td[4].match(/<div[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? td[4]),
      mayoria: text(td[6]),
      detalle: Boolean(detail),
    });
  }
  return entries;
}

export function normalizeVote(value: string): VoteValue {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

const TOTAL_LABELS: Record<string, keyof ActaTotals> = {
  afirmativos: 'afirmativo',
  negativos: 'negativo',
  abstenciones: 'abstencion',
  ausentes: 'ausente',
};

function parseTotals(header: string): ActaTotals | null {
  const totals: Partial<ActaTotals> = {};
  for (const m of header.matchAll(/<h3[^>]*>\s*(\d+)\s*<\/h3>\s*<h4[^>]*>([\s\S]*?)<\/h4>/gi)) {
    const key = TOTAL_LABELS[normalizeText(text(m[2]))];
    if (key) totals[key] = Number(m[1]);
  }
  const keys = Object.values(TOTAL_LABELS);
  return keys.every(k => totals[k] !== undefined) ? (totals as ActaTotals) : null;
}

// Detail header: "Acta Nro: N", title paragraph, "DD/MM/YYYY - HH:MM" span, majority span,
// big result paragraph, vote type paragraph, then the four totals. Rows: foto, senador, bloque, provincia, voto.
export function parseActaDetail(html: string, id: number): ActaDetail {
  const body = tableBody(html, 'tabla');
  if (!body) throw new Error(`Senate acta ${id}: votes table not found`);
  const headerEnd = html.search(/<table[^>]*\bid="tabla"/i);
  const header = html.slice(0, headerEnd);
  const numero = header.match(/Acta\s+Nro:?\s*(\d+)/i);
  const afterNumero = numero ? header.slice(numero.index! + numero[0].length) : header;
  const titulo = afterNumero.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
  const spans = [...header.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map(m => text(m[1]));
  const dateIndex = spans.findIndex(s => /\d{2}\/\d{2}\/\d{4}/.test(s));
  const dateSpan = spans[dateIndex] ?? '';
  const result = header.match(/<p[^>]*font-size:\s*2\.7em[^>]*>([\s\S]*?)<\/p>([\s\S]*?)<p[^>]*>([\s\S]*?)<\/p>/i);

  const votos: ActaVote[] = [];
  for (const row of rows(body)) {
    const td = cells(row);
    if (td.length < 5) continue;
    const nombre = text(td[1]);
    if (!nombre) continue;
    votos.push({
      nombre,
      senadorId: toInt(td[0].match(/\/senadores\/senador\/(\d+)/)?.[1]),
      bloque: text(td[2]),
      provincia: text(td[3]),
      voto: normalizeVote(text(td[4])),
    });
  }

  return {
    id,
    numero: toInt(numero?.[1]),
    fecha: isoDate(dateSpan),
    hora: dateSpan.match(/(\d{1,2}:\d{2})/)?.[1] ?? null,
    titulo: leadingText(titulo),
    resultado: result ? text(result[1]) : '',
    tipo: result ? text(result[3]) : '',
    tipoMayoria: dateIndex >= 0 ? (spans[dateIndex + 1] ?? '') : '',
    totales: parseTotals(header),
    votos,
  };
}

// --- Aggregation ---------------------------------------------------------------

export interface SenatorVotes {
  id: string;
  nombre: string;
  provincia: string;
  bloques: string[];
  actas: number;
  afirmativo: number;
  negativo: number;
  abstencion: number;
  ausente: number;
  // Any other recorded value (e.g. a label the parser did not know).
  otros: number;
  // (actas - ausente) / actas.
  asistencia: number;
  // Share of counted votes equal to the bloc majority; null when no acta counted.
  lealtadBloque: number | null;
  lealtadActas: number;
}

export interface BlocCohesion {
  bloque: string;
  senators: number;
  // Actas where the bloc cast at least one afirmativo or negativo.
  actas: number;
  // Mean over those actas of |afirmativo - negativo| / (afirmativo + negativo); null when none.
  riceMedio: number | null;
}

export interface SenateQuality {
  matched: number;
  doubtful: number;
  unmatched: number;
}

export interface SenateVotesSummary {
  periodo: { desde: string | null; hasta: string | null; actas: number };
  senators: Map<string, SenatorVotes>;
  blocs: BlocCohesion[];
  quality: SenateQuality;
  doubtful: { nombre: string; provincia: string; candidates: LinkCandidate[] }[];
  unmatched: { nombre: string; provincia: string }[];
}

export type SenateLinkFn = (nombre: string, provincia: string) => LinkResult;

// Votes that express a position on the floor; absences and unknown labels do not.
const CAST = new Set<VoteValue>(['afirmativo', 'negativo', 'abstencion']);
const TALLIED = ['afirmativo', 'negativo', 'abstencion', 'ausente'] as const;

// A name seen with several outcomes keeps its worst one: any doubtful link makes it doubtful.
const RANK: Record<LinkStatus, number> = { unmatched: 0, matched: 1, doubtful: 2 };

function blocMajority(votes: ActaVote[]): VoteValue | null {
  const counts = new Map<VoteValue, number>();
  for (const v of votes) if (CAST.has(v.voto)) counts.set(v.voto, (counts.get(v.voto) ?? 0) + 1);
  let best: VoteValue | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [value, count] of counts) {
    if (count > bestCount) [best, bestCount, tied] = [value, count, false];
    else if (count === bestCount) tied = true;
  }
  return tied ? null : best;
}

export function summarizeSenateVotes(actas: ActaDetail[], linkFn: SenateLinkFn): SenateVotesSummary {
  const senators = new Map<string, SenatorVotes & { loyal: number }>();
  const names = new Map<string, { nombre: string; provincia: string; result: LinkResult }>();
  const blocs = new Map<string, { members: Set<string>; rice: number[] }>();
  const fechas = actas.map(a => a.fecha).filter((f): f is string => Boolean(f)).sort();

  for (const acta of actas) {
    const byBloc = new Map<string, ActaVote[]>();
    for (const v of acta.votos) {
      const list = byBloc.get(v.bloque);
      if (list) list.push(v);
      else byBloc.set(v.bloque, [v]);
    }

    for (const [bloque, votes] of byBloc) {
      // Some rows publish no bloc: those votes still count for the senator, never as a bloc.
      if (bloque) {
        const bloc = blocs.get(bloque) ?? { members: new Set<string>(), rice: [] };
        blocs.set(bloque, bloc);
        for (const v of votes) bloc.members.add(normalizeText(v.nombre));
        const yes = votes.filter(v => v.voto === 'afirmativo').length;
        const no = votes.filter(v => v.voto === 'negativo').length;
        if (yes + no > 0) bloc.rice.push(Math.abs(yes - no) / (yes + no));
      }

      const majority = bloque ? blocMajority(votes) : null;
      for (const v of votes) {
        const nameKey = normalizeText(v.nombre);
        const result = linkFn(v.nombre, v.provincia);
        const seen = names.get(nameKey);
        if (!seen || RANK[result.status] > RANK[seen.result.status]) {
          names.set(nameKey, { nombre: v.nombre, provincia: v.provincia, result });
        }
        if (result.status !== 'matched' || !result.deputyId) continue;

        let s = senators.get(result.deputyId);
        if (!s) {
          s = {
            id: result.deputyId, nombre: v.nombre, provincia: v.provincia, bloques: [],
            actas: 0, afirmativo: 0, negativo: 0, abstencion: 0, ausente: 0, otros: 0,
            asistencia: 0, lealtadBloque: null, lealtadActas: 0, loyal: 0,
          };
          senators.set(result.deputyId, s);
        }
        s.actas++;
        if ((TALLIED as readonly string[]).includes(v.voto)) s[v.voto as (typeof TALLIED)[number]]++;
        else s.otros++;
        if (v.bloque && !s.bloques.includes(v.bloque)) s.bloques.push(v.bloque);
        if (majority && CAST.has(v.voto)) {
          s.lealtadActas++;
          if (v.voto === majority) s.loyal++;
        }
      }
    }
  }

  const result = new Map<string, SenatorVotes>();
  for (const [id, { loyal, ...s }] of senators) {
    result.set(id, {
      ...s,
      asistencia: s.actas ? (s.actas - s.ausente) / s.actas : 0,
      lealtadBloque: s.lealtadActas ? loyal / s.lealtadActas : null,
    });
  }

  const quality: SenateQuality = { matched: 0, doubtful: 0, unmatched: 0 };
  const doubtful: SenateVotesSummary['doubtful'] = [];
  const unmatched: SenateVotesSummary['unmatched'] = [];
  for (const { nombre, provincia, result: link } of names.values()) {
    quality[link.status]++;
    if (link.status === 'doubtful') doubtful.push({ nombre, provincia, candidates: link.candidates });
    if (link.status === 'unmatched') unmatched.push({ nombre, provincia });
  }
  const byName = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

  return {
    periodo: { desde: fechas[0] ?? null, hasta: fechas.at(-1) ?? null, actas: actas.length },
    senators: result,
    blocs: [...blocs]
      .map(([bloque, { members, rice }]) => ({
        bloque,
        senators: members.size,
        actas: rice.length,
        riceMedio: rice.length ? rice.reduce((sum, r) => sum + r, 0) / rice.length : null,
      }))
      .sort((a, b) => a.bloque.localeCompare(b.bloque, 'es')),
    quality,
    doubtful: doubtful.sort(byName),
    unmatched: unmatched.sort(byName),
  };
}
