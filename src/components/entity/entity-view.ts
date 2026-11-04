// Pure helpers for the bloc, province and committee pages: dot plot rows, S4 travel wording, the bloc mix bar
// and the client filter text. Shared by the pages and their tests.
import type { BandMedian, BlocRef, Camara, TravelPoint } from '../../lib/entities.ts';
import { normalizeText } from '../../lib/legislators.ts';
import { formatNumber, type TravelStatus } from '../../lib/view.ts';
import { MIN_MONTHS } from '../../lib/viajes.ts';

export const chamberLabel = (camara: Camara) => (camara === 'diputados' ? 'Diputados' : 'Senado');

// The committees list publishes some ids without a name (HCDN00064): say so instead of showing the id as a name.
export function committeeTitle(id: string, titulo: string): string {
  const plain = (value: string) => normalizeText(value).replace(/[^a-z0-9]/g, '');
  return !titulo.trim() || plain(titulo) === plain(id) ? `Comisión sin nombre publicado (${id})` : titulo;
}

// Short labels for the member tables; S4: describe, never judge.
export const TRAVEL_STATUS: Record<TravelStatus, { label: string; tone: 'ok' | 'flag' | 'default' }> = {
  'en-linea': { label: 'En línea con sus pares', tone: 'ok' },
  'viaja-mas': { label: 'Viaja bastante más que sus pares', tone: 'flag' },
  'sin-tramos': { label: 'Sin tramos registrados', tone: 'default' },
  'no-comparado': { label: `No comparado (menos de ${MIN_MONTHS} meses)`, tone: 'default' },
  'sin-distancia': { label: 'No comparado (sin distancia)', tone: 'default' },
};

const COMPARED = new Set<TravelStatus>(['en-linea', 'viaja-mas', 'sin-tramos']);
const surname = (nombre: string) => nombre.split(',')[0].trim();

export interface TravelRow {
  label: string;
  median: number;
  points: { value: number; flag: boolean; label: string | undefined }[];
}

// One dot plot row per distance band that has compared members; the median is the whole chamber's.
export function travelRows(points: TravelPoint[], bands: BandMedian[]): { rows: TravelRow[]; omitted: number } {
  const compared = points.filter(p => COMPARED.has(p.status) && p.band);
  const rows = bands
    .map(band => ({
      label: band.band,
      median: band.median,
      points: compared
        .filter(p => p.band === band.band)
        .map(p => {
          const flag = p.status === 'viaja-mas';
          return { value: p.legsPerMonth, flag, label: flag ? `${surname(p.nombre)} ${formatNumber(p.legsPerMonth)}` : undefined };
        }),
    }))
    .filter(row => row.points.length > 0);
  return { rows, omitted: points.length - compared.length };
}

export function travelTag(counts: Record<TravelStatus, number>): string {
  const notCompared = counts['no-comparado'] + counts['sin-distancia'];
  const parts = [
    counts['en-linea'] && `${counts['en-linea']} en línea`,
    counts['viaja-mas'] && `${counts['viaja-mas']} ${counts['viaja-mas'] === 1 ? 'viaja' : 'viajan'} bastante más que sus pares`,
    counts['sin-tramos'] && `${counts['sin-tramos']} sin tramos registrados`,
    notCompared && `${notCompared} ${notCompared === 1 ? 'no comparado' : 'no comparados'}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Sin datos de viajes';
}

export function flaggedSentence(point: TravelPoint, bands: BandMedian[]): string {
  const median = bands.find(b => b.band === point.band)?.median;
  const against = median === undefined ? '' : ` frente a una mediana de ${formatNumber(median)} en su grupo (${point.band})`;
  return `${point.nombre}: ${formatNumber(point.legsPerMonth)} tramos por mes${against}; viaja bastante más que sus pares a distancia similar.`;
}

export interface Segment {
  label: string;
  count: number;
  // 0-1 of all the members
  share: number;
  color: string;
  url: string | null;
}

// Stacked bar of the blocs in a committee: the `named` largest with their colors, the rest grouped (a single
// leftover bloc keeps its name).
export function blocSegments(mix: (BlocRef & { count: number })[], named = 5): Segment[] {
  const total = mix.reduce((t, b) => t + b.count, 0);
  if (!total) return [];
  const segments: Segment[] = mix.slice(0, named).map((b, i) => ({
    label: b.titulo, count: b.count, share: b.count / total, color: `var(--bloc-${i + 1})`, url: b.url,
  }));
  const rest = mix.slice(named);
  if (rest.length === 1) {
    const [b] = rest;
    segments.push({ label: b.titulo, count: b.count, share: b.count / total, color: 'var(--bloc-other)', url: b.url });
  } else if (rest.length) {
    const count = rest.reduce((t, b) => t + b.count, 0);
    segments.push({ label: `Otros ${rest.length} ${rest.length === 1 ? 'bloque' : 'bloques'}`, count, share: count / total, color: 'var(--bloc-other)', url: null });
  }
  return segments;
}

// Text a row is matched against by the member filter (the client folds the query the same way).
export const searchText = (...values: string[]) => normalizeText(values.join(' ')).replace(/\s+/g, ' ').trim();
