// Pure entity indexes for the relation pages (blocs, provinces, committees), the legislator relation strip,
// the client search index and the home topic cards. Everything is built from already-loaded sources and
// every metric carries its source and period (S3).
import { cargoRank, type CommitteeSummary, type CommitteeType, type DeputyCommittee } from './comisiones.ts';
import { billsProfile, type BillsProfile } from './legislator-profile.ts';
import { normalizeText, type Deputy, type PaySummary, type Senator } from './legislators.ts';
import type { DeputyMissions } from './misiones.ts';
import type { AuthorBills } from './proyectos.ts';
import type { SenateVotesSummary } from './senado-votos.ts';
import type { TravelAnalysis } from './viajes.ts';
import { DATASETS, formatDate, mergeBills, travelStatus, type SourceLink, type TravelStatus } from './view.ts';

export type Camara = 'diputados' | 'senado';

export interface Period {
  // YYYY-MM-DD; null when the source has no dated rows
  desde: string | null;
  hasta: string | null;
}

export interface EntitySources {
  // YYYY-MM-DD of the build: the date of the sources that publish the current state
  asOf: string;
  deputies: Deputy[];
  senators: Senator[];
  pay: PaySummary;
  travel: { analysis: TravelAnalysis; windowLabel: string };
  committees: { byDeputy: Map<string, DeputyCommittee[]>; committees: Map<string, CommitteeSummary>; period: Period };
  // keyed by current deputy and senator ids; other ids (former legislators) are ignored
  bills: { byLegislator: Map<string, AuthorBills>; period: Period };
  missions: { deputies: DeputyMissions[]; period: Period };
  senateVotes: { summary: Pick<SenateVotesSummary, 'senators' | 'blocs'>; actas: number; period: Period };
}

export interface Provenance {
  sources: SourceLink[];
  desde: string | null;
  hasta: string | null;
  // Spanish period, e.g. "03/01/2024 – 06/10/2026" or "vigente al 03/11/2026"
  label: string;
}

// --- Names and slugs ----------------------------------------------------------------

// Dots and apostrophes join letters: "U.C.R." -> "ucr", "D'Alessandro" -> "dalessandro".
export function slugify(value: string): string {
  return normalizeText(value).replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-nombre';
}

