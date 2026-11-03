// Pure assembly of the travel tab: picks the window, links trip names and measures the linkage quality.
import { normalizeText } from './legislators.ts';
import { createLinker, type LinkableDeputy, type LinkResult, type LinkStatus } from './linkage.ts';
import { analyzeTravel, type Leg, type TravelAnalysis, type TravelDeputyInput, type TripRow } from './viajes.ts';

export type ReportDeputy = LinkableDeputy & TravelDeputyInput;

export interface LinkCounts {
  matched: number;
  doubtful: number;
  unmatched: number;
  total: number;
  // share of distinct names matched, 0-100 with one decimal
  percent: number;
}

export interface DoubtfulName {
  nombre: string;
  provincia: string;
  candidates: { nombre: string; lugar: string; confidence: number }[];
}

export interface TravelQuality {
  overall: LinkCounts;
  latest: LinkCounts;
  legs: { linked: number; total: number; percent: number };
  doubtful: DoubtfulName[];
}

export interface TravelReport {
  analysis: TravelAnalysis;
  semesters: string[];
  windowMonths: string[];
  windowLabel: string;
  latestLabel: string;
  quality: TravelQuality;
}

export const WINDOW_SEMESTERS = 4;

const semesterOf = (period: string) => `${period.slice(0, 4)}-S${Number(period.slice(5, 7)) <= 6 ? 1 : 2}`;

export function semesterLabel(semester: string): string {
  return `${semester.slice(6)}.º semestre ${semester.slice(0, 4)}`;
}

const percent = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const nameKey = (nombre: string) => normalizeText(nombre).replace(/\s+/g, ' ').trim();

// A name seen with several PROVINCIA values keeps its worst outcome: any doubtful row makes it doubtful.
const RANK: Record<LinkStatus, number> = { unmatched: 0, matched: 1, doubtful: 2 };

function countNames(rows: { nombre: string; result: LinkResult }[]): LinkCounts {
  const byName = new Map<string, LinkStatus>();
  for (const { nombre, result } of rows) {
    const key = nameKey(nombre);
    const current = byName.get(key);
    if (!current || RANK[result.status] > RANK[current]) byName.set(key, result.status);
  }
  const counts = { matched: 0, doubtful: 0, unmatched: 0 };
  for (const status of byName.values()) counts[status]++;
  return { ...counts, total: byName.size, percent: percent(counts.matched, byName.size) };
}

// Each semester comes from the one file with the most rows for it, so a republished file is not counted twice.
function rowsBySemester(files: TripRow[][]): Map<string, TripRow[]> {
  const chosen = new Map<string, TripRow[]>();
  for (const file of files) {
    const own = new Map<string, TripRow[]>();
    for (const row of file) {
      const semester = semesterOf(row.period);
      own.set(semester, [...(own.get(semester) ?? []), row]);
    }
    for (const [semester, rows] of own) {
      if (rows.length > (chosen.get(semester)?.length ?? 0)) chosen.set(semester, rows);
    }
  }
  return chosen;
}

export function buildTravelReport(
  deputies: ReportDeputy[],
  files: TripRow[][],
  semesterCount = WINDOW_SEMESTERS,
): TravelReport {
  const bySemester = rowsBySemester(files);
  const semesters = [...bySemester.keys()].sort().slice(-semesterCount);
  if (!semesters.length) throw new Error('Viajes: no trip rows with a valid period');
  const latest = semesters[semesters.length - 1];

  const linker = createLinker(deputies);
  const byId = new Map(deputies.map(d => [d.id, d]));
  const linked = semesters.flatMap(semester =>
    bySemester.get(semester)!.map(row => ({ row, semester, nombre: row.nombre, result: linker.link(row.nombre, row.provincia) })),
  );

  const legs: Leg[] = linked
    .filter(({ result }) => result.status === 'matched')
    .map(({ row, result }) => ({ deputyId: result.deputyId!, period: row.period, tipo: row.tipo, origen: row.origen, destino: row.destino }));
  const windowMonths = [...new Set(linked.map(({ row }) => row.period))].sort();

  const doubtful = new Map<string, DoubtfulName>();
  for (const { row, result } of linked) {
    const provincia = row.provincia ?? '';
    const key = `${nameKey(row.nombre)}\u0000${nameKey(provincia)}`;
    if (result.status !== 'doubtful' || doubtful.has(key)) continue;
    doubtful.set(key, {
      nombre: row.nombre,
      provincia,
      candidates: result.candidates.map(c => ({ nombre: byId.get(c.id)?.nombre ?? c.id, lugar: byId.get(c.id)?.lugar ?? '', confidence: c.confidence })),
    });
  }

  return {
    analysis: analyzeTravel(deputies, legs, windowMonths),
    semesters,
    windowMonths,
    windowLabel: `${semesterLabel(semesters[0])} – ${semesterLabel(latest)}`,
    latestLabel: semesterLabel(latest),
    quality: {
      overall: countNames(linked),
      latest: countNames(linked.filter(l => l.semester === latest)),
      legs: { linked: legs.length, total: linked.length, percent: percent(legs.length, linked.length) },
      doubtful: [...doubtful.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    },
  };
}
