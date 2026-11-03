// Build-time data loading. Runs in Node during `astro build`/`astro dev`, so CORS does not apply.
import endpointsData from '../data/endpoints.json';
import snapshot from '../data/senadores.json';
import type { EndpointTable } from './distance.ts';
import {
  normalizeDeputy,
  normalizeSenator,
  parseConcepts,
  parseCsv,
  summarizePay,
  type Concept,
  type Deputy,
  type PaySummary,
  type Row,
  type Senator,
} from './legislators.ts';
import { buildTravelReport, type TravelReport } from './travel-report.ts';
import { normalizeTripRows } from './viajes.ts';

const HCDN_API = 'https://datos.hcdn.gob.ar/api/3/action/package_show?id=';
export const SENATE_API = 'https://www.senado.gob.ar/micrositios/DatosAbiertos/ExportarListadoSenadores/json';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} - ${url}`);
  return response.text();
}

async function csvResourceList(packageId: string): Promise<{ name: string; url: string }[]> {
  const data = JSON.parse(await fetchText(HCDN_API + packageId));
  return (data.result.resources as { name: string; format?: string; url: string }[])
    .filter(r => (r.format ?? '').toUpperCase() === 'CSV')
    .map(({ name, url }) => ({ name, url }));
}

// Resource URLs change with every dataset version, so resolve them by name.
async function csvResources(packageId: string): Promise<Record<string, string>> {
  return Object.fromEntries((await csvResourceList(packageId)).map(r => [r.name, r.url]));
}

export async function loadDeputies(): Promise<Deputy[]> {
  const url = (await csvResources('legisladores'))['Composición Actual de la Cámara'];
  if (!url) throw new Error('HCDN: resource "Composición Actual de la Cámara" not found');
  return parseCsv(await fetchText(url)).map(normalizeDeputy).sort(byName);
}

export interface PayData {
  summary: PaySummary;
  adicionales: Concept[];
}

export async function loadPay(): Promise<PayData> {
  const urls = await csvResources('dietas-y-gastos-de-representacion-legisladores-as');
  const load = async (name: string) => (urls[name] ? parseConcepts(await fetchText(urls[name])) : []);
  const [remuneraciones, descuentos, desarraigo, movilidad] = await Promise.all(
    ['Remuneraciones', 'Descuentos', 'Desarraigo', 'Movilidad'].map(load),
  );
  if (remuneraciones.length === 0) throw new Error('HCDN: no remuneraciones found');
  return { summary: summarizePay(remuneraciones, descuentos), adicionales: [...desarraigo, ...movilidad] };
}

export interface SenatorsData {
  senators: Senator[];
  // null when the list came live from the Senate API
  snapshotDate: string | null;
}

export async function loadSenators(): Promise<SenatorsData> {
  try {
    const rows = JSON.parse(await fetchText(SENATE_API))?.table?.rows as Row[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('unexpected Senate response');
    return { senators: rows.map(normalizeSenator).sort(byName), snapshotDate: null };
  } catch (error) {
    console.warn(`[senado] live API failed (${(error as Error).message}); using snapshot from ${snapshot.fecha}`);
    return { senators: (snapshot.rows as Row[]).map(normalizeSenator).sort(byName), snapshotDate: snapshot.fecha };
  }
}

// Downloads every CSV of the dataset: the window is chosen by the periods inside the files, not by their names.
// Any failure stops the build, so the Viajes tab is never published empty.
export async function loadTravel(deputies: Deputy[]): Promise<TravelReport> {
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
}

function byName(a: { nombre: string }, b: { nombre: string }) {
  return a.nombre.localeCompare(b.nombre, 'es');
}
