// Build-time data loading. Runs in Node during `astro build`/`astro dev`, so CORS does not apply.
// Every loader is memoized for the whole build, so getStaticPaths and pages share one fetch per source.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import endpointsData from '../data/endpoints.json';
import snapshot from '../data/senadores.json';
import { committeesByDeputy, parseAuthorities, parseCommittees, parseMembers, type CommitteeSummary, type DeputyCommittee } from './comisiones.ts';
import type { EndpointTable } from './distance.ts';
import {
  normalizeDeputy,
  normalizeSenator,
  normalizeText,
  parseConcepts,
  parseCsv,
  summarizePay,
  type Concept,
  type Deputy,
  type PaySummary,
  type Row,
  type Senator,
} from './legislators.ts';
import { createDeputyPolicy, createSenatePolicy, senateIdentities, type LinkQuality, type PolicyLinker } from './link-policy.ts';
import { normalizeMissionRows, summarizeMissions, type DeputyMissions, type Mission } from './misiones.ts';
import { billsByAuthor, furthestStages, parseBills, type AuthorBills } from './proyectos.ts';
import { mapCurrentToHistoric, parseRoster, type RosterPerson } from './roster.ts';
import { buildEntities, type Entities } from './entities.ts';
import {
  actaDetailUrl,
  actaIndexRequest,
  parseActaDetail,
  parseActaIndex,
  summarizeSenateVotes,
  SENADO_ACTAS_URL,
  type ActaDetail,
  type ActaIndexEntry,
  type ActaVote,
  type SenateVotesSummary,
} from './senado-votos.ts';
import { buildTravelReport, type TravelReport } from './travel-report.ts';
import { normalizeTripRows } from './viajes.ts';

const HCDN_API = 'https://datos.hcdn.gob.ar/api/3/action/package_show?id=';
export const SENATE_API = 'https://www.senado.gob.ar/micrositios/DatosAbiertos/ExportarListadoSenadores/json';

// Bills published since the start of the mandates in office today (Dec 2023 / Dec 2025); missions and
// Senate actas from the same year.
export const SOURCES_SINCE = '2024-01-01';
const FIRST_YEAR = 2024;
const SENATE_CACHE = join(process.cwd(), 'src/data/senado-actas.json');
const SENATE_CONCURRENCY = 4;
const SENATE_RETRIES = 2;

const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = memo.get(key) as Promise<T> | undefined;
  if (!promise) memo.set(key, (promise = load()));
  return promise;
}

const today = () => new Date().toISOString().slice(0, 10);

// The current legislative period starts every December 10.
function periodStart(day: string): string {
  const year = Number(day.slice(0, 4));
  return day >= `${year}-12-10` ? `${year}-12-10` : `${year - 1}-12-10`;
}

