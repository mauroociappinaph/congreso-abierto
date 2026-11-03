// Linking policy shared by every source: names are linked against the legislators in office during the
// source's period (current and former), so a former legislator counts as matched-former, not unmatched.
// Only current legislators carry a `deputyId` (the composition id the site shows).
import { normalizeText } from './legislators.ts';
import { createLinker, type LinkResult, type LinkStatus } from './linkage.ts';
import { activeDuring, districtDuring, type CurrentDeputy, type RosterPerson } from './roster.ts';

export type PolicyStatus = 'matched-current' | 'matched-former' | 'doubtful' | 'unmatched';

export interface PolicyCandidate {
  personId: string;
  nombre: string;
  confidence: number;
}

export interface PolicyLink {
  status: LinkStatus;
  // current composition id (or current senator id) when the person is in office today, else null
  deputyId: string | null;
  // HCDN roster id, null for senators and for current deputies missing from the roster
  hcdnId: string | null;
  // stable id of the linked person: hcdnId, composition id or senator id
  personId: string | null;
  current: boolean;
  confidence: number;
  candidates: PolicyCandidate[];
}

export interface PolicyCounts {
  matchedCurrent: number;
  matchedFormer: number;
  doubtful: number;
  unmatched: number;
  total: number;
}

export interface LinkQuality {
  // distinct names; a name seen with several outcomes keeps its worst one (doubtful > matched > unmatched)
  names: PolicyCounts;
  // every link call, one per source row; linkedPercent = matched (current + former) / total, 0-100, one decimal
  rows: PolicyCounts & { linkedPercent: number };
  doubtful: { nombre: string; lugar: string; candidates: PolicyCandidate[] }[];
  unmatched: { nombre: string; lugar: string }[];
}

export interface PolicyLinker {
  link: (rawName: string, lugar?: string) => PolicyLink;
  // The same link in the shape the pure source modules expect: only current legislators carry an id.
  linkFn: (rawName: string, lugar?: string) => LinkResult;
  quality: () => LinkQuality;
}

export interface PolicyEntry {
  personId: string;
  nombre: string;
  lugar: string;
  currentId: string | null;
  hcdnId: string | null;
}

export interface Period {
  // YYYY-MM-DD, bounds included
  from: string;
  to: string;
}

export function policyStatus(link: PolicyLink): PolicyStatus {
  if (link.status !== 'matched') return link.status;
  return link.current ? 'matched-current' : 'matched-former';
}

// "DIP. TAIANA JORGE", "DIPUTADA NACIONAL ...", "SEN. ...", "SENADORA ..."
const PREFIX = /^\s*(?:dip(?:utad[oa](?:\/a)?)?|sen(?:ador(?:a|\/a)?)?)\.?\s+(?:nacional\s+)?/i;
const stripPrefix = (rawName: string) => rawName.replace(PREFIX, '').trim();

const nameKey = (value: string) => normalizeText(value).replace(/\s+/g, ' ').trim();
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const byNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');

const RANK: Record<LinkStatus, number> = { unmatched: 0, matched: 1, doubtful: 2 };
const COUNT_KEY: Record<PolicyStatus, keyof Omit<PolicyCounts, 'total'>> = {
  'matched-current': 'matchedCurrent',
  'matched-former': 'matchedFormer',
  doubtful: 'doubtful',
  unmatched: 'unmatched',
};
const zero = (): PolicyCounts => ({ matchedCurrent: 0, matchedFormer: 0, doubtful: 0, unmatched: 0, total: 0 });

// `idOf` returns an official person id for a raw name (e.g. a senator id published beside each vote);
// a known id is a certain match and skips the name linker.
export function createPolicyLinker(entries: PolicyEntry[], idOf?: (rawName: string, lugar: string) => string | null): PolicyLinker {
  const byId = new Map(entries.map(e => [e.personId, e]));
  const linker = createLinker(entries.map(e => ({ id: e.personId, nombre: e.nombre, lugar: e.lugar })));
  const names = new Map<string, { nombre: string; lugar: string; link: PolicyLink }>();
  const rows = zero();

  const resolve = (rawName: string, lugar: string): PolicyLink => {
    const known = idOf?.(rawName, lugar);
    const exact = known ? byId.get(known) : undefined;
    const result: LinkResult = exact
      ? { status: 'matched', deputyId: exact.personId, confidence: 1, candidates: [] }
      : linker.link(stripPrefix(rawName), lugar || undefined);
    const entry = result.status === 'matched' && result.deputyId ? byId.get(result.deputyId) : undefined;
    return {
      status: result.status,
      deputyId: entry?.currentId ?? null,
      hcdnId: entry?.hcdnId ?? null,
      personId: entry?.personId ?? null,
      current: Boolean(entry?.currentId),
      confidence: result.confidence,
      candidates: result.candidates.map(c => ({ personId: c.id, nombre: byId.get(c.id)?.nombre ?? '', confidence: c.confidence })),
    };
  };

  const link = (rawName: string, lugar = ''): PolicyLink => {
    const result = resolve(rawName, lugar);
    rows[COUNT_KEY[policyStatus(result)]]++;
    rows.total++;
    const key = nameKey(stripPrefix(rawName));
    const seen = names.get(key);
    if (!seen) names.set(key, { nombre: stripPrefix(rawName), lugar, link: result });
    else if (RANK[result.status] > RANK[seen.link.status]) seen.link = result;
    return result;
  };

  return {
    link,
    linkFn(rawName, lugar) {
      const { status, deputyId, confidence, candidates } = link(rawName, lugar);
      return { status, deputyId, confidence, candidates: candidates.map(c => ({ id: c.personId, confidence: c.confidence })) };
    },
    quality() {
      const counts = zero();
      for (const { link: l } of names.values()) counts[COUNT_KEY[policyStatus(l)]]++;
      counts.total = names.size;
      const outcomes = [...names.values()];
      return {
        names: counts,
        rows: { ...rows, linkedPercent: percent(rows.matchedCurrent + rows.matchedFormer, rows.total) },
        doubtful: outcomes
          .filter(o => o.link.status === 'doubtful')
          .map(o => ({ nombre: o.nombre, lugar: o.lugar, candidates: o.link.candidates }))
          .sort(byNombre),
        unmatched: outcomes.filter(o => o.link.status === 'unmatched').map(o => ({ nombre: o.nombre, lugar: o.lugar })).sort(byNombre),
      };
    },
  };
}