// Distinct keys get distinct slugs; keys are taken in code-unit order, so the result does not depend on the input order.
export function uniqueSlugs(items: { key: string; label: string }[]): Map<string, string> {
  const labels = new Map(items.map(i => [i.key, i.label]));
  const taken = new Set<string>();
  const result = new Map<string, string>();
  for (const key of [...labels.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const base = slugify(labels.get(key)!);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    result.set(key, slug);
  }
  return result;
}

const ACRONYMS = new Set(['ucr', 'pro', 'mid', 'pts', 'caba', 'fit', 'uxp', 'pj']);
const JOINERS = new Set(['a', 'al', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'los', 'o', 'para', 'por', 'u', 'y']);

// "UCR - UNIÓN CÍVICA RADICAL" -> "UCR - Unión Cívica Radical". Accents missing in the source stay missing.
export function titleCase(value: string): string {
  let first = true;
  return value
    .trim()
    .split(/([\s\-–/]+)/)
    .map(part => {
      if (!part || /^[\s\-–/]+$/.test(part)) return part;
      const lower = part.toLocaleLowerCase('es');
      const plain = normalizeText(lower).replace(/[^a-z]/g, '');
      const word = ACRONYMS.has(plain)
        ? part.toLocaleUpperCase('es')
        : !first && JOINERS.has(plain)
          ? lower
          : lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
      first = false;
      return word;
    })
    .join('');
}

// Names compared case- and accent-insensitive; punctuation still tells blocs apart ("UCR" vs "U.C.R.").
const nameKey = (value: string) => normalizeText(value).replace(/\s+/g, ' ').trim();
const byNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

// --- Provinces ------------------------------------------------------------------------

export interface Province {
  slug: string;
  nombre: string;
  // other spellings used by the sources, normalized
  aliases: string[];
}

const province = (nombre: string, aliases: string[] = []): Province => ({ slug: slugify(nombre), nombre, aliases });

export const PROVINCES: Province[] = [
  province('Buenos Aires'),
  province('Catamarca'),
  province('Chaco'),
  province('Chubut'),
  province('Ciudad de Buenos Aires', ['caba', 'capital federal', 'ciudad autonoma de buenos aires']),
  province('Córdoba'),
  province('Corrientes'),
  province('Entre Ríos'),
  province('Formosa'),
  province('Jujuy'),
  province('La Pampa'),
  province('La Rioja'),
  province('Mendoza'),
  province('Misiones'),
  province('Neuquén'),
  province('Río Negro'),
  province('Salta'),
  province('San Juan'),
  province('San Luis'),
  province('Santa Cruz'),
  province('Santa Fe'),
  province('Santiago del Estero'),
  province('Tierra del Fuego', ['tierra del fuego antartida e islas del atlantico sur']),
  province('Tucumán'),
];

const provinceKey = (value: string) => normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();
const PROVINCE_BY_KEY = new Map(PROVINCES.flatMap(p => [provinceKey(p.nombre), ...p.aliases].map(key => [key, p] as const)));

export function provinceOf(value: string): Province | null {
  return PROVINCE_BY_KEY.get(provinceKey(value)) ?? null;
}

// --- URLs -----------------------------------------------------------------------------

export const legislatorUrl = (camara: Camara, id: string) => `/${camara === 'diputados' ? 'diputados' : 'senadores'}/${id}/`;
export const blocUrl = (camara: Camara, slug: string) => `/bloques/${camara}/${slug}/`;
export const provinceUrl = (slug: string) => `/provincias/${slug}/`;
export const committeeUrl = (slug: string) => `/comisiones/${slug}/`;

// --- Page shapes ----------------------------------------------------------------------

export interface BlocRef {
  slug: string;
  titulo: string;
  url: string;
}

export interface Member {
  id: string;
  nombre: string;
  // province display name; the raw value when it is not one of the 24
  distrito: string;
  provinciaSlug: string | null;
  url: string;
}

export interface DistrictCount {
  slug: string | null;
  nombre: string;
  count: number;
}

export interface CommitteeRole {
  comisionId: string;
  slug: string;
  titulo: string;
  url: string;
  cargo: string;
  memberId: string;
  memberNombre: string;
}

export type BillsTotals = Omit<BillsProfile, 'recent'> & {
  // members with at least one bill as first signer
  authors: number;
};

export interface TravelPoint {
  id: string;
  nombre: string;
  legs: number;
  legsPerMonth: number;
  band: string | null;
  flagged: boolean;
  status: TravelStatus;
}

export interface BandMedian {
  band: string;
  // compared deputies of the whole chamber in the band
  deputies: number;
  median: number;
}

export interface BlocPage {
  slug: string;
  // as published
  nombre: string;
  titulo: string;
  camara: Camara;
  url: string;
  members: Member[];
  seats: number;
  chamberSeats: number;
  // 1 = largest bloc of its chamber
  rank: number;
  byDistrict: DistrictCount[];
  // distinct provinces represented, of 24
  districts: number;
  // committees the members preside
  chairs: CommitteeRole[];
  // every role other than plain member, presidents first
  authorities: CommitteeRole[];
  bills: BillsTotals | null;
  // Diputados only: one point per member for the dot plot, with the chamber-wide band medians
  travel: { points: TravelPoint[]; bands: BandMedian[]; counts: Record<TravelStatus, number> } | null;
  missions: { count: number; members: number } | null;
  // Senate only: null for Diputados (no roll-call votes) and for a bloc absent from the actas
  votes: {
    riceMedio: number | null;
    actas: number;
    // senators who voted for the bloc in the period, current or former
    senators: number;
    members: { id: string; nombre: string; actas: number; asistencia: number; lealtadBloque: number | null }[];
  } | null;
  provenance: { members: Provenance; committees: Provenance; bills: Provenance; travel: Provenance; missions: Provenance; votes: Provenance };
}

export interface ProvinceBloc extends BlocRef {
  seats: number;
}

export interface ProvincePage {
  slug: string;
  nombre: string;
  url: string;
  deputies: Member[];
  senators: Member[];
  blocs: Record<Camara, ProvinceBloc[]>;
  // over its compared deputies (3 months or more in office)
  travel: { medianLegsPerMonth: number | null; deputies: number; bands: string[] };
  committees: { seats: number; committees: number; chairs: CommitteeRole[] };
  provenance: { members: Provenance; travel: Provenance; committees: Provenance };
}

export interface CommitteeMember extends Member {
  cargo: string;
  bloc: BlocRef;
}

export interface CommitteePage {
  id: string;
  slug: string;
  nombre: string;
  titulo: string;
  tipo: CommitteeType | null;
  url: string;
  // distinct members published by the Chamber
  integrantes: number;
  // linked to a deputy in office, best role first
  members: CommitteeMember[];
  // published members not linked to a deputy in office
  unlinked: number;
  authorities: { cargo: string; nombre: string; distrito: string; deputyId: string | null; url: string | null }[];
  blocMix: (BlocRef & { count: number })[];
  districts: DistrictCount[];
  bills: (BillsTotals & { label: string }) | null;
  provenance: { members: Provenance; bills: Provenance };
}

export interface LegislatorRelations {
  id: string;
  camara: Camara;
  url: string;
  bloc: BlocRef & { nombre: string; seats: number; chamberSeats: number };
  province: { slug: string; nombre: string; url: string; deputies: number; senators: number } | null;
  committees: { id: string; slug: string; titulo: string; cargo: string; url: string }[];
  // null when the source does not cover the chamber
  counts: { bills: number; sancionados: number; legs: number | null; missions: number | null; votes: number | null };
}

export type SearchType = 'diputado' | 'senador' | 'bloque' | 'provincia' | 'comision';

export interface SearchEntry {
  type: SearchType;
  label: string;
  sub: string;
  url: string;
  // normalized words, space separated
  keywords: string;
}

export interface Metric {
  value: number;
  sub: string;
  provenance: Provenance;
}

export interface TopicSummaries {
  numbers: Record<'diputados' | 'senadores' | 'proyectos' | 'actas' | 'misiones' | 'comisiones', Metric>;
  travel: {
    bands: BandMedian[];
    flagged: { id: string; nombre: string; url: string; band: string | null; legsPerMonth: number; bandMedian: number | null }[];
    provenance: Provenance;
  };
  pay: PaySummary & { shares: { dieta: number; gastosRepresentacion: number }; provenance: Provenance };
  bills: { total: number; funnel: (BillsProfile['funnel'][number] & { share: number })[]; provenance: Provenance };
  senate: {
    blocs: { bloque: string; titulo: string; senators: number; actas: number; riceMedio: number | null; url: string | null }[];
    attendance: { min: { id: string; nombre: string; value: number }; max: { id: string; nombre: string; value: number } } | null;
    provenance: Provenance;
  };
  committees: { total: number; largest: { id: string; slug: string; titulo: string; integrantes: number; url: string }[]; provenance: Provenance };
}

export interface Entities {
  blocs: BlocPage[];
  provinces: ProvincePage[];
  committees: CommitteePage[];
  relations: Map<string, LegislatorRelations>;
  search: SearchEntry[];
  searchBytes: number;
  topics: TopicSummaries;
}

export const TOPIC_TOP = 5;

export const searchIndexBytes = (index: SearchEntry[]) => new TextEncoder().encode(JSON.stringify(index)).length;

// --- Assembly ---------------------------------------------------------------------------

const range = ({ desde, hasta }: Period) => `${formatDate(desde)} – ${formatDate(hasta)}`;
const plural = (count: number, singular: string, many: string) => `${count} ${count === 1 ? singular : many}`;
const tokens = (...values: string[]) => [...new Set(values.flatMap(v => normalizeText(v).split(/[^a-z0-9]+/)).filter(Boolean))].join(' ');

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}