async function fetchText(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<string> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} - ${url}`);
  return response.text();
}

async function csvResourceList(packageId: string): Promise<{ name: string; url: string }[]> {
  return once(`package:${packageId}`, async () => {
    let data;
    try {
      data = JSON.parse(await fetchText(HCDN_API + packageId));
    } catch (error) {
      throw new Error(`HCDN: could not load dataset "${packageId}": ${(error as Error).message}`);
    }
    return (data.result.resources as { name: string; format?: string; url: string }[])
      .filter(r => (r.format ?? '').toUpperCase() === 'CSV')
      .map(({ name, url }) => ({ name, url }));
  });
}

// Resource URLs change with every dataset version, so resolve them by name.
async function csvResources(packageId: string): Promise<Record<string, string>> {
  return Object.fromEntries((await csvResourceList(packageId)).map(r => [r.name, r.url]));
}

// Names are compared trimmed and case-insensitive: some carry trailing spaces ("Comisiones Permanentes Autoridades ").
async function csvResource(packageId: string, name: string): Promise<string> {
  const key = normalizeText(name).trim();
  const resource = (await csvResourceList(packageId)).find(r => normalizeText(r.name).trim() === key);
  if (!resource) throw new Error(`HCDN: resource "${name}" not found in dataset "${packageId}"`);
  return resource.url;
}

async function fetchHcdnCsv(label: string, url: string, timeoutMs = 120_000): Promise<string> {
  try {
    return await fetchText(url, {}, timeoutMs);
  } catch (error) {
    throw new Error(`HCDN: could not load ${label}: ${(error as Error).message}`);
  }
}

export function loadDeputies(): Promise<Deputy[]> {
  return once('deputies', async () => {
    const url = (await csvResources('legisladores'))['Composición Actual de la Cámara'];
    if (!url) throw new Error('HCDN: resource "Composición Actual de la Cámara" not found');
    return parseCsv(await fetchText(url)).map(normalizeDeputy).sort(byName);
  });
}

export interface PayData {
  summary: PaySummary;
  adicionales: Concept[];
}

export function loadPay(): Promise<PayData> {
  return once('pay', async () => {
    const urls = await csvResources('dietas-y-gastos-de-representacion-legisladores-as');
    const load = async (name: string) => (urls[name] ? parseConcepts(await fetchText(urls[name])) : []);
    const [remuneraciones, descuentos, desarraigo, movilidad] = await Promise.all(
      ['Remuneraciones', 'Descuentos', 'Desarraigo', 'Movilidad'].map(load),
    );
    if (remuneraciones.length === 0) throw new Error('HCDN: no remuneraciones found');
    return { summary: summarizePay(remuneraciones, descuentos), adicionales: [...desarraigo, ...movilidad] };
  });
}

export interface SenatorsData {
  senators: Senator[];
  // null when the list came live from the Senate API
  snapshotDate: string | null;
}

export function loadSenators(): Promise<SenatorsData> {
  return once('senators', async () => {
    try {
      const rows = JSON.parse(await fetchText(SENATE_API))?.table?.rows as Row[] | undefined;
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('unexpected Senate response');
      return { senators: rows.map(normalizeSenator).sort(byName), snapshotDate: null };
    } catch (error) {
      console.warn(`[senado] live API failed (${(error as Error).message}); using snapshot from ${snapshot.fecha}`);
      return { senators: (snapshot.rows as Row[]).map(normalizeSenator).sort(byName), snapshotDate: snapshot.fecha };
    }
  });
}

// Downloads every CSV of the dataset: the window is chosen by the periods inside the files, not by their names.
// Any failure stops the build, so the Viajes tab is never published empty.
export function loadTravel(deputies: Deputy[]): Promise<TravelReport> {
  return once('travel', async () => {
    const resources = await csvResourceList('viajes-nacionales');
    if (resources.length === 0) throw new Error('HCDN: dataset "viajes-nacionales" has no CSV resources');
    const files = [];
    for (let i = 0; i < resources.length; i += 4) {
      files.push(...(await Promise.all(resources.slice(i, i + 4).map(async ({ name, url }) => {
        try {
          return normalizeTripRows(parseCsv(await fetchText(url)));
        } catch (error) {
          throw new Error(`HCDN: could not load viajes resource "${name}": ${(error as Error).message}`);
        }
      }))));
    }
    return buildTravelReport(deputies, files, endpointsData.endpoints as EndpointTable);
  });
}

// --- Linked sources -------------------------------------------------------------

export interface SourcePeriod {
  // YYYY-MM-DD; null when the source has no dated rows
  desde: string | null;
  hasta: string | null;
}

export interface LinkedSource {
  quality: LinkQuality;
  period: SourcePeriod;
  sources: string[];
}

export interface RosterData {
  people: RosterPerson[];
  url: string;
}

// HCDN historic roster: every deputy with an ID and mandate dates, to link former deputies too.
export function loadRoster(): Promise<RosterData> {
  return once('roster', async () => {
    const url = await csvResource('legisladores', 'Diputados');
    const people = parseRoster(await fetchHcdnCsv('roster "Diputados"', url));
    if (people.length === 0) throw new Error('HCDN: roster "Diputados" has no rows');
    return { people, url };
  });
}

export interface CurrentDeputyMap {
  byDeputyId: Map<string, string>;
  unmapped: { id: string; nombre: string; lugar: string }[];
}

// Composition id -> roster id for the deputies in office today.
export function loadCurrentDeputyMap(deputies: Deputy[]): Promise<CurrentDeputyMap> {
  return once('deputy-map', async () => mapCurrentToHistoric(deputies, (await loadRoster()).people, today()));
}

async function deputyPolicy(deputies: Deputy[], from: string, to: string): Promise<PolicyLinker> {
  const [{ people }, { byDeputyId }] = await Promise.all([loadRoster(), loadCurrentDeputyMap(deputies)]);
  return createDeputyPolicy(people, { from, to }, deputies, byDeputyId);
}

export interface CommitteesData extends LinkedSource {
  byDeputy: Map<string, DeputyCommittee[]>;
  committees: Map<string, CommitteeSummary>;
  // committee ids with members but missing from the committees list
  unknownCommittees: string[];
}

// The files describe today's committees: linked against the deputies of the current legislative period.
export function loadCommittees(deputies: Deputy[]): Promise<CommitteesData> {
  return once('committees', async () => {
    const urls = await Promise.all(
      ['Comisiones', 'Comisiones Permanentes - integrantes', 'Comisiones Permanentes Autoridades'].map(name => csvResource('comisiones', name)),
    );
    const [committeesCsv, membersCsv, authoritiesCsv] = await Promise.all(urls.map((url, i) => fetchHcdnCsv(`comisiones resource #${i + 1}`, url)));
    const period = { desde: periodStart(today()), hasta: today() };
    const policy = await deputyPolicy(deputies, period.desde, period.hasta);
    const report = committeesByDeputy(parseCommittees(committeesCsv), parseMembers(membersCsv), parseAuthorities(authoritiesCsv), policy.linkFn);
    return {
      byDeputy: report.byDeputy,
      committees: report.committees,
      unknownCommittees: report.quality.unknownCommittees,
      quality: policy.quality(),
      period,
      sources: urls,
    };
  });
}

