import { estimateHome, type EndpointTable, type Home } from './distance.ts';
import { normalizeText, type Row } from './legislators.ts';

export type Region = 'CABA' | 'Buenos Aires' | 'Centro' | 'Cuyo' | 'NOA' | 'NEA' | 'Patagonia';

export interface TripRow {
  period: string;
  nombre: string;
  tipo: string;
  origen: string;
  destino: string;
  provincia?: string;
}

export interface Leg {
  deputyId: string;
  period: string;
  tipo: string;
  origen: string;
  destino: string;
}

export interface TravelDeputyInput {
  id: string;
  lugar: string;
  fechaInicio: string;
}

export interface Route {
  origen: string;
  destino: string;
  count: number;
}

export interface DeputyTravel {
  deputyId: string;
  // shown for context only; peers are chosen by band
  region: Region | null;
  // distance band label, e.g. "100–400 km"; null without an estimated home
  band: string | null;
  // estimated km from home to the Obelisco, rounded
  homeKm: number | null;
  homeSource: Home['source'] | null;
  legs: number;
  months: number;
  legsPerMonth: number;
  bandMedian: number | null;
  z: number | null;
  flagged: boolean;
  eligible: boolean;
  topRoute: Route | null;
  bySemester: Record<string, number>;
}

export interface BandSummary {
  band: string;
  deputies: number;
  medianLegsPerMonth: number;
  medianKm: number;
}

export interface TravelAnalysis {
  deputies: DeputyTravel[];
  bands: BandSummary[];
}

export const MIN_MONTHS = 3;
export const Z_THRESHOLD = 3.5;
// Upper bounds (km) of the distance bands; the last band is open-ended.
export const BAND_LIMITS = [100, 400, 800, 1200];
export const MIN_BAND_PEERS = 5;

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5,
  jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

