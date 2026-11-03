import { normalizeText } from './legislators.ts';

export type LinkStatus = 'matched' | 'doubtful' | 'unmatched';

export interface LinkCandidate {
  id: string;
  confidence: number;
}

export interface LinkResult {
  status: LinkStatus;
  deputyId: string | null;
  confidence: number;
  candidates: LinkCandidate[];
}

export interface LinkableDeputy {
  id: string;
  nombre: string;
  lugar: string;
}

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const SURNAME_JW = 0.93;
const GIVEN_JW = 0.9;
const INITIAL_JW = 0.95;
const MATCH_MIN = 0.9;
const MATCH_MARGIN = 0.05;
const DOUBTFUL_MIN = 0.75;
const SURNAME_WEIGHT = 2;
const EXACT_JW = 0.97;
const GIVEN_FIRST_PENALTY = 0.03;
const PARTIAL_SURNAME_FACTOR = 0.95;
const GIVEN_WEIGHT = 1;

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHits = new Array<boolean>(a.length).fill(false);
  const bHits = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const end = Math.min(i + window + 1, b.length);
    for (let j = Math.max(0, i - window); j < end; j++) {
      if (bHits[j] || a[i] !== b[j]) continue;
      aHits[i] = bHits[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aHits[i]) continue;
    while (!bHits[j]) j++;
    if (a[i] !== b[j]) transpositions++;
    j++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

// Windows-1252 characters in 0x80-0x9F, keyed by the byte they stand for.
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
  '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93,
  '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

// Undoes UTF-8 text that was read as Latin-1/Windows-1252 ("BELÃ‰N" -> "BELÉN").
// Leaves the string unchanged when it cannot be re-decoded cleanly.
export function repairMojibake(value: string): string {
  if (!/Ã./.test(value)) return value;
  const bytes: number[] = [];
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    const byte = code <= 0xff ? code : CP1252[ch];
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  return decoded.includes('\uFFFD') ? value : decoded;
}

// Splits on spaces, dots, commas and hyphens; any other non-letter inside a
// word is removed without splitting it ("BELA?N" -> "belan").
const words = (value: string) =>
  normalizeText(repairMojibake(value))
    .split(/[\s.,;\/-]+/)
    .map(w => w.replace(/[^a-z]/g, ''))
    .filter(w => w && !PARTICLES.has(w));

const dropNicknames = (value: string) => value.replace(/"[^"]*"|“[^”]*”/g, ' ');

// "Apellido, Nombres" splits at the comma; a name without one (trip rows) has
// no known split, so all its tokens go to `given`.
export function nameTokens(rawName: string): { surname: string[]; given: string[] } {
  const name = dropNicknames(rawName);
  const comma = name.indexOf(',');
  if (comma < 0) return { surname: [], given: words(name) };
  return { surname: words(name.slice(0, comma)), given: words(name.slice(comma + 1)) };
}

const givenSimilarity = (token: string, tripToken: string) =>
  (token.length === 1 || tripToken.length === 1) && token[0] === tripToken[0]
    ? INITIAL_JW
    : jaroWinkler(token, tripToken);

interface Score {
  confidence: number;
  // every surname token matched with JW >= EXACT_JW
  exactSurname: boolean;
  givenMatched: number;
  // every trip token was claimed by a surname or given-name token
  allClaimed: boolean;
}

// Surname tokens claim trip tokens in order: `first` within the first
// (surname count + 1) positions, `last` exactly the last positions and with
// JW >= EXACT_JW, since trip files rarely put given names first ("MARIA
// MARCELA" is not "Marclay"). Returns the claimed positions with their JW, or
// null when a token finds none.
function claimSurname(surname: string[], trip: string[], order: 'first' | 'last', surnameEnd = trip.length): { index: number; jw: number }[] | null {
  const claims: { index: number; jw: number }[] = [];
  if (order === 'last') {
    const start = trip.length - surname.length;
    if (start < 1) return null;
    for (let k = 0; k < surname.length; k++) {
      const jw = jaroWinkler(surname[k], trip[start + k]);
      if (jw < EXACT_JW) return null;
      claims.push({ index: start + k, jw });
    }
    return claims;
  }
  const limit = Math.min(trip.length, surname.length + 1, surnameEnd);
  let next = 0;
  for (const token of surname) {
    let best = -1;
    let bestJw = 0;
    for (let i = next; i < limit; i++) {
      const jw = jaroWinkler(token, trip[i]);
      if (jw >= SURNAME_JW && jw > bestJw) [best, bestJw] = [i, jw];
    }
    if (best < 0) return null;
    claims.push({ index: best, jw: bestJw });
    next = best + 1;
  }
  return claims;
}

// Surname tokens must match (see claimSurname); given-name tokens then claim
// the best distinct remaining trip token. Returns null when a surname token
// finds no trip token or when the deputy has given names and none matches.
// The `last` order also needs given names with JW >= EXACT_JW (no initials).
// With a compound surname, matching only its first token is allowed when
// every given name matches and no trip token is left over; that confidence
// is capped below an exact match.
function score(deputy: { surname: string[]; given: string[] }, trip: string[], order: 'first' | 'last', surnameEnd?: number): Score | null {
  let surname = deputy.surname;
  let claims = claimSurname(surname, trip, order, surnameEnd);
  const partial = !claims && surname.length >= 2;
  if (partial) {
    surname = surname.slice(0, 1);
    claims = claimSurname(surname, trip, order, surnameEnd);
  }
  if (!claims) return null;
  const free = trip.map(() => true);
  for (const { index } of claims) free[index] = false;
  const jws = claims.map(c => c.jw);
  const givenMin = order === 'last' ? EXACT_JW : GIVEN_JW;
  let givenMatched = 0;
  for (const token of deputy.given) {
    let best = -1;
    let bestJw = 0;
    trip.forEach((tripToken, i) => {
      if (!free[i]) return;
      const jw = givenSimilarity(token, tripToken);
      if (jw >= givenMin && jw > bestJw) [best, bestJw] = [i, jw];
    });
    if (best < 0) continue;
    free[best] = false;
    givenMatched++;
    jws.push(bestJw);
  }
  if (deputy.given.length && !givenMatched) return null;
  // A leftover trip token could be a different second surname ("SANTILLAN GOMEZ JULIANA").
  if (partial && (givenMatched < deputy.given.length || free.some(Boolean))) return null;
  const avgJw = jws.reduce((sum, jw) => sum + jw, 0) / jws.length;
  const matchedWeight = surname.length * SURNAME_WEIGHT + givenMatched * GIVEN_WEIGHT;
  const totalWeight = surname.length * SURNAME_WEIGHT + deputy.given.length * GIVEN_WEIGHT;
  const confidence = partial ? avgJw * PARTIAL_SURNAME_FACTOR : (matchedWeight / totalWeight + avgJw) / 2;
  return {
    confidence: order === 'last' ? confidence - GIVEN_FIRST_PENALTY : confidence,
    exactSurname: !partial && claims.every(c => c.jw >= EXACT_JW),
    givenMatched,
    allClaimed: free.every(f => !f),
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const DISTRICT_ALIASES: Record<string, string> = {
  caba: 'ciudad de buenos aires',
  'capital federal': 'ciudad de buenos aires',
  'ciudad autonoma de buenos aires': 'ciudad de buenos aires',
};
const district = (value: string) => {
  const key = normalizeText(value).replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return DISTRICT_ALIASES[key] ?? key;
};

type Indexed = LinkableDeputy & { tokens: { surname: string[]; given: string[] }; district: string };
type Scored = Score & { deputy: Indexed };

export function createLinker(deputies: LinkableDeputy[]): { link: (rawName: string, provincia?: string) => LinkResult } {
  const indexed: Indexed[] = deputies
    .map(d => ({ ...d, tokens: nameTokens(d.nombre), district: district(d.lugar) }))
    .filter(d => d.tokens.surname.length);
  const cache = new Map<string, LinkResult>();

  const scoreAll = (trip: string[], order: 'first' | 'last', surnameEnd?: number): Scored[] =>
    indexed.flatMap(d => {
      const s = score(d.tokens, trip, order, surnameEnd);
      return s && s.confidence > 0 ? [{ ...s, deputy: d }] : [];
    });

  // A short source name ("YEDLIN,PABLO") may list fewer given names: with an
  // exact surname, no trip token left over and no other candidate with that
  // surname, it is raised to the match threshold.
  const subsetBoost = (c: Scored, all: Scored[]): Scored => {
    const surname = c.deputy.tokens.surname.join(' ');
    const unique = all.every(o => o === c || o.deputy.tokens.surname.join(' ') !== surname);
    const eligible = c.exactSurname && c.givenMatched > 0 && c.allClaimed && unique && c.confidence < MATCH_MIN;
    return eligible ? { ...c, confidence: MATCH_MIN } : c;
  };

  const compute = (rawName: string, provincia?: string): LinkResult => {
    const trip = words(rawName);
    // "PAGANO, MARCELA MARINA": the comma marks where the surname ends, so "Marclay" cannot claim "MARCELA".
    // Reversed names ("MARGARITA, STOLBIZER") find nothing that way and fall back to the plain window.
    const [beforeComma, afterComma] = rawName.split(',');
    const surnameEnd = afterComma?.trim() ? words(beforeComma).length : undefined;
    let scored = surnameEnd ? scoreAll(trip, 'first', surnameEnd) : [];
    if (!scored.some(c => c.confidence >= DOUBTFUL_MIN)) scored = scoreAll(trip, 'first');
    scored = scored.map(c => subsetBoost(c, scored));
    // Given-name-first names ("VERONICA KARINA BANFI") get a second pass only when the first finds nothing.
    if (!scored.some(c => c.confidence >= DOUBTFUL_MIN)) {
      const byId = new Map(scored.map(c => [c.deputy.id, c]));
      for (const c of scoreAll(trip, 'last')) {
        if (c.confidence > (byId.get(c.deputy.id)?.confidence ?? 0)) byId.set(c.deputy.id, c);
      }
      scored = [...byId.values()];
    }
    scored.sort((a, b) => b.confidence - a.confidence);
    // A row's PROVINCIA narrows the candidates to that district, which breaks same-name ties.
    const inDistrict = provincia?.trim() ? scored.filter(c => c.deputy.district === district(provincia)) : [];
    const ranked = inDistrict.length > 0 ? inDistrict : scored;
    const [best, runnerUp] = ranked;
    if (!best || best.confidence < DOUBTFUL_MIN) {
      return { status: 'unmatched', deputyId: null, confidence: round3(best?.confidence ?? 0), candidates: [] };
    }
    const margin = best.confidence - (runnerUp?.confidence ?? 0);
    const sameDistrict = !provincia?.trim() || district(provincia) === best.deputy.district;
    if (best.confidence >= MATCH_MIN && margin >= MATCH_MARGIN && sameDistrict) {
      return { status: 'matched', deputyId: best.deputy.id, confidence: round3(best.confidence), candidates: [] };
    }
    return {
      status: 'doubtful',
      deputyId: null,
      confidence: round3(best.confidence),
      candidates: ranked.slice(0, 3).map(c => ({ id: c.deputy.id, confidence: round3(c.confidence) })),
    };
  };

  return {
    link(rawName, provincia) {
      const key = `${rawName}\u0000${provincia ?? ''}`;
      let result = cache.get(key);
      if (!result) cache.set(key, (result = compute(rawName, provincia)));
      return result;
    },
  };
}
