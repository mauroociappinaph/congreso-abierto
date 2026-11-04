// Accent-insensitive matching for SearchBox: pure, so the client script and the tests share it.

export interface SearchEntry {
  // group heading, e.g. "Diputados", "Bloques"
  type: string;
  name: string;
  // second line, e.g. "Tucumán · Unión por la Patria"; also searched
  meta?: string;
  // right column, e.g. "7,71 tramos/mes"
  right?: string;
  href: string;
  // short badge, e.g. initials "PY" or "B"
  badge?: string;
  // extra words matched but never shown, e.g. province aliases ("caba")
  keywords?: string;
}

export interface SearchGroup {
  type: string;
  // matches in the group before the per-group cap
  total: number;
  entries: SearchEntry[];
}

export interface SearchOptions {
  // group order; types not listed follow, alphabetically
  order?: string[];
  perGroup?: number;
  minLength?: number;
}

export const DEFAULT_ORDER = ['Diputados', 'Senadores', 'Bloques', 'Provincias', 'Comisiones'];

// Folds one character at a time, so folded positions map back to the original text.
function foldChars(text: string): { folded: string; origin: number[] } {
  let folded = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const part = text[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const ch of part) {
      folded += ch;
      origin.push(i);
    }
  }
  return { folded, origin };
}

export const fold = (text: string) => foldChars(text).folded;

const words = (query: string) => fold(query).split(/\s+/).filter(Boolean);

// [start, end) ranges of the original text where each query word first appears, sorted and not overlapping.
export function matchRanges(text: string, query: string): [number, number][] {
  const { folded, origin } = foldChars(text);
  const ranges: [number, number][] = [];
  for (const word of words(query)) {
    const at = folded.indexOf(word);
    if (at < 0) continue;
    ranges.push([origin[at], origin[at + word.length - 1] + 1]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges.filter((range, i) => i === 0 || range[0] >= ranges[i - 1][1]);
}

// 0 name starts with the query, 1 a name word starts with it, 2 the name contains it, 3 only the meta does.
function rank(entry: SearchEntry, terms: string[]): number {
  const name = fold(entry.name);
  const first = terms[0];
  if (terms.every(t => name.includes(t))) {
    if (name.startsWith(first)) return 0;
    return name.split(/[\s,.\-()]+/).some(w => w.startsWith(first)) ? 1 : 2;
  }
  return 3;
}

export function searchEntries(entries: SearchEntry[], query: string, options: SearchOptions = {}): SearchGroup[] {
  const { order = DEFAULT_ORDER, perGroup = 5, minLength = 2 } = options;
  const terms = words(query);
  if (terms.join(' ').length < minLength) return [];

  const byType = new Map<string, { entry: SearchEntry; rank: number }[]>();
  for (const entry of entries) {
    const haystack = fold(`${entry.name} ${entry.meta ?? ''} ${entry.keywords ?? ''}`);
    if (!terms.every(t => haystack.includes(t))) continue;
    const list = byType.get(entry.type) ?? [];
    list.push({ entry, rank: rank(entry, terms) });
    byType.set(entry.type, list);
  }

  const position = (type: string) => {
    const i = order.indexOf(type);
    return i < 0 ? order.length : i;
  };
  return [...byType.keys()]
    .sort((a, b) => position(a) - position(b) || a.localeCompare(b, 'es'))
    .map(type => {
      const hits = byType.get(type)!.sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name, 'es'));
      return { type, total: hits.length, entries: hits.slice(0, perGroup).map(h => h.entry) };
    });
}
