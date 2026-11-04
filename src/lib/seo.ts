// Search and share metadata: per-page descriptions, schema.org JSON-LD, the sitemap and robots.txt.
// Pure helpers; the pages pass their own numbers, so every description says only what the page shows.
import { titleCase, type Camara } from './entities.ts';
import { formatNumber, formatShare } from './view.ts';

export const SITE_NAME = 'Congreso Abierto';
// search engines cut descriptions around 155-160 characters
export const DESCRIPTION_MAX = 160;

const count = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;
const list = (parts: string[]) => (parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`);

// The first candidate under the limit, or the last one cut at a word with an ellipsis.
function fit(candidates: string[]): string {
  const found = candidates.find(text => text.length < DESCRIPTION_MAX);
  if (found) return found;
  const last = candidates.at(-1)!;
  const cut = last.slice(0, DESCRIPTION_MAX - 2);
  const space = cut.lastIndexOf(' ');
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s,.:;(]+$/, '')}…`;
}

// The Senate list spells names in capitals ("ABAD, MAXIMILIANO"); show them like the deputies' list.
export const displayName = (nombre: string) => (/\p{Ll}/u.test(nombre) ? nombre.trim() : titleCase(nombre));

const nameParts = (nombre: string) => {
  const [familyName = '', givenName = ''] = displayName(nombre).split(',').map(part => part.trim());
  return { familyName, givenName };
};

// "Yedlin, Pablo Raúl" -> "PY", like the ficha header
export function initials(nombre: string): string {
  const { familyName, givenName } = nameParts(nombre);
  return `${givenName.charAt(0)}${familyName.charAt(0)}`.toLocaleUpperCase('es');
}

export interface DeputySeo {
  nombre: string;
  distrito: string | null;
  bloc: string;
  // null when the travel source does not cover the deputy
  legs: number | null;
  bills: number;
  committees: number;
}

// "Yedlin, Pablo Raúl, diputado/a por Tucumán (bloque Independencia): 185 tramos de viaje, 69 proyectos y 7 comisiones. …"
export function deputyDescription(d: DeputySeo): string {
  const who = `${displayName(d.nombre)}, ${d.distrito ? `diputado/a por ${d.distrito}` : 'diputado/a nacional'}`;
  const facts = list([
    ...(d.legs === null ? [] : [count(d.legs, 'tramo de viaje', 'tramos de viaje')]),
    count(d.bills, 'proyecto', 'proyectos'),
    count(d.committees, 'comisión', 'comisiones'),
  ]);
  return fit([
    `${who} (bloque ${d.bloc}): ${facts}. Con fuente oficial y período.`,
    `${who} (bloque ${d.bloc}): ${facts}.`,
    `${who}: ${facts}. Con fuente oficial y período.`,
    `${who}: ${facts}.`,
  ]);
}

export interface SenatorSeo {
  nombre: string;
  provincia: string | null;
  bloc: string;
  // null when the senator has no votes in the actas of the period
  actas: number | null;
  asistencia: number | null;
  bills: number;
}

export function senatorDescription(s: SenatorSeo): string {
  const who = `${displayName(s.nombre)}, ${s.provincia ? `senador/a por ${s.provincia}` : 'senador/a nacional'}`;
  const facts = list([
    ...(s.actas === null ? [] : [count(s.actas, 'acta', 'actas')]),
    ...(s.asistencia === null ? [] : [`${formatShare(s.asistencia)} de asistencia`]),
    count(s.bills, 'proyecto', 'proyectos'),
  ]);
  return fit([
    `${who} (bloque ${s.bloc}): ${facts}. Con fuente oficial.`,
    `${who} (bloque ${s.bloc}): ${facts}.`,
    `${who}: ${facts}. Con fuente oficial.`,
    `${who}: ${facts}.`,
  ]);
}

export function blocDescription(b: { titulo: string; camara: Camara; seats: number; chamberSeats: number; districts: number }): string {
  const head = `Bloque ${b.titulo} en ${b.camara === 'diputados' ? 'Diputados' : 'el Senado'}: ${formatNumber(b.seats)} de ${count(b.chamberSeats, 'banca', 'bancas')}, de ${count(b.districts, 'distrito', 'distritos')}.`;
  const topics = b.camara === 'diputados' ? 'Integrantes, comisiones, proyectos y viajes' : 'Integrantes, proyectos y votaciones';
  return fit([`${head} ${topics}, con fuente oficial y período.`, head]);
}

export function provinceDescription(p: { nombre: string; deputies: number; senators: number }): string {
  const head = `${p.nombre}: ${count(p.deputies, 'diputado', 'diputados')} y ${count(p.senators, 'senador', 'senadores')} nacionales`;
  return fit([`${head}, con sus bloques, viajes, comisiones, proyectos y votaciones. Con fuente oficial y período.`, `${head}.`]);
}

export function committeeDescription(c: { titulo: string; tipo: 'permanente' | 'especial' | null; integrantes: number; blocs: number; districts: number }): string {
  const kind = c.tipo ? `comisión ${c.tipo} de Diputados` : 'comisión de Diputados';
  const facts = c.integrantes > 0
    ? `: ${count(c.integrantes, 'integrante', 'integrantes')} de ${count(c.blocs, 'bloque', 'bloques')} y ${count(c.districts, 'distrito', 'distritos')}.`
    : '.';
  return fit([`${c.titulo}, ${kind}${facts} Autoridades e integrantes, con fuente oficial.`, `${c.titulo}, ${kind}${facts}`]);
}

