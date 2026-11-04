// /sitemap.xml: every HTML page of the site with its absolute URL. Static pages come from the page modules, the
// entity pages from the same indexes their getStaticPaths read; lastmod is the day of the data snapshot.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import { sitemapXml, staticPagePath } from '../lib/seo.ts';
import { loadEntities } from '../lib/sources.ts';

const pageModules = Object.keys(import.meta.glob('./**/*.astro'));

function snapshotDay(): string | null {
  const meta = join(process.cwd(), 'src/data/snapshot/meta.json');
  if (!existsSync(meta)) return null;
  const { generatedAt } = JSON.parse(readFileSync(meta, 'utf8')) as { generatedAt?: string };
  return generatedAt ? generatedAt.slice(0, 10) : null;
}

export const GET: APIRoute = async ({ site }) => {
  const { relations, blocs, provinces, committees } = await loadEntities();
  const paths = [
    ...pageModules.map(staticPagePath).filter((path): path is string => path !== null),
    ...[...relations.values()].map(r => r.url),
    ...blocs.map(b => b.url),
    ...provinces.map(p => p.url),
    ...committees.map(c => c.url),
  ];
  return new Response(sitemapXml(site, paths, snapshotDay()), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
