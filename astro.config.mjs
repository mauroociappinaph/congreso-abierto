import { defineConfig } from 'astro/config';

// Static site: data is fetched at build time, so rebuild to refresh it.
// SITE_URL (e.g. https://example.org/) makes the Open Graph image and page URLs absolute; without it they stay relative.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
});