export interface BillsData {
  // current deputy ids (Diputados-origin bills) and current senator ids (Senado-origin bills)
  byLegislator: Map<string, AuthorBills>;
  quality: { diputados: LinkQuality; senado: LinkQuality };
  bills: { linked: number; total: number };
  period: SourcePeriod;
  sources: string[];
}

export function loadBills(deputies: Deputy[], senators: Senator[]): Promise<BillsData> {
  return once('bills', async () => {
    const urls = await Promise.all([
      csvResource('proyectos-parlamentarios', 'Proyectos Parlamentarios'),
      csvResource('movimientos-de-proyectos', 'Movimientos de proyectos'),
    ]);
    const bills = parseBills(await fetchHcdnCsv('proyectos parlamentarios', urls[0]), { since: SOURCES_SINCE });
    if (bills.length === 0) throw new Error(`HCDN: no bills published since ${SOURCES_SINCE}`);
    const stages = furthestStages(await fetchHcdnCsv('movimientos de proyectos', urls[1]), new Set(bills.map(b => b.id)));
    const fechas = bills.map(b => b.fecha).sort();
    const period = { desde: fechas[0], hasta: fechas.at(-1)! };
    const diputados = await deputyPolicy(deputies, period.desde, period.hasta);
    // Former senators of the period are known from the vote records.
    const senado = createSenatePolicy(senators, senateIdentities(latestVotes((await loadSenateActas()).actas), senators).former);
    const { byLegislator, quality } = billsByAuthor(bills, stages, (autor, bill) =>
      bill.camaraOrigen === 'Senado' ? senado.linkFn(autor) : diputados.linkFn(autor),
    );
    return {
      byLegislator,
      quality: { diputados: diputados.quality(), senado: senado.quality() },
      bills: quality.bills,
      period,
      sources: urls,
    };
  });
}

export interface MissionsData extends LinkedSource {
  deputies: DeputyMissions[];
  missions: number;
}

