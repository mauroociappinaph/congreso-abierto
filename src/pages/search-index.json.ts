// Global search index (/search-index.json): the entities index in the shape SearchBox reads. Fetched by the
// header box on first focus, so pages do not inline it.
import type { APIRoute } from 'astro';
import { fold, type SearchEntry } from '../components/ui/search.ts';
import { loadEntities } from '../lib/sources.ts';
import type { SearchType } from '../lib/entities.ts';

const GROUPS: Record<SearchType, { type: string; badge?: string }> = {
  diputado: { type: 'Diputados' },
  senador: { type: 'Senadores' },
  bloque: { type: 'Bloques', badge: 'B' },
  provincia: { type: 'Provincias', badge: 'P' },
  comision: { type: 'Comisiones', badge: 'C' },
};

// "Yedlin, Pablo Raúl" -> "PY"
const initials = (nombre: string) => {
  const [surname = '', given = ''] = nombre.split(',').map(part => part.trim());
  return `${given.charAt(0)}${surname.charAt(0)}`.toUpperCase() || nombre.charAt(0).toUpperCase();
};

export const GET: APIRoute = async () => {
  const { search } = await loadEntities();
  const index: SearchEntry[] = search.map(entry => {
    const group = GROUPS[entry.type];
    // Only keep keywords that add words the label and meta do not show (aliases like "caba"), to keep the index small.
    const shown = fold(`${entry.label} ${entry.sub ?? ''}`);
    const extra = entry.keywords.split(' ').filter(word => word && !shown.includes(fold(word))).join(' ');
    return { type: group.type, name: entry.label, meta: entry.sub, href: entry.url, badge: group.badge ?? initials(entry.label), ...(extra && { keywords: extra }) };
  });
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
