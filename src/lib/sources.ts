// Build-time data loading. Runs in Node during `astro build`/`astro dev`, so CORS does not apply.
import snapshot from '../data/senadores.json';
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

const HCDN_API = 'https://datos.hcdn.gob.ar/api/3/action/package_show?id=';
export const SENATE_API = 'https://www.senado.gob.ar/micrositios/DatosAbiertos/ExportarListadoSenadores/json';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} - ${url}`);
  return response.text();
}

// Resource URLs change with every dataset version, so resolve them by name.
async function csvResources(packageId: string): Promise<Record<string, string>> {
  const data = JSON.parse(await fetchText(HCDN_API + packageId));
  const urls: Record<string, string> = {};
  for (const r of data.result.resources as { name: string; format?: string; url: string }[]) {
    if ((r.format ?? '').toUpperCase() === 'CSV') urls[r.name] = r.url;
  }
  return urls;
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

function byName(a: { nombre: string }, b: { nombre: string }) {
  return a.nombre.localeCompare(b.nombre, 'es');
}