function countDistricts(members: Member[]): DistrictCount[] {
  const counts = new Map<string, DistrictCount>();
  for (const m of members) {
    const key = m.provinciaSlug ?? `raw:${m.distrito}`;
    const entry = counts.get(key) ?? { slug: m.provinciaSlug, nombre: m.distrito || 'Sin dato', count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, 'es'));
}

// Bills totals of several authors; null when none of them has a bill.
function billsTotals(list: (AuthorBills | undefined)[]): BillsTotals | null {
  const own = list.filter((b): b is AuthorBills => Boolean(b) && b!.total > 0);
  if (!own.length) return null;
  const { recent, ...profile } = billsProfile(mergeBills(own));
  return { ...profile, authors: own.length };
}

interface BlocDraft {
  key: string;
  nombre: string;
  camara: Camara;
  people: (Deputy | Senator)[];
}

export function buildEntities(sources: EntitySources): Entities {
  const { asOf, deputies, senators, pay, travel, committees, bills, missions, senateVotes } = sources;
  const current: Period = { desde: asOf, hasta: asOf };
  const prov = (datasets: SourceLink[], period: Period, label: string): Provenance => ({ sources: datasets, desde: period.desde, hasta: period.hasta, label });
  const provenance = {
    deputies: prov([DATASETS.legisladores], current, `vigente al ${formatDate(asOf)}`),
    senators: prov([DATASETS.senadores], current, `vigente al ${formatDate(asOf)}`),
    pay: prov([DATASETS.dietas], current, `vigente al ${formatDate(asOf)}`),
    committees: prov([DATASETS.comisiones], committees.period, `composición al ${formatDate(committees.period.hasta)}`),
    bills: prov([DATASETS.proyectos, DATASETS.movimientos], bills.period, range(bills.period)),
    travel: prov([DATASETS.viajes], { desde: null, hasta: null }, travel.windowLabel),
    missions: prov([DATASETS.misiones], missions.period, range(missions.period)),
    votes: prov([DATASETS.actas], senateVotes.period, `${senateVotes.actas} actas, ${range(senateVotes.period)}`),
  };

  const member = (camara: Camara, p: Deputy | Senator): Member => {
    const province = provinceOf(p.lugar);
    return { id: p.id, nombre: p.nombre, distrito: province?.nombre ?? p.lugar, provinciaSlug: province?.slug ?? null, url: legislatorUrl(camara, p.id) };
  };

  // Blocs: one per distinct name per chamber.
  const drafts: BlocDraft[] = [];
  for (const [camara, people] of [['diputados', deputies], ['senado', senators]] as const) {
    const byKey = new Map<string, BlocDraft>();
    for (const p of people) {
      const key = nameKey(p.bloque);
      const draft = byKey.get(key) ?? { key, nombre: p.bloque, camara, people: [] };
      draft.people.push(p);
      byKey.set(key, draft);
    }
    drafts.push(...byKey.values());
  }
  const blocSlugs = new Map<Camara, Map<string, string>>(
    (['diputados', 'senado'] as const).map(camara => [camara, uniqueSlugs(drafts.filter(d => d.camara === camara).map(d => ({ key: d.key, label: d.nombre })))]),
  );
  const blocRef = (camara: Camara, bloque: string): BlocRef => {
    const draft = drafts.find(d => d.camara === camara && d.key === nameKey(bloque))!;
    const slug = blocSlugs.get(camara)!.get(draft.key)!;
    return { slug, titulo: titleCase(draft.nombre), url: blocUrl(camara, slug) };
  };

  // Committees: slugs by id, so a renamed committee keeps its order.
  const committeeSlugs = uniqueSlugs([...committees.committees.values()].map(c => ({ key: c.id, label: c.nombre })));
  const committeeRef = (id: string) => {
    const summary = committees.committees.get(id);
    const slug = committeeSlugs.get(id) ?? slugify(id);
    // HCDN publishes members of some committees whose id is missing from the committee list.
    const named = summary?.nombre && normalizeText(summary.nombre) !== normalizeText(id);
    return { slug, titulo: named ? titleCase(summary.nombre) : `Comisión sin nombre publicado (${id})`, url: committeeUrl(slug) };
  };
  const deputyById = new Map(deputies.map(d => [d.id, d]));
  const roleOf = (deputyId: string, seat: DeputyCommittee): CommitteeRole => {
    const { slug, titulo, url } = committeeRef(seat.comisionId);
    return { comisionId: seat.comisionId, slug, titulo, url, cargo: seat.cargo, memberId: deputyId, memberNombre: deputyById.get(deputyId)?.nombre ?? deputyId };
  };
  const rolesOf = (ids: string[]) => ids.flatMap(id => (committees.byDeputy.get(id) ?? []).filter(s => committees.committees.has(s.comisionId)).map(s => roleOf(id, s)));
  const byRole = (a: CommitteeRole, b: CommitteeRole) => cargoRank(a.cargo) - cargoRank(b.cargo) || a.titulo.localeCompare(b.titulo, 'es');

  const travelById = new Map(travel.analysis.deputies.map(t => [t.deputyId, t]));
  const bandMedians: BandMedian[] = travel.analysis.bands.map(b => ({ band: b.band, deputies: b.deputies, median: b.medianLegsPerMonth }));
  const missionsById = new Map(missions.deputies.map(m => [m.deputyId, m]));
  const votesBloc = new Map(senateVotes.summary.blocs.map(b => [nameKey(b.bloque), b]));

  const blocs: BlocPage[] = [];
  for (const camara of ['diputados', 'senado'] as const) {
    const own = drafts.filter(d => d.camara === camara);
    const chamberSeats = own.reduce((t, d) => t + d.people.length, 0);
    const pages = own.map((draft): Omit<BlocPage, 'rank'> => {
      const slug = blocSlugs.get(camara)!.get(draft.key)!;
      const members = draft.people.map(p => member(camara, p)).sort(byNombre);
      const ids = members.map(m => m.id);
      const roles = camara === 'diputados' ? rolesOf(ids).sort(byRole) : [];
      let blocTravel: BlocPage['travel'] = null;
      let blocMissions: BlocPage['missions'] = null;
      let votes: BlocPage['votes'] = null;
      if (camara === 'diputados') {
        const points = members.flatMap(m => {
          const t = travelById.get(m.id);
          return t ? [{ id: m.id, nombre: m.nombre, legs: t.legs, legsPerMonth: t.legsPerMonth, band: t.band, flagged: t.flagged, status: travelStatus(t) }] : [];
        });
        const counts: Record<TravelStatus, number> = { 'en-linea': 0, 'viaja-mas': 0, 'sin-tramos': 0, 'no-comparado': 0, 'sin-distancia': 0 };
        for (const p of points) counts[p.status]++;
        blocTravel = { points, bands: bandMedians, counts };
        const own = ids.map(id => missionsById.get(id)).filter((m): m is DeputyMissions => Boolean(m) && m!.count > 0);
        blocMissions = { count: own.reduce((t, m) => t + m.count, 0), members: own.length };
      } else {
        const cohesion = votesBloc.get(draft.key);
        if (cohesion) {
          votes = {
            riceMedio: cohesion.riceMedio,
            actas: cohesion.actas,
            senators: cohesion.senators,
            members: ids.flatMap(id => {
              const v = senateVotes.summary.senators.get(id);
              return v ? [{ id, nombre: members.find(m => m.id === id)!.nombre, actas: v.actas, asistencia: v.asistencia, lealtadBloque: v.lealtadBloque }] : [];
            }),
          };
        }
      }
      return {
        slug,
        nombre: draft.nombre,
        titulo: titleCase(draft.nombre),
        camara,
        url: blocUrl(camara, slug),
        members,
        seats: members.length,
        chamberSeats,
        byDistrict: countDistricts(members),
        districts: new Set(members.map(m => m.provinciaSlug).filter(Boolean)).size,
        chairs: roles.filter(r => r.cargo === 'presidente'),
        authorities: roles.filter(r => r.cargo !== 'integrante'),
        bills: billsTotals(ids.map(id => bills.byLegislator.get(id))),
        travel: blocTravel,
        missions: blocMissions,
        votes,
        provenance: {
          members: camara === 'diputados' ? provenance.deputies : provenance.senators,
          committees: provenance.committees,
          bills: provenance.bills,
          travel: provenance.travel,
          missions: provenance.missions,
          votes: provenance.votes,
        },
      };
    });
    pages.sort((a, b) => b.seats - a.seats || (a.slug < b.slug ? -1 : 1));
    blocs.push(...pages.map((page, i) => ({ ...page, rank: i + 1 })));
  }
  const blocPage = (camara: Camara, bloque: string) => blocs.find(b => b.camara === camara && b.slug === blocRef(camara, bloque).slug)!;

  // Provinces: all 24, with or without legislators.
  const provinces: ProvincePage[] = PROVINCES.map(p => {
    const deps = deputies.filter(d => provinceOf(d.lugar)?.slug === p.slug);
    const sens = senators.filter(s => provinceOf(s.lugar)?.slug === p.slug);
    const seatsBy = (camara: Camara, people: (Deputy | Senator)[]): ProvinceBloc[] => {
      const counts = new Map<string, ProvinceBloc>();
      for (const person of people) {
        const ref = blocRef(camara, person.bloque);
        const entry = counts.get(ref.slug) ?? { ...ref, seats: 0 };
        entry.seats++;
        counts.set(ref.slug, entry);
      }
      return [...counts.values()].sort((a, b) => b.seats - a.seats || (a.slug < b.slug ? -1 : 1));
    };
    const compared = deps.map(d => travelById.get(d.id)).filter(t => t?.eligible);
    const roles = rolesOf(deps.map(d => d.id));
    return {
      slug: p.slug,
      nombre: p.nombre,
      url: provinceUrl(p.slug),
      deputies: deps.map(d => member('diputados', d)).sort(byNombre),
      senators: sens.map(s => member('senado', s)).sort(byNombre),
      blocs: { diputados: seatsBy('diputados', deps), senado: seatsBy('senado', sens) },
      travel: {
        medianLegsPerMonth: median(compared.map(t => t!.legsPerMonth)),
        deputies: compared.length,
        bands: [...new Set(compared.map(t => t!.band).filter((b): b is string => Boolean(b)))],
      },
      committees: {
        seats: roles.length,
        committees: new Set(roles.map(r => r.comisionId)).size,
        chairs: roles.filter(r => r.cargo === 'presidente').sort(byRole),
      },
      provenance: { members: provenance.deputies, travel: provenance.travel, committees: provenance.committees },
    };
  });

  // Committees: members inverted from each deputy's roles.
  const membersByCommittee = new Map<string, CommitteeMember[]>();
  for (const d of deputies) {
    for (const seat of committees.byDeputy.get(d.id) ?? []) {
      if (!committees.committees.has(seat.comisionId)) continue;
      const list = membersByCommittee.get(seat.comisionId) ?? [];
      const ref = blocRef('diputados', d.bloque);
      const { id, nombre, url, distrito, provinciaSlug } = member('diputados', d);
      list.push({ id, nombre, url, cargo: seat.cargo, distrito, provinciaSlug, bloc: ref });
      membersByCommittee.set(seat.comisionId, list);
    }
  }
  const committeePages: CommitteePage[] = [...committees.committees.values()]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(summary => {
      const { slug, titulo, url } = committeeRef(summary.id);
      const members = (membersByCommittee.get(summary.id) ?? []).sort((a, b) => cargoRank(a.cargo) - cargoRank(b.cargo) || byNombre(a, b));
      const mix = new Map<string, BlocRef & { count: number }>();
      for (const m of members) {
        const entry = mix.get(m.bloc.slug) ?? { ...m.bloc, count: 0 };
        entry.count++;
        mix.set(m.bloc.slug, entry);
      }
      const totals = billsTotals(members.map(m => bills.byLegislator.get(m.id)));
      return {
        id: summary.id,
        slug,
        nombre: summary.nombre,
        titulo,
        tipo: summary.tipo ?? null,
        url,
        integrantes: summary.miembros,
        members,
        unlinked: Math.max(0, summary.miembros - members.length),
        authorities: summary.autoridades.map(a => ({ ...a, url: a.deputyId && deputyById.has(a.deputyId) ? legislatorUrl('diputados', a.deputyId) : null })),
        blocMix: [...mix.values()].sort((a, b) => b.count - a.count || a.titulo.localeCompare(b.titulo, 'es')),
        districts: countDistricts(members),
        bills: totals && { ...totals, label: 'Proyectos de sus integrantes como primer firmante, de cualquier tema' },
        provenance: { members: provenance.committees, bills: provenance.bills },
      };
    });

  // Relations for the strip of every legislator page.
  const provinceBySlug = new Map(provinces.map(p => [p.slug, p]));
  const relations = new Map<string, LegislatorRelations>();
  for (const [camara, people] of [['diputados', deputies], ['senado', senators]] as const) {
    for (const p of people) {
      const page = blocPage(camara, p.bloque);
      const province = provinceOf(p.lugar);
      const provincePage = province ? provinceBySlug.get(province.slug)! : null;
      const own = bills.byLegislator.get(p.id);
      relations.set(p.id, {
        id: p.id,
        camara,
        url: legislatorUrl(camara, p.id),
        bloc: { slug: page.slug, nombre: page.nombre, titulo: page.titulo, url: page.url, seats: page.seats, chamberSeats: page.chamberSeats },
        province: provincePage && {
          slug: provincePage.slug, nombre: provincePage.nombre, url: provincePage.url,
          deputies: provincePage.deputies.length, senators: provincePage.senators.length,
        },
        committees: camara === 'diputados'
          ? rolesOf([p.id]).sort(byRole).map(r => ({ id: r.comisionId, slug: r.slug, titulo: r.titulo, cargo: r.cargo, url: r.url }))
          : [],
        counts: {
          bills: own?.total ?? 0,
          sancionados: own?.stages.sancionado ?? 0,
          legs: camara === 'diputados' ? travelById.get(p.id)?.legs ?? 0 : null,
          missions: camara === 'diputados' ? missionsById.get(p.id)?.count ?? 0 : null,
          votes: camara === 'senado' ? senateVotes.summary.senators.get(p.id)?.actas ?? 0 : null,
        },
      });
    }
  }

  // Client search: short fields only.
  const search: SearchEntry[] = [];
  for (const [camara, type, people] of [['diputados', 'diputado', deputies], ['senado', 'senador', senators]] as const) {
    for (const p of [...people].sort(byNombre)) {
      const { distrito } = member(camara, p);
      const { titulo } = blocRef(camara, p.bloque);
      search.push({ type, label: p.nombre, sub: `${distrito} · ${titulo}`, url: legislatorUrl(camara, p.id), keywords: tokens(p.nombre, distrito, titulo) });
    }
  }
  for (const b of blocs) {
    const chamber = b.camara === 'diputados' ? 'Diputados' : 'Senado';
    const seats = b.camara === 'diputados' ? plural(b.seats, 'integrante', 'integrantes') : plural(b.seats, 'senador', 'senadores');
    search.push({ type: 'bloque', label: b.titulo, sub: `${chamber} · ${seats}`, url: b.url, keywords: tokens(b.titulo, chamber) });
  }
  for (const p of provinces) {
    const sub = `${plural(p.deputies.length, 'diputado', 'diputados')} · ${plural(p.senators.length, 'senador', 'senadores')}`;
    search.push({ type: 'provincia', label: p.nombre, sub, url: p.url, keywords: tokens(p.nombre, ...PROVINCES.find(x => x.slug === p.slug)!.aliases) });
  }
  for (const c of committeePages) {
    const president = c.authorities.find(a => a.cargo === 'presidente');
    const presidentName = president ? (president.deputyId && deputyById.get(president.deputyId)?.nombre) || president.nombre : '';
    const sub = [`Diputados · ${plural(c.integrantes, 'integrante', 'integrantes')}`, presidentName && `preside ${presidentName}`].filter(Boolean).join(' · ');
    search.push({ type: 'comision', label: c.titulo, sub, url: c.url, keywords: tokens(c.titulo, 'comisión diputados') });
  }

  // Home topic cards.
  const deputyBills = billsTotals(deputies.map(d => bills.byLegislator.get(d.id)));
  const ownMissions = deputies.map(d => missionsById.get(d.id)).filter((m): m is DeputyMissions => Boolean(m) && m!.count > 0);
  const senateBlocs = new Map(blocs.filter(b => b.camara === 'senado').map(b => [nameKey(b.nombre), b]));
  const attendance = senators
    .map(s => ({ id: s.id, nombre: s.nombre, value: senateVotes.summary.senators.get(s.id)?.asistencia }))
    .filter((a): a is { id: string; nombre: string; value: number } => a.value !== undefined)
    .sort((a, b) => a.value - b.value || byNombre(a, b));
  const funnelTotal = deputyBills?.total ?? 0;
  const topics: TopicSummaries = {
    numbers: {
      diputados: { value: deputies.length, sub: 'diputados en funciones', provenance: provenance.deputies },
      senadores: { value: senators.length, sub: 'senadores en funciones', provenance: provenance.senators },
      proyectos: { value: funnelTotal, sub: 'proyectos de diputados en funciones', provenance: provenance.bills },
      actas: { value: senateVotes.actas, sub: 'actas nominales del Senado', provenance: provenance.votes },
      misiones: {
        value: ownMissions.reduce((t, m) => t + m.count, 0),
        sub: `de ${plural(ownMissions.length, 'diputado', 'diputados')} en funciones`,
        provenance: provenance.missions,
      },
      comisiones: { value: committees.committees.size, sub: 'comisiones con integrantes', provenance: provenance.committees },
    },
    travel: {
      bands: bandMedians,
      flagged: travel.analysis.deputies
        .filter(t => t.flagged && deputyById.has(t.deputyId))
        .map(t => ({ id: t.deputyId, nombre: deputyById.get(t.deputyId)!.nombre, url: legislatorUrl('diputados', t.deputyId), band: t.band, legsPerMonth: t.legsPerMonth, bandMedian: t.bandMedian }))
        .sort(byNombre),
      provenance: provenance.travel,
    },
    pay: {
      ...pay,
      shares: {
        dieta: pay.bruto ? (pay.dieta ?? 0) / pay.bruto : 0,
        gastosRepresentacion: pay.bruto ? (pay.gastosRepresentacion ?? 0) / pay.bruto : 0,
      },
      provenance: provenance.pay,
    },
    bills: {
      total: funnelTotal,
      funnel: (deputyBills?.funnel ?? []).map(f => ({ ...f, share: funnelTotal ? f.alcanzado / funnelTotal : 0 })),
      provenance: provenance.bills,
    },
    senate: {
      blocs: senateVotes.summary.blocs
        .filter(b => b.bloque)
        .map(b => ({
          bloque: b.bloque, titulo: titleCase(b.bloque), senators: b.senators, actas: b.actas, riceMedio: b.riceMedio,
          url: senateBlocs.get(nameKey(b.bloque))?.url ?? null,
        }))
        .sort((a, b) => b.senators - a.senators || a.titulo.localeCompare(b.titulo, 'es'))
        .slice(0, TOPIC_TOP),
      attendance: attendance.length ? { min: attendance[0], max: attendance.at(-1)! } : null,
      provenance: provenance.votes,
    },
    committees: {
      total: committeePages.length,
      largest: [...committeePages]
        .sort((a, b) => b.integrantes - a.integrantes || a.titulo.localeCompare(b.titulo, 'es'))
        .slice(0, TOPIC_TOP)
        .map(c => ({ id: c.id, slug: c.slug, titulo: c.titulo, integrantes: c.integrantes, url: c.url })),
      provenance: provenance.committees,
    },
  };

  return { blocs, provinces, committees: committeePages, relations, search, searchBytes: searchIndexBytes(search), topics };
}