const yearMonth = (year: number, month: number | undefined) =>
  month && month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, '0')}` : null;

export function parsePeriod(value: string): string | null {
  const text = normalizeText(value).trim();
  let m = text.match(/^([a-z]+)-(\d{2}|\d{4})$/);
  if (m) return yearMonth(m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), MONTHS[m[1]]);
  m = text.match(/^(\d{4})-(\d{2})(-\d{2})?$/);
  if (m) return yearMonth(Number(m[1]), Number(m[2]));
  m = text.match(/^(\d{4})\s*-\s*([a-z]+)$/);
  if (m) return yearMonth(Number(m[1]), MONTHS[m[2]]);
  return null;
}

const headerKey = (header: string) => normalizeText(header).replace(/[^a-z0-9]/g, '');

const FIELDS: Record<string, keyof TripRow> = {
  periodo: 'period', mes: 'period',
  diputado: 'nombre', diputados: 'nombre',
  tiposolicitud: 'tipo',
  origen: 'origen',
  destino: 'destino',
  provincia: 'provincia',
};

export function normalizeTripRows(rows: Row[]): TripRow[] {
  const result: TripRow[] = [];
  for (const row of rows) {
    const fields: Partial<Record<keyof TripRow, string>> = {};
    for (const [header, value] of Object.entries(row)) {
      const field = FIELDS[headerKey(header)];
      if (field && fields[field] === undefined) fields[field] = (value ?? '').trim();
    }
    const period = parsePeriod(fields.period ?? '');
    const nombre = fields.nombre ?? '';
    if (!period || !nombre) continue;
    const trip: TripRow = {
      period,
      nombre,
      tipo: (fields.tipo ?? '').toUpperCase(),
      origen: fields.origen ?? '',
      destino: fields.destino ?? '',
    };
    if (fields.provincia) trip.provincia = fields.provincia;
    result.push(trip);
  }
  return result;
}

// Regions are only displayed; peers are grouped by estimated distance (bandsOf).
const REGIONS: Record<Region, string[]> = {
  CABA: ['ciudad de buenos aires'],
  'Buenos Aires': ['buenos aires'],
  Centro: ['cordoba', 'santa fe', 'entre rios', 'la pampa'],
  Cuyo: ['mendoza', 'san juan', 'san luis'],
  NOA: ['jujuy', 'salta', 'tucuman', 'catamarca', 'santiago del estero', 'la rioja'],
  NEA: ['chaco', 'corrientes', 'formosa', 'misiones'],
  Patagonia: ['neuquen', 'rio negro', 'chubut', 'santa cruz', 'tierra del fuego'],
};

const DISTRICT_REGION = new Map<string, Region>(
  (Object.entries(REGIONS) as [Region, string[]][]).flatMap(([region, districts]) => districts.map(d => [d, region] as const)),
);

export function regionOf(district: string): Region | null {
  return DISTRICT_REGION.get(normalizeText(district).trim().replace(/\s+/g, ' ')) ?? null;
}

const startMonth = (fechaInicio: string) => {
  const m = fechaInicio.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? yearMonth(Number(m[3]), Number(m[2])) : null;
};

/** Window months on or after the deputy's start month; an unparsable date counts the whole window. */
const monthsInOffice = (windowMonths: string[], fechaInicio: string) => {
  const start = startMonth(fechaInicio);
  return start ? windowMonths.filter(month => month >= start) : [...windowMonths];
};

export function monthsInWindow(windowMonths: string[], fechaInicio: string): number {
  return monthsInOffice(windowMonths, fechaInicio).length;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Iglewicz-Hoaglin modified z-scores, with the mean-absolute-deviation fallback when MAD is 0. */
export function modifiedZScores(values: number[]): number[] {
  const med = median(values);
  const deviations = values.map(x => Math.abs(x - med));
  const mad = median(deviations);
  if (mad > 0) return values.map(x => (0.6745 * (x - med)) / mad);
  const meanAd = deviations.reduce((t, d) => t + d, 0) / (deviations.length || 1);
  if (meanAd > 0) return values.map(x => (x - med) / (1.253314 * meanAd));
  return values.map(() => 0);
}

const round = (n: number) => Math.round(n * 100) / 100;

const semesterOf = (period: string) => `${period.slice(0, 4)}-S${Number(period.slice(5, 7)) <= 6 ? 1 : 2}`;

const topRouteOf = (legs: Leg[]): Route | null => {
  const counts = new Map<string, number>();
  for (const leg of legs) {
    const key = [leg.origen.trim(), leg.destino.trim()].sort().join('\u0000');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const entry of counts) {
    if (!best || entry[1] > best[1] || (entry[1] === best[1] && entry[0] < best[0])) best = entry;
  }
  if (!best) return null;
  const [origen, destino] = best[0].split('\u0000');
  return { origen, destino, count: best[1] };
};

interface BandRange {
  from: number;
  // exclusive; Infinity for the open band
  to: number;
}

export function bandLabel({ from, to }: BandRange): string {
  if (from === 0) return `< ${to} km`;
  if (to === Infinity) return `≥ ${from} km`;
  return `${from}–${to} km`;
}

const BASE_BANDS: BandRange[] = [0, ...BAND_LIMITS].map((from, i) => ({ from, to: BAND_LIMITS[i] ?? Infinity }));
const baseBandOf = (km: number) => BASE_BANDS.findIndex(b => km >= b.from && km < b.to);

/**
 * Groups the base bands that have eligible deputies. Walking from the farthest, a group with fewer than
 * MIN_BAND_PEERS merges into the adjacent nearer group; if the nearest is still short, it merges into the next one.
 * Returns, per base band index, its (possibly merged) range; bands without eligible deputies are absent.
 */
function bandsOf(eligibleKm: number[]): Map<number, BandRange> {
  const counts = BASE_BANDS.map(() => 0);
  for (const km of eligibleKm) counts[baseBandOf(km)]++;
  const groups = BASE_BANDS.map((_, i) => ({ members: [i], count: counts[i] })).filter(g => g.count > 0);
  for (let i = groups.length - 1; i > 0; i--) {
    if (groups[i].count >= MIN_BAND_PEERS) continue;
    groups[i - 1] = { members: [...groups[i - 1].members, ...groups[i].members], count: groups[i - 1].count + groups[i].count };
    groups.splice(i, 1);
  }
  if (groups.length > 1 && groups[0].count < MIN_BAND_PEERS) {
    groups.splice(0, 2, { members: [...groups[0].members, ...groups[1].members], count: groups[0].count + groups[1].count });
  }
  const result = new Map<number, BandRange>();
  for (const { members } of groups) {
    const range = { from: BASE_BANDS[members[0]].from, to: BASE_BANDS[members[members.length - 1]].to };
    for (const i of members) result.set(i, range);
  }
  return result;
}

export function analyzeTravel(
  deputies: TravelDeputyInput[],
  legs: Leg[],
  windowMonths: string[],
  endpoints: EndpointTable = {},
): TravelAnalysis {
  const legsByDeputy = new Map<string, Leg[]>();
  for (const leg of legs) {
    const list = legsByDeputy.get(leg.deputyId) ?? [];
    list.push(leg);
    legsByDeputy.set(leg.deputyId, list);
  }

  const base = deputies.map(deputy => {
    const office = new Set(monthsInOffice(windowMonths, deputy.fechaInicio));
    const own = (legsByDeputy.get(deputy.id) ?? []).filter(leg => office.has(leg.period));
    const bySemester: Record<string, number> = {};
    for (const leg of own) bySemester[semesterOf(leg.period)] = (bySemester[semesterOf(leg.period)] ?? 0) + 1;
    const months = office.size;
    // the home uses every leg of the deputy, also outside the office months, to read the habitual route
    const home = estimateHome(deputy.lugar, legsByDeputy.get(deputy.id) ?? [], endpoints);
    return {
      deputyId: deputy.id,
      region: regionOf(deputy.lugar),
      homeKm: home ? Math.round(home.km) : null,
      homeSource: home?.source ?? null,
      legs: own.length,
      months,
      rate: months ? own.length / months : 0,
      eligible: months >= MIN_MONTHS,
      topRoute: topRouteOf(own),
      bySemester,
    };
  });

  const merged = bandsOf(base.filter(d => d.eligible && d.homeKm !== null).map(d => d.homeKm!));
  const bandOf = (km: number | null) => {
    if (km === null) return null;
    const i = baseBandOf(km);
    return bandLabel(merged.get(i) ?? BASE_BANDS[i]);
  };
  const withBand = base.map(d => ({ ...d, band: bandOf(d.homeKm) }));

  const zById = new Map<string, number>();
  const bands: BandSummary[] = [];
  const medianByBand = new Map<string, number>();
  for (const band of [...new Set([...merged.values()].map(bandLabel))]) {
    const peers = withBand.filter(d => d.band === band && d.eligible);
    const rates = peers.map(d => d.rate);
    const med = median(rates);
    medianByBand.set(band, med);
    modifiedZScores(rates).forEach((z, i) => zById.set(peers[i].deputyId, z));
    bands.push({ band, deputies: peers.length, medianLegsPerMonth: round(med), medianKm: Math.round(median(peers.map(d => d.homeKm!))) });
  }

  return {
    deputies: withBand.map(({ rate, ...d }) => {
      const z = zById.get(d.deputyId);
      const bandMedian = d.band ? medianByBand.get(d.band) : undefined;
      return {
        deputyId: d.deputyId,
        region: d.region,
        band: d.band,
        homeKm: d.homeKm,
        homeSource: d.homeSource,
        legs: d.legs,
        months: d.months,
        legsPerMonth: round(rate),
        bandMedian: bandMedian === undefined ? null : round(bandMedian),
        z: z === undefined ? null : round(z),
        flagged: z !== undefined && z > Z_THRESHOLD,
        eligible: d.eligible,
        topRoute: d.topRoute,
        bySemester: d.bySemester,
      };
    }),
    bands,
  };
}