export type Topic = 'diputados' | 'senado' | 'proyectos' | 'viajes';

// diputados: deputies in office; senado: senators and actas; proyectos: bills of deputies in office; viajes: missions.
export function topicDescription(topic: Topic, n: number, actas = 0): string {
  switch (topic) {
    case 'diputados':
      return fit([`Los ${formatNumber(n)} diputados y diputadas nacionales en funciones: bloque, distrito, comisiones, proyectos y viajes de cada uno, con fuente oficial.`]);
    case 'senado':
      return fit([`Los ${formatNumber(n)} senadores y senadoras en funciones: asistencia, lealtad al bloque y cohesión de cada bloque en ${count(actas, 'acta', 'actas')} del Senado.`]);
    case 'proyectos':
      return fit([`${count(n, 'proyecto presentado', 'proyectos presentados')} por los diputados y diputadas en funciones como primer firmante: hasta qué etapa llegaron y quiénes presentan más.`]);
    case 'viajes':
      return fit([`Tramos de viaje por mes de cada diputado/a frente a sus pares a distancia similar de Buenos Aires, y ${count(n, 'misión oficial', 'misiones oficiales')} al exterior.`]);
  }
}

// --- URLs ---------------------------------------------------------------------------

// Root-relative path -> absolute URL under `site` (keeping a base path); unchanged without a site.
export function absoluteUrl(site: URL | undefined, path: string): string {
  if (!site) return path;
  const base = new URL(site.href.endsWith('/') ? site.href : `${site.href}/`);
  return new URL(path.replace(/^\//, ''), base).href;
}

// /diputados/<id>/ -> /og/diputados/<id>.png; null for every page without its own share image
export function shareImagePath(pathname: string): string | null {
  const match = /^\/(diputados|senadores)\/([^/]+)\/?$/.exec(pathname);
  return match ? `/og/${match[1]}/${match[2]}.png` : null;
}

// "./diputados/index.astro" -> "/diputados/"; null for dynamic routes and error pages
export function staticPagePath(moduleKey: string): string | null {
  const route = moduleKey.replace(/^\.\//, '').replace(/\.astro$/, '');
  if (route.includes('[') || /^(404|500)$/.test(route)) return null;
  const path = route === 'index' ? '' : route.replace(/(^|\/)index$/, '');
  return path ? `/${path}/` : '/';
}

const xmlEscape = (value: string) =>
  value.replace(/[<>&'"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]!);

// lastmod is a YYYY-MM-DD day (the data snapshot), or null to leave it out
export function sitemapXml(site: URL | undefined, paths: string[], lastmod: string | null): string {
  const urls = [...new Set(paths.map(path => absoluteUrl(site, path)))].sort();
  const rows = urls.map(url => `<url><loc>${xmlEscape(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>\n`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('')}</urlset>\n`;
}

export const robotsTxt = (site: URL | undefined) => `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(site, '/sitemap.xml')}\n`;

// --- JSON-LD ------------------------------------------------------------------------

type JsonLd = Record<string, unknown>;

const CHAMBERS: Record<Camara, { name: string; url: string; jobTitle: string }> = {
  diputados: { name: 'Cámara de Diputados de la Nación Argentina', url: 'https://www.hcdn.gob.ar/', jobTitle: 'Diputado/a nacional' },
  senado: { name: 'Senado de la Nación Argentina', url: 'https://www.senado.gob.ar/', jobTitle: 'Senador/a nacional' },
};

export function personJsonLd(
  site: URL | undefined,
  p: { camara: Camara; nombre: string; url: string; bloc: { titulo: string; url: string }; province: string | null },
): JsonLd {
  const { familyName, givenName } = nameParts(p.nombre);
  const chamber = CHAMBERS[p.camara];
  const area = p.province ? { '@type': 'AdministrativeArea', name: p.province } : undefined;
  const image = shareImagePath(p.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: [givenName, familyName].filter(Boolean).join(' '),
    givenName: givenName || undefined,
    familyName,
    jobTitle: chamber.jobTitle,
    url: absoluteUrl(site, p.url),
    image: image ? absoluteUrl(site, image) : undefined,
    memberOf: [
      { '@type': 'GovernmentOrganization', name: chamber.name, url: chamber.url },
      { '@type': 'Organization', name: `Bloque ${p.bloc.titulo}`, url: absoluteUrl(site, p.bloc.url) },
    ],
    workLocation: area,
    areaServed: area,
  };
}

// Home: the site and its publisher. No SearchAction: the search runs in the page and has no results URL.
export function siteJsonLd(site: URL | undefined, description: string): JsonLd {
  const url = absoluteUrl(site, '/');
  const organization = `${url}#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${url}#website`, name: SITE_NAME, url, description, inLanguage: 'es-AR', publisher: { '@id': organization } },
      { '@type': 'Organization', '@id': organization, name: SITE_NAME, url, logo: absoluteUrl(site, '/apple-touch-icon.png') },
    ],
  };
}

// For <script type="application/ld+json" set:html>: "<" as \u003c, so no value can close the script.
export const jsonLdScript = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