const resourceYear = (name: string) => Number(name.match(/\b(20\d{2})\b/)?.[1] ?? 0);

// One CSV per semester (or year in older files); every file named with a year since FIRST_YEAR.
export function loadMissions(deputies: Deputy[]): Promise<MissionsData> {
  return once('missions', async () => {
    const resources = (await csvResourceList('misiones-oficiales')).filter(r => resourceYear(r.name) >= FIRST_YEAR);
    if (resources.length === 0) throw new Error(`HCDN: dataset "misiones-oficiales" has no CSV since ${FIRST_YEAR}`);
    const files = await Promise.all(resources.map(async ({ name, url }) =>
      normalizeMissionRows(parseCsv(await fetchHcdnCsv(`misiones resource "${name}"`, url)))));
    const missions: Mission[] = files.flat();
    const fechas = missions.flatMap(m => [m.fechaInicio, m.fechaFin]).filter((f): f is string => Boolean(f)).sort();
    const period = { desde: fechas[0] ?? null, hasta: fechas.at(-1) ?? null };
    const policy = await deputyPolicy(deputies, period.desde ?? SOURCES_SINCE, period.hasta ?? today());
    const summary = summarizeMissions(missions, raw => policy.linkFn(raw));
    return { deputies: summary.deputies, missions: missions.length, quality: policy.quality(), period, sources: resources.map(r => r.url) };
  });
}

// --- Senate votes -----------------------------------------------------------------

interface SenateCache {
  // YYYY-MM-DD of the last update that added actas
  fecha: string | null;
  actas: Record<string, ActaDetail>;
}

// Votes are stored as tuples to keep the committed file small.
type StoredVote = [nombre: string, senadorId: number | null, bloque: string, provincia: string, voto: string];
type StoredActa = Omit<ActaDetail, 'votos'> & { votos: StoredVote[] };
const VOTE_FORMAT = '[nombre, senadorId, bloque, provincia, voto]';

export interface SenateActasData {
  actas: ActaDetail[];
  // true when the Senate site failed and the committed cache was used
  stale: boolean;
  cacheDate: string | null;
  fetched: number;
}

const cancelled = (resultado: string) => normalizeText(resultado).trim().startsWith('cancelada');

function readSenateCache(): SenateCache {
  if (!existsSync(SENATE_CACHE)) return { fecha: null, actas: {} };
  const data = JSON.parse(readFileSync(SENATE_CACHE, 'utf8')) as { fecha?: string | null; actas?: Record<string, StoredActa> };
  const actas: Record<string, ActaDetail> = {};
  for (const [id, acta] of Object.entries(data.actas ?? {})) {
    const votos = acta.votos.map(([nombre, senadorId, bloque, provincia, voto]): ActaVote => ({ nombre, senadorId, bloque, provincia, voto }));
    actas[id] = { ...acta, votos };
  }
  return { fecha: data.fecha ?? null, actas };
}

// One acta per line keeps the committed file diffable.
function writeSenateCache(cache: SenateCache) {
  const ids = Object.keys(cache.actas).sort((a, b) => Number(a) - Number(b));
  const lines = ids.map(id => {
    const { votos, ...acta } = cache.actas[id];
    const stored: StoredActa = { ...acta, votos: votos.map(v => [v.nombre, v.senadorId, v.bloque, v.provincia, v.voto]) };
    return `${JSON.stringify(id)}:${JSON.stringify(stored)}`;
  });
  const head = `"fuente":${JSON.stringify(SENADO_ACTAS_URL)},"fecha":${JSON.stringify(cache.fecha)},"votos":${JSON.stringify(VOTE_FORMAT)}`;
  writeFileSync(SENATE_CACHE, `{${head},"actas":{\n${lines.join(',\n')}\n}}\n`);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchSenate(url: string, init: RequestInit = {}): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchText(url, init, 30_000);
    } catch (error) {
      if (attempt >= SENATE_RETRIES) throw error;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

async function pool<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  }));
  return results;
}

