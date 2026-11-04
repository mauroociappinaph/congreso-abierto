import { defineConfig } from 'astro/config';

// Static site: data is fetched at build time, so rebuild to refresh it.
// `site` makes canonical, Open Graph, JSON-LD and sitemap URLs absolute; SITE_URL overrides the production URL
// (e.g. for a preview deploy).
export default defineConfig({
  site: process.env.SITE_URL || 'https://congreso-abierto-iota.vercel.app',
});
