// Committed data snapshot: JSON with tagged Maps and Sets, written so unchanged data gives an unchanged file.
import { createHash } from 'node:crypto';

export type DataMode = 'snapshot' | 'refresh';

export function dataMode(value: string | undefined): DataMode {
  if (!value || value === 'snapshot') return 'snapshot';
  if (value === 'refresh') return 'refresh';
  throw new Error(`DATA_MODE must be "snapshot" or "refresh", got "${value}"`);
}

export const missingSnapshotMessage = (name: string) => `Data snapshot missing: ${name} — run npm run refresh-data`;

// --- Encoding ---------------------------------------------------------------------

const TAGS = new Set(['$map', '$set', '$obj', '$num']);
// Containers nested less deep than this get one entry per line; deeper ones stay on that line.
const LINE_DEPTH = 2;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const typeName = (value: unknown) =>
  typeof value === 'object' && value !== null ? value.constructor?.name ?? 'object' : typeof value;

// Map keys and Set values are written in code-unit order, so a source that reorders its rows gives the same file.
const byKey = (a: [string, Json], b: [string, Json]) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

function sortedEntries(items: Iterable<[unknown, unknown]>, path: string): Json[] {
  return [...items]
    .map(([key, value], i): [string, Json, Json] => {
      const k = encode(key, `${path}<key ${i}>`);
      return [typeof k === 'string' ? k : JSON.stringify(k), k, encode(value, `${path}[${JSON.stringify(k)}]`)];
    })
    .sort((a, b) => byKey([a[0], a[1]], [b[0], b[1]]))
    .map(([, key, value]) => [key, value]);
}

function encode(value: unknown, path: string): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : { $num: String(value) };
  if (typeof value !== 'object') throw new Error(`snapshot: cannot serialize ${typeName(value)} at ${path}`);
  if (Array.isArray(value)) {
    return value.map((item, i) => {
      if (item === undefined) throw new Error(`snapshot: cannot serialize undefined at ${path}[${i}]`);
      return encode(item, `${path}[${i}]`);
    });
  }
  if (value instanceof Map) return { $map: sortedEntries(value, path) };
  if (value instanceof Set) return { $set: sortedEntries([...value].map(v => [v, null]), path).map(e => (e as Json[])[0]) };
  if (!isPlainObject(value)) throw new Error(`snapshot: cannot serialize ${typeName(value)} at ${path}`);
  const out: Record<string, Json> = {};
  for (const [key, item] of Object.entries(value)) {
    // Like JSON: an undefined property is the same as a missing one.
    if (item !== undefined) out[key] = encode(item, `${path}.${key}`);
  }
  const keys = Object.keys(out);
  return keys.length === 1 && TAGS.has(keys[0]) ? { $obj: out } : out;
}

function print(value: Json, depth: number): string {
  if (depth >= LINE_DEPTH || value === null || typeof value !== 'object') return JSON.stringify(value);
  const inner = '  '.repeat(depth + 1);
  const close = '  '.repeat(depth);
  const lines = (items: string[], open: string, end: string) =>
    items.length === 0 ? open + end : `${open}\n${items.map(item => inner + item).join(',\n')}\n${close}${end}`;
  if (Array.isArray(value)) return lines(value.map(item => print(item, depth + 1)), '[', ']');
  const keys = Object.keys(value);
  if (keys.length === 1 && (keys[0] === '$map' || keys[0] === '$set')) {
    const items = value[keys[0]] as Json[];
    return lines(items.map(item => print(item, depth + 1)), `{${JSON.stringify(keys[0])}: [`, ']}');
  }
  if (keys.length === 1 && TAGS.has(keys[0])) return JSON.stringify(value);
  return lines(keys.map(key => `${JSON.stringify(key)}: ${print(value[key], depth + 1)}`), '{', '}');
}

export function serialize(value: unknown): string {
  return print(encode(value, '$'), 0) + '\n';
}

function decode(value: Json): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(decode);
  const keys = Object.keys(value);
  if (keys.length === 1 && TAGS.has(keys[0])) {
    const inner = value[keys[0]];
    if (keys[0] === '$map') return new Map((inner as Json[][]).map(([k, v]) => [decode(k), decode(v)]));
    if (keys[0] === '$set') return new Set((inner as Json[]).map(decode));
    if (keys[0] === '$num') return Number(inner);
    return decodeObject(inner as Record<string, Json>);
  }
  return decodeObject(value);
}

const decodeObject = (value: Record<string, Json>) => Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));

export function deserialize(text: string): unknown {
  return decode(JSON.parse(text) as Json);
}

// --- meta.json --------------------------------------------------------------------

export interface SourceMeta {
  // ISO time of the refresh that last changed this entry's content
  fetchedAt: string;
  contentHash: string;
  items: number;
  period?: { desde: string | null; hasta: string | null };
}

export interface SnapshotMeta {
  // ISO time of the last refresh run
  generatedAt: string;
  sources: Record<string, SourceMeta>;
}

export const contentHash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

export interface SnapshotEntry {
  text: string;
  items: number;
  period?: SourceMeta['period'];
}

export function updateMeta(previous: SnapshotMeta | null, name: string, entry: SnapshotEntry, now: string): SnapshotMeta {
  const hash = contentHash(entry.text);
  const before = previous?.sources[name];
  const source: SourceMeta = { fetchedAt: before?.contentHash === hash ? before.fetchedAt : now, contentHash: hash, items: entry.items };
  if (entry.period) source.period = entry.period;
  const sources = { ...previous?.sources, [name]: source };
  const sorted = Object.fromEntries(Object.keys(sources).sort().map(key => [key, sources[key]]));
  return { generatedAt: now, sources: sorted };
}
