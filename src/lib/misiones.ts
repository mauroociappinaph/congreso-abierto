// Pure parsing and aggregation of HCDN official missions abroad (CKAN `misiones-oficiales`).
import { normalizeText, parseArsAmount, type Row } from './legislators.ts';
import { repairMojibake, type LinkCandidate, type LinkResult, type LinkStatus } from './linkage.ts';

export interface Money {
  amount: number;
  currency: string;
}

export interface Mission {
  fechaInicio: string | null;
  fechaFin: string | null;
  motivo: string;
  institucion: string;
  lugar: string;
  // raw name with "DIP." / "DIPUTADO/A (NACIONAL)" prefixes stripped
  participante: string;
  bloque: string;
  viaticosDias: number | null;
  // total granted: days x daily rate, or the published total in 2015-2019 files
  viaticosOtorgados: Money | null;
  viaticosConsumidos: Money | null;
}

export interface DeputyMissions {
  deputyId: string;
  count: number;
  lugares: string[];
  instituciones: string[];
  viaticosOtorgados: Record<string, number>;
  viaticosConsumidos: Record<string, number>;
  // newest first, undated last
  missions: Mission[];
}

export interface MissionQuality {
  // distinct participant names
  names: { matched: number; doubtful: number; unmatched: number; total: number; percent: number };
  missions: { linked: number; total: number; percent: number };
  doubtful: { nombre: string; candidates: LinkCandidate[] }[];
  unmatched: string[];
}

export interface MissionSummary {
  deputies: DeputyMissions[];
  quality: MissionQuality;
}

type Field =
  | 'fechaInicio' | 'fechaFin' | 'motivo' | 'institucion' | 'lugar' | 'ciudad' | 'pais' | 'participante' | 'bloque'
  | 'otorgados' | 'moneda' | 'consumidos'
  | 'dias' | 'monedaOtorgados' | 'montoOtorgados' | 'monedaConsumidos' | 'montoConsumidos';

const headerKey = (header: string) => normalizeText(header).replace(/[^a-z0-9]/g, '');

// Header families seen: 2024-2026 snake_case (upper or lower), 2022-2023 spaced ("FECHA INICIO"),
// 2020-2021 (ciudad/pais, diputado_nombre), 2015-2019 (viaje_desc, separate days/currency/amount columns).
const FIELDS: Record<string, Field> = {
  fechainicio: 'fechaInicio', fechainicioviaje: 'fechaInicio',
  fechafin: 'fechaFin', fechafinviaje: 'fechaFin',
  motivo: 'motivo', viajedesc: 'motivo',
  institucionqueinvita: 'institucion', insituticionqueinvita: 'institucion',
  lugar: 'lugar', ciudadpais: 'lugar',
  ciudadviaje: 'ciudad', paisdestinonombre: 'pais',
  participa: 'participante', diputadonombre: 'participante',
  bloque: 'bloque', bloquenombre: 'bloque', diputadobloque: 'bloque',
  moneda: 'moneda',
  viaticosconsumidos: 'consumidos',
  diasviaticosotorgados: 'dias', viaticoscantidad: 'dias',
  monedaviaticosotorgadosid: 'monedaOtorgados', monedaid: 'monedaOtorgados',
  montoviaticosotorgados: 'montoOtorgados', montototalviaticos: 'montoOtorgados',
  monedaviaticosconsumidosid: 'monedaConsumidos',
  montoviaticosconsumidos: 'montoConsumidos',
};

// The granted column carries a decree reference that changes by year ("..._segun_r_p_n_1164_12", "(... 280/95)").
const fieldOf = (header: string): Field | undefined => {
  const key = headerKey(header);
  return FIELDS[key] ?? (key.startsWith('viaticosotorgados') ? 'otorgados' : undefined);
};

const clean = (value: string | undefined) => repairMojibake(value ?? '').replace(/\s+/g, ' ').trim();
const isPlaceholder = (value: string) => /^(-|_|na|n\/a|no|s\/n)?$/.test(normalizeText(value).trim());
const trimDots = (value: string) => value.replace(/[.\s]+$/, '');

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

