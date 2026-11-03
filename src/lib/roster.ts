// Pure parsing of the HCDN historic roster (CKAN `legisladores`, resource "Diputados"): every deputy since
// 1983 with an ID and the dates of each mandate, so a source can be linked against whoever was in office.
import { normalizeText, parseCsv } from './legislators.ts';
import { createLinker, nameTokens } from './linkage.ts';

export interface Mandate {
  // YYYY-MM-DD: swearing-in of a replacement when later than the mandate start; early leave (CESE) when earlier than its end
  inicio: string;
  fin: string;
  distrito: string;
}

export interface RosterPerson {
  hcdnId: string;
  // "APELLIDO, NOMBRES" as published
  nombre: string;
  // district of the latest mandate
  distrito: string;
  // oldest first
  mandates: Mandate[];
}

export interface CurrentDeputy {
  id: string;
  nombre: string;
  lugar: string;
}

const day = (value: string | undefined) => {
  const m = (value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};

// One row per mandate and bloc span: rows of one mandate share their dates, so they collapse into one.
export function parseRoster(csvText: string): RosterPerson[] {
  const people = new Map<string, RosterPerson>();
  for (const row of parseCsv(csvText)) {
    const hcdnId = row.ID ?? '';
    const inicio = day(row.INICIO);
    const fin = day(row.FIN);
    if (!hcdnId || !inicio || !fin) continue;
    const juramento = day(row.JURAMENTO);
    const cese = day(row.CESE);
    const mandate: Mandate = {
      inicio: juramento > inicio ? juramento : inicio,
      fin: cese && cese < fin ? cese : fin,
      distrito: row.DISTRITO ?? '',
    };
    let person = people.get(hcdnId);
    if (!person) {
      person = { hcdnId, nombre: `${row.APELLIDO ?? ''}, ${row.NOMBRE ?? ''}`, distrito: '', mandates: [] };
      people.set(hcdnId, person);
    }
    if (!person.mandates.some(m => m.inicio === mandate.inicio && m.fin === mandate.fin)) person.mandates.push(mandate);
  }
  for (const person of people.values()) {
    person.mandates.sort((a, b) => a.inicio.localeCompare(b.inicio));
    person.distrito = person.mandates.at(-1)!.distrito;
  }
  return [...people.values()];
}

const overlaps = (m: Mandate, from: string, to: string) => m.inicio <= to && m.fin >= from;

// People with at least one mandate overlapping [from, to] (YYYY-MM-DD, bounds included).
export function activeDuring(people: RosterPerson[], from: string, to: string): RosterPerson[] {
  return people.filter(p => p.mandates.some(m => overlaps(m, from, to)));
}

// District of the latest mandate overlapping the period, else the person's latest district.
export function districtDuring(person: RosterPerson, from: string, to: string): string {
  return person.mandates.filter(m => overlaps(m, from, to)).at(-1)?.distrito ?? person.distrito;
}

const district = (value: string) => {
  const key = normalizeText(value).replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return key === 'caba' || key === 'capital federal' || key === 'ciudad autonoma de buenos aires' ? 'ciudad de buenos aires' : key;
};

const exactKey = (nombre: string, lugar: string) => {
  const { surname, given } = nameTokens(nombre);
  return `${surname.join(' ')}|${given.join(' ')}|${district(lugar)}`;
};

// Links each current composition id to the roster person in office on `asOf`: first by exact normalized
// surname, given names and district (unique), then by a linker match. A roster person is given to one deputy
// at most; anything else is reported as unmapped, never guessed.
export function mapCurrentToHistoric(
  current: CurrentDeputy[],
  people: RosterPerson[],
  asOf: string,
): { byDeputyId: Map<string, string>; unmapped: CurrentDeputy[] } {
  const active = activeDuring(people, asOf, asOf);
  const byKey = new Map<string, RosterPerson[]>();
  for (const person of active) {
    const key = exactKey(person.nombre, districtDuring(person, asOf, asOf));
    byKey.set(key, [...(byKey.get(key) ?? []), person]);
  }
  const found = new Map<string, string>();
  const used = new Set<string>();
  for (const deputy of current) {
    const candidates = byKey.get(exactKey(deputy.nombre, deputy.lugar));
    if (candidates?.length !== 1 || used.has(candidates[0].hcdnId)) continue;
    found.set(deputy.id, candidates[0].hcdnId);
    used.add(candidates[0].hcdnId);
  }
  const linker = createLinker(active.map(p => ({ id: p.hcdnId, nombre: p.nombre, lugar: districtDuring(p, asOf, asOf) })));
  for (const deputy of current) {
    if (found.has(deputy.id)) continue;
    const result = linker.link(deputy.nombre, deputy.lugar);
    if (result.status !== 'matched' || !result.deputyId || used.has(result.deputyId)) continue;
    found.set(deputy.id, result.deputyId);
    used.add(result.deputyId);
  }
  const byDeputyId = new Map(current.filter(d => found.has(d.id)).map(d => [d.id, found.get(d.id)!]));
  return { byDeputyId, unmapped: current.filter(d => !found.has(d.id)) };
}