// Deputies in office during `period` per the HCDN roster. A current deputy is indexed under the composition
// name and district (the spelling the linker was tuned on); current deputies missing from the roster are
// always included, since they are in office today.
export function createDeputyPolicy(
  people: RosterPerson[],
  period: Period,
  current: CurrentDeputy[],
  currentToHcdn: Map<string, string>,
): PolicyLinker {
  const hcdnToCurrent = new Map([...currentToHcdn].map(([deputyId, hcdnId]) => [hcdnId, deputyId]));
  const currentById = new Map(current.map(d => [d.id, d]));
  const entries: PolicyEntry[] = activeDuring(people, period.from, period.to).map(person => {
    const deputy = currentById.get(hcdnToCurrent.get(person.hcdnId) ?? '');
    return deputy
      ? { personId: person.hcdnId, nombre: deputy.nombre, lugar: deputy.lugar, currentId: deputy.id, hcdnId: person.hcdnId }
      : { personId: person.hcdnId, nombre: person.nombre, lugar: districtDuring(person, period.from, period.to), currentId: null, hcdnId: person.hcdnId };
  });
  for (const deputy of current) {
    if (!currentToHcdn.has(deputy.id)) {
      entries.push({ personId: deputy.id, nombre: deputy.nombre, lugar: deputy.lugar, currentId: deputy.id, hcdnId: null });
    }
  }
  return createPolicyLinker(entries);
}

export interface SenateVoteName {
  nombre: string;
  senadorId: number | null;
  provincia: string;
}

const voteKey = (nombre: string, provincia: string) => `${nameKey(nombre)}|${nameKey(provincia)}`;

// Senators identified by the vote records of the period, latest first. Rows of current senators link to their
// official page (`senadorId`); rows of former senators do not, so a name and province listed in an official
// vote record identify a former senator, unless that name links to a current senator (then the linker decides).
export function senateIdentities(
  votes: SenateVoteName[],
  current: CurrentDeputy[],
): { former: CurrentDeputy[]; idOf: (rawName: string, lugar: string) => string | null } {
  const currentIds = new Set(current.map(s => s.id));
  const ids = new Map(current.map(s => [voteKey(s.nombre, s.lugar), s.id]));
  const former = new Map<string, CurrentDeputy>();
  const unlinked: SenateVoteName[] = [];
  for (const v of votes) {
    if (v.senadorId === null) {
      unlinked.push(v);
      continue;
    }
    const id = `sen-${v.senadorId}`;
    ids.set(voteKey(v.nombre, v.provincia), id);
    if (!currentIds.has(id) && !former.has(id)) former.set(id, { id, nombre: v.nombre, lugar: v.provincia });
  }
  const currentLinker = createLinker(current);
  for (const v of unlinked) {
    const key = voteKey(v.nombre, v.provincia);
    if (ids.has(key) || currentLinker.link(v.nombre, v.provincia).status !== 'unmatched') continue;
    const id = `sen-acta:${key}`;
    ids.set(key, id);
    former.set(id, { id, nombre: v.nombre, lugar: v.provincia });
  }
  return { former: [...former.values()], idOf: (rawName, lugar) => ids.get(voteKey(rawName, lugar)) ?? null };
}

// Current senators plus former ones known by their official id (e.g. from the vote records of the period).
export function createSenatePolicy(
  current: CurrentDeputy[],
  former: CurrentDeputy[],
  idOf?: (rawName: string, lugar: string) => string | null,
): PolicyLinker {
  const currentIds = new Set(current.map(s => s.id));
  const entries: PolicyEntry[] = current.map(s => ({ personId: s.id, nombre: s.nombre, lugar: s.lugar, currentId: s.id, hcdnId: null }));
  const seen = new Set(currentIds);
  for (const s of former) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    entries.push({ personId: s.id, nombre: s.nombre, lugar: s.lugar, currentId: null, hcdnId: null });
  }
  return createPolicyLinker(entries, idOf);
}