// "2026-3-9", "2025-07-30T00:00:00Z", "25/01/2022", "8/1/2019"; impossible dates give null.
function parseDate(value: string): string | null {
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T[\d:.]+Z?)?$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

function currencyOf(value: string): string | null {
  const text = normalizeText(value);
  if (/u\$s|us\$|u\$d|usd|dolar/.test(text)) return 'USD';
  if (/eur|€/.test(text)) return 'EUR';
  if (/\$|ars|peso/.test(text)) return 'ARS';
  return null;
}

// "1.434,00" and "328751,12" (Argentine), "1077.00" (decimal point); anything else ("3492.0.00") gives null.
function parseAmount(value: string): number | null {
  const text = normalizeText(value).replace(/u\$s|us\$|u\$d|usd|ars|eur|€|\$|\s/g, '');
  if (/^\d+\.\d{1,2}$/.test(text)) return Number(text);
  if (/^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(text)) return parseArsAmount(text);
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// "3 DIAS - U$S 354" is days and daily rate; "* 5 DÍAS - U$S 255* 2 DÍAS - U$S 543" adds up blocks.
// A block without a rate ("1 DIA - U$S") leaves the amount unknown.
function parseGranted(value: string, moneda: string): { dias: number | null; money: Money | null } {
  if (isPlaceholder(value)) return { dias: null, money: null };
  const blocks = [...normalizeText(value).matchAll(/(\d+)\s*dias?\s*-\s*([^\d*]*)(\d[\d.,]*)?/g)];
  if (!blocks.length) return { dias: null, money: money(parseAmount(value), moneda, value) };
  const dias = blocks.reduce((sum, b) => sum + Number(b[1]), 0);
  const rates = blocks.map(b => (b[3] ? parseAmount(b[3].replace(/[.,]$/, '')) : null));
  if (rates.some(rate => rate === null)) return { dias, money: null };
  const amount = round2(blocks.reduce((sum, b, i) => sum + Number(b[1]) * rates[i]!, 0));
  return { dias, money: money(amount, moneda, blocks.map(b => b[2]).join(' ')) };
}

// The MONEDA column wins over a symbol inside the value ("$ 1.002,00" in a U$S row).
function money(amount: number | null, moneda: string, value: string): Money | null {
  if (amount === null) return null;
  const currency = currencyOf(moneda) ?? currencyOf(value);
  return currency ? { amount, currency } : null;
}

function parseConsumed(value: string, moneda: string): Money | null {
  return isPlaceholder(value) ? null : money(parseAmount(value), moneda, value);
}

// "DIP. TAIANA JORGE", "DELEGACION ENCABEZADA POR LA DIPUTADA NACIONAL JULIANA SANTILLAN", "DIP. VERONICA KARINA BANFI."
function participantName(value: string): string {
  const name = value.replace(/^(?:.*\s)?(?:DIP\.|DIP\s|DIPUTAD[OA](?:\/A)?S?(?:\s+NACIONAL(?:ES)?)?\s)\s*/i, '');
  return trimDots(name).trim();
}

const days = (value: string) => (/^\d+$/.test(value) ? Number(value) : null);

export function normalizeMissionRows(rows: Row[]): Mission[] {
  const missions: Mission[] = [];
  for (const row of rows) {
    const f: Partial<Record<Field, string>> = {};
    for (const [header, value] of Object.entries(row)) {
      const field = fieldOf(header);
      if (field && f[field] === undefined) f[field] = clean(value);
    }
    const raw = f.participante ?? '';
    const participante = isPlaceholder(raw) ? '' : participantName(raw);
    if (!participante) continue;

    const split = f.montoOtorgados !== undefined;
    const granted = split
      ? {
          dias: days(f.dias ?? ''),
          money: isPlaceholder(f.montoOtorgados!) ? null : money(parseAmount(f.montoOtorgados!), f.monedaOtorgados ?? '', ''),
        }
      : parseGranted(f.otorgados ?? '', f.moneda ?? '');
    const consumed = f.montoConsumidos !== undefined
      ? parseConsumed(f.montoConsumidos, f.monedaConsumidos ?? '')
      : parseConsumed(f.consumidos ?? '', f.moneda ?? '');
    const lugar = f.lugar ?? [f.ciudad, f.pais].filter(Boolean).join(', ');

    missions.push({
      fechaInicio: parseDate(f.fechaInicio ?? ''),
      fechaFin: parseDate(f.fechaFin ?? ''),
      motivo: f.motivo ?? '',
      institucion: f.institucion ?? '',
      lugar: trimDots(lugar),
      participante,
      bloque: f.bloque ?? '',
      viaticosDias: granted.dias,
      viaticosOtorgados: granted.money,
      viaticosConsumidos: consumed,
    });
  }
  return missions;
}

const percent = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const textKey = (value: string) => normalizeText(value).replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim();

// Distinct by accent/case/space-insensitive key, keeping the first spelling seen.
function distinct(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = textKey(value);
    if (key && !seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

function addMoney(totals: Record<string, number>, value: Money | null) {
  if (value) totals[value.currency] = round2((totals[value.currency] ?? 0) + value.amount);
}

const byDateDesc = (a: Mission, b: Mission) =>
  a.fechaInicio === b.fechaInicio ? 0 : a.fechaInicio === null ? 1 : b.fechaInicio === null ? -1 : b.fechaInicio.localeCompare(a.fechaInicio);

// A name linked several times keeps its worst outcome: any doubtful result makes it doubtful.
const RANK: Record<LinkStatus, number> = { unmatched: 0, matched: 1, doubtful: 2 };

export function summarizeMissions(missions: Mission[], linkFn: (rawName: string) => LinkResult): MissionSummary {
  const byDeputy = new Map<string, Mission[]>();
  const names = new Map<string, { nombre: string; result: LinkResult }>();
  let linked = 0;

  for (const mission of missions) {
    const result = linkFn(mission.participante);
    const key = textKey(mission.participante);
    const current = names.get(key);
    if (!current || RANK[result.status] > RANK[current.result.status]) {
      names.set(key, { nombre: current?.nombre ?? mission.participante, result });
    }
    if (result.status !== 'matched' || !result.deputyId) continue;
    linked++;
    byDeputy.set(result.deputyId, [...(byDeputy.get(result.deputyId) ?? []), mission]);
  }

  const deputies = [...byDeputy].map(([deputyId, list]): DeputyMissions => {
    const viaticosOtorgados: Record<string, number> = {};
    const viaticosConsumidos: Record<string, number> = {};
    for (const m of list) {
      addMoney(viaticosOtorgados, m.viaticosOtorgados);
      addMoney(viaticosConsumidos, m.viaticosConsumidos);
    }
    return {
      deputyId,
      count: list.length,
      lugares: distinct(list.map(m => m.lugar)),
      instituciones: distinct(list.map(m => m.institucion)),
      viaticosOtorgados: Object.fromEntries(Object.entries(viaticosOtorgados).sort(([a], [b]) => a.localeCompare(b))),
      viaticosConsumidos: Object.fromEntries(Object.entries(viaticosConsumidos).sort(([a], [b]) => a.localeCompare(b))),
      missions: [...list].sort(byDateDesc),
    };
  }).sort((a, b) => b.count - a.count || a.deputyId.localeCompare(b.deputyId));

  const counts = { matched: 0, doubtful: 0, unmatched: 0 };
  for (const { result } of names.values()) counts[result.status]++;
  const sortedNames = (status: LinkStatus) =>
    [...names.values()].filter(n => n.result.status === status).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    deputies,
    quality: {
      names: { ...counts, total: names.size, percent: percent(counts.matched, names.size) },
      missions: { linked, total: missions.length, percent: percent(linked, missions.length) },
      doubtful: sortedNames('doubtful').map(n => ({ nombre: n.nombre, candidates: n.result.candidates })),
      unmatched: sortedNames('unmatched').map(n => n.nombre),
    },
  };
}
