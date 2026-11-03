// Pure parsing and filtering helpers shared by the build (sources.ts) and the browser (chamber script).

export type Row = Record<string, string>;

export interface Concept {
  concepto: string;
  importe: number;
}

export interface PaySummary {
  dieta: number | null;
  gastosRepresentacion: number | null;
  bruto: number;
  descuentos: number;
  neto: number;
}

export interface Deputy {
  id: string;
  nombre: string;
  lugar: string;
  bloque: string;
  mandato: string;
  fechaJura: string;
  fechaInicio: string;
}

export interface Senator {
  id: string;
  nombre: string;
  lugar: string;
  bloque: string;
  partido: string;
  mandato: string;
  email: string;
  telefono: string;
  foto: string;
}

export type Legislator = Deputy | Senator;

// RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes, CRLF.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

export function parseCsv(text: string): Row[] {
  const [header, ...rows] = parseCsvRows(text);
  if (!header) return [];
  const keys = header.map(h => h.trim());
  return rows.map(values => Object.fromEntries(keys.map((k, i) => [k, (values[i] ?? '').trim()])));
}

// "6.125.805,18" -> 6125805.18 ; "328751,12" -> 328751.12
export function parseArsAmount(value: string | null | undefined): number | null {
  const clean = String(value ?? '').replace(/\s|\$/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

function pick(row: Row, prefix: string): string {
  const key = Object.keys(row).find(k => k.toLowerCase().startsWith(prefix));
  return key ? row[key] : '';
}

export function parseConcepts(text: string): Concept[] {
  const seen = new Set<string>();
  const concepts: Concept[] = [];
  for (const row of parseCsv(text)) {
    const concepto = pick(row, 'concepto');
    const importe = parseArsAmount(pick(row, 'importe'));
    if (!concepto || importe === null || seen.has(concepto)) continue;
    seen.add(concepto);
    concepts.push({ concepto, importe });
  }
  return concepts;
}

const round = (n: number) => Math.round(n * 100) / 100;
const sum = (list: Concept[]) => round(list.reduce((t, c) => t + c.importe, 0));

export function summarizePay(remuneraciones: Concept[], descuentos: Concept[]): PaySummary {
  const find = (re: RegExp) => remuneraciones.find(c => re.test(normalizeText(c.concepto)))?.importe ?? null;
  const bruto = sum(remuneraciones);
  const totalDescuentos = sum(descuentos);
  return {
    dieta: find(/^dieta/),
    gastosRepresentacion: find(/representacion/),
    bruto,
    descuentos: totalDescuentos,
    neto: round(bruto + totalDescuentos),
  };
}

export function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const slug = (value: string) => normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizeDeputy(row: Row): Deputy {
  return {
    id: 'dip-' + slug(`${row.APELLIDO} ${row.NOMBRE} ${row.DISTRITO ?? ''}`),
    nombre: `${row.APELLIDO}, ${row.NOMBRE}`,
    lugar: row.DISTRITO || '',
    bloque: (row.BLOQUE || '').trim() || 'SIN BLOQUE',
    mandato: row.MANDATO || '',
    fechaJura: row.FECHA_DE_JURA || '',
    fechaInicio: row.FECHA_DE_INICIO || '',
  };
}

export function normalizeSenator(row: Row): Senator {
  return {
    id: 'sen-' + (row.ID || slug(`${row.APELLIDO} ${row.NOMBRE}`)),
    nombre: `${row.APELLIDO}, ${row.NOMBRE}`,
    lugar: row.PROVINCIA || '',
    bloque: (row.BLOQUE || '').trim() || 'SIN BLOQUE',
    partido: row['PARTIDO O ALIANZA'] || '',
    mandato: row.D_LEGAL && row.C_LEGAL ? `${row.D_LEGAL} a ${row.C_LEGAL}` : '',
    email: row.EMAIL || '',
    telefono: row.TELEFONO || '',
    foto: row.FOTO || '',
  };
}

interface Filterable {
  nombre: string;
  lugar: string;
  bloque: string;
}

export function filterLegislators<T extends Filterable>(list: T[], { query = '', bloque = 'all' } = {}): T[] {
  const q = normalizeText(query).trim();
  return list.filter(l => {
    if (bloque !== 'all' && l.bloque !== bloque) return false;
    return !q || normalizeText(`${l.nombre} ${l.lugar}`).includes(q);
  });
}

export function countByBloque(list: { bloque: string }[]): { bloque: string; count: number }[] {
  const counts = new Map<string, number>();
  list.forEach(l => counts.set(l.bloque, (counts.get(l.bloque) ?? 0) + 1));
  return [...counts]
    .map(([bloque, count]) => ({ bloque, count }))
    .sort((a, b) => b.count - a.count || a.bloque.localeCompare(b.bloque, 'es'));
}

export function formatArs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'Sin datos';
  const sign = amount < 0 ? '-' : '';
  const [int, dec] = Math.abs(amount).toFixed(2).split('.');
  return `${sign}$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

// Stable color per bloque, so new bloques never fall back to one gray.
export function bloqueColor(bloque: string): string {
  let hash = 0;
  for (const ch of bloque) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return `hsl(${hash % 360}, 55%, 42%)`;
}
