// Estimated distance from each deputy's home to Buenos Aires, from the trip endpoints or the district capital.
import { normalizeText } from './legislators.ts';
import { repairMojibake } from './linkage.ts';

export type EndpointKind = 'airport' | 'bus';

export interface Endpoint {
  lat: number;
  lon: number;
  provincia: string;
  kind: EndpointKind;
  // Buenos Aires terminals (Aeroparque, Ezeiza, Retiro...): never a deputy's home
  hub?: boolean;
}

export type EndpointTable = Record<string, Endpoint>;

export interface HomeLeg {
  origen: string;
  destino: string;
}

export interface Home {
  lat: number;
  lon: number;
  km: number;
  source: 'ruta' | 'capital';
  // endpoint key or capital name
  place: string;
}

export const OBELISCO = { lat: -34.6037, lon: -58.3816 };
export const MIN_HOME_LEGS = 3;

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

// Unrecoverable mojibake ("BAHA?A", "BAHÃA") collapses to the same key, so both spellings share one entry.
export function endpointKey(name: string): string {
  return normalizeText(repairMojibake(name))
    .replace(/[-.,;:()/]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const districtKey = (district: string) => normalizeText(district).trim().replace(/\s+/g, ' ');

// Capital of each of the 24 districts (city centre).
export const CAPITALS: Record<string, { place: string; lat: number; lon: number }> = {
  'ciudad de buenos aires': { place: 'Ciudad de Buenos Aires', lat: -34.6037, lon: -58.3816 },
  'buenos aires': { place: 'La Plata', lat: -34.9214, lon: -57.9545 },
  catamarca: { place: 'San Fernando del Valle de Catamarca', lat: -28.4696, lon: -65.7795 },
  chaco: { place: 'Resistencia', lat: -27.4606, lon: -58.9839 },
  chubut: { place: 'Rawson', lat: -43.3002, lon: -65.1023 },
  cordoba: { place: 'Córdoba', lat: -31.4201, lon: -64.1888 },
  corrientes: { place: 'Corrientes', lat: -27.4692, lon: -58.8306 },
  'entre rios': { place: 'Paraná', lat: -31.7319, lon: -60.5238 },
  formosa: { place: 'Formosa', lat: -26.1849, lon: -58.1731 },
  jujuy: { place: 'San Salvador de Jujuy', lat: -24.1858, lon: -65.2995 },
  'la pampa': { place: 'Santa Rosa', lat: -36.6167, lon: -64.2833 },
  'la rioja': { place: 'La Rioja', lat: -29.4131, lon: -66.8558 },
  mendoza: { place: 'Mendoza', lat: -32.8895, lon: -68.8458 },
  misiones: { place: 'Posadas', lat: -27.3671, lon: -55.8961 },
  neuquen: { place: 'Neuquén', lat: -38.9516, lon: -68.0591 },
  'rio negro': { place: 'Viedma', lat: -40.8135, lon: -62.9967 },
  salta: { place: 'Salta', lat: -24.7821, lon: -65.4232 },
  'san juan': { place: 'San Juan', lat: -31.5375, lon: -68.5364 },
  'san luis': { place: 'San Luis', lat: -33.3017, lon: -66.3378 },
  'santa cruz': { place: 'Río Gallegos', lat: -51.623, lon: -69.2168 },
  'santa fe': { place: 'Santa Fe', lat: -31.6333, lon: -60.7 },
  'santiago del estero': { place: 'Santiago del Estero', lat: -27.7951, lon: -64.2615 },
  'tierra del fuego': { place: 'Ushuaia', lat: -54.8019, lon: -68.303 },
  tucuman: { place: 'San Miguel de Tucumán', lat: -26.8083, lon: -65.2176 },
};

/**
 * Home = the non-hub endpoint inside the deputy's district that the most legs touch (at least MIN_HOME_LEGS),
 * ties broken alphabetically; otherwise the district capital. null when the district is unknown.
 */
export function estimateHome(district: string, legs: HomeLeg[], endpoints: EndpointTable): Home | null {
  const own = districtKey(district);
  const touching = new Map<string, number>();
  for (const leg of legs) {
    for (const key of new Set([endpointKey(leg.origen), endpointKey(leg.destino)])) {
      const endpoint = endpoints[key];
      if (endpoint && !endpoint.hub && districtKey(endpoint.provincia) === own) touching.set(key, (touching.get(key) ?? 0) + 1);
    }
  }
  let best: [string, number] | null = null;
  for (const entry of touching) {
    if (!best || entry[1] > best[1] || (entry[1] === best[1] && entry[0] < best[0])) best = entry;
  }
  if (best && best[1] >= MIN_HOME_LEGS) {
    const { lat, lon } = endpoints[best[0]];
    return { lat, lon, km: haversineKm({ lat, lon }, OBELISCO), source: 'ruta', place: best[0] };
  }
  const capital = CAPITALS[own];
  if (!capital) return null;
  return { lat: capital.lat, lon: capital.lon, km: haversineKm(capital, OBELISCO), source: 'capital', place: capital.place };
}
