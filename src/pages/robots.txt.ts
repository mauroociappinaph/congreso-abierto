// /robots.txt: every page may be crawled; points to the absolute sitemap.
import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/seo.ts';

export const GET: APIRoute = ({ site }) => new Response(robotsTxt(site), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