// Fetches the index of every year since FIRST_YEAR and only the details missing from the committed cache.
// If the Senate site fails, the cache is used as is and the result is marked stale.
export function loadSenateActas(): Promise<SenateActasData> {
  return once('senate-actas', async () => {
    const cache = readSenateCache();
    const cachedSince = () =>
      Object.values(cache.actas).filter(a => !cancelled(a.resultado) && (a.fecha ?? '') >= SOURCES_SINCE).sort(byActa);
    let fetched = 0;
    try {
      const years = Array.from({ length: new Date().getFullYear() - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
      const index: ActaIndexEntry[] = [];
      for (const year of years) {
        const { url, method, headers, body } = actaIndexRequest(year);
        const entries = parseActaIndex(await fetchSenate(url, { method, headers, body }));
        // A past year with no actas means the page changed; the current one may not have any yet.
        if (entries.length === 0 && year < years.at(-1)!) throw new Error(`Senate index ${year}: no actas found`);
        index.push(...entries);
      }
      const wanted = index.filter(e => e.detalle && !cancelled(e.resultado));
      const missing = wanted.filter(e => !cache.actas[e.id]);
      try {
        await pool(missing, SENATE_CONCURRENCY, async entry => {
          cache.actas[entry.id] = parseActaDetail(await fetchSenate(actaDetailUrl(entry.id)), entry.id);
          fetched++;
        });
      } finally {
        // Keep every detail fetched, even when a later one failed.
        if (fetched > 0) {
          cache.fecha = today();
          writeSenateCache(cache);
        }
      }
      const actas = wanted.map(e => cache.actas[e.id]).filter(a => !cancelled(a.resultado)).sort(byActa);
      return { actas, stale: false, cacheDate: cache.fecha, fetched };
    } catch (error) {
      if (Object.keys(cache.actas).length === 0) throw new Error(`Senado: actas unavailable and no cache: ${(error as Error).message}`);
      console.warn(`[senado] actas fetch failed (${(error as Error).message}); using cache from ${cache.fecha}`);
      return { actas: cachedSince(), stale: true, cacheDate: cache.fecha, fetched };
    }
  });
}

const byActa = (a: ActaDetail, b: ActaDetail) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.id - b.id;

// Every vote row, latest acta first, so the latest spelling of a name wins.
const latestVotes = (actas: ActaDetail[]) => [...actas].reverse().flatMap(a => a.votos);

export interface SenateVotesData extends LinkedSource {
  summary: SenateVotesSummary;
  actas: number;
  stale: boolean;
  cacheDate: string | null;
}

export function loadSenateVotes(senators: Senator[]): Promise<SenateVotesData> {
  return once('senate-votes', async () => {
    const { actas, stale, cacheDate } = await loadSenateActas();
    const { former, idOf } = senateIdentities(latestVotes(actas), senators);
    const policy = createSenatePolicy(senators, former, idOf);
    const summary = summarizeSenateVotes(actas, (nombre, provincia) => policy.linkFn(nombre, provincia));
    return {
      summary,
      actas: actas.length,
      stale,
      cacheDate,
      quality: policy.quality(),
      period: { desde: summary.periodo.desde, hasta: summary.periodo.hasta },
      sources: [SENADO_ACTAS_URL],
    };
  });
}

function byName(a: { nombre: string }, b: { nombre: string }) {
  return a.nombre.localeCompare(b.nombre, 'es');
}

// Every entity page (blocs, provinces, committees, legislators, home) shares one build of the indexes.
export function loadEntities(): Promise<Entities> {
  return once('entities', async () => {
    const [deputies, { senators }, pay] = await Promise.all([loadDeputies(), loadSenators(), loadPay()]);
    const [travel, committees, bills, missions, senateVotes] = await Promise.all([
      loadTravel(deputies),
      loadCommittees(deputies),
      loadBills(deputies, senators),
      loadMissions(deputies),
      loadSenateVotes(senators),
    ]);
    return buildEntities({ asOf: today(), deputies, senators, pay: pay.summary, travel, committees, bills, missions, senateVotes });
  });
}
