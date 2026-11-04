# SEO, per-legislator share images, methodology, committee names, Senate bills linkage, analytics

Five improvements to the live site (https://congreso-abierto-iota.vercel.app, repo github.com/mauroociappinaph/congreso-abierto, branch main).
Read until `## Log`. Technical artifacts in English; UI copy in Spanish (Argentina). Builds read the committed snapshot (no network).

## Specs (user's request, verbatim)

- **S1:** "SEO, que hoy falta: un sitemap.xml con las 442 páginas; robots.txt; una descripción propia en cada ficha ("Yedlin, Pablo Raúl, diputado por Tucumán: 185 tramos, 69 proyectos…"); datos estructurados schema.org/Person. Hoy Google no encuentra las fichas fácilmente, y es lo que más visitas trae: la gente busca el nombre de su diputado."
- **S2:** "Imagen para redes por ficha. Hoy todas las páginas comparten la misma. Con una imagen por legislador (foto inicial, número clave y logo), cada link compartido se ve distinto."
- **S3:** "Página de metodología. Explica el emparejamiento de nombres, la comparación por distancia, el índice de Rice y los defectos de las fuentes que encontramos. Para el portfolio es oro y le da credibilidad frente a periodistas."
- **S4:** "Nombres de comisiones con tildes. "Accion Social y Salud Publica" se ve descuidado. Se arregla con una tabla de nombres hecha a mano."
- **S5:** "Proyectos que vienen del Senado: solo el 51,7 % de los autores se empareja. Habría que investigarlo. Analítica sin cookies (Vercel Analytics o Plausible) para saber qué buscan las visitas. Es clave para decidir qué sumar."

- **S6 (user, verbatim):** "Agrerega tambien al principio los diputados que mas gastan y en que con su desglose"
- **S7 (user choice, verbatim):** "Viáticos oficiales + viajes (Recomendado)" — option text: "Ranking por viáticos de misiones al exterior en USD con desglose por misión (lugar, motivo, días, monto), y al lado el ranking de tramos de viaje aclarando que la Cámara no publica su costo. Todo con datos oficiales."

## Design decisions (parent)

- Canonical site URL: `SITE_URL` env, default `https://congreso-abierto-iota.vercel.app` in astro.config so sitemap/canonical/og work in CI and locally too. Never use congreso-abierto.vercel.app (another person's site).
- S2 "foto inicial" = the legislator's initials avatar (senator photos are remote and licensing is unclear; no remote images at build). Share images are PNG 1200×630 generated at build time, offline, deterministic; social networks do not accept SVG og images.
- S5 analytics: Vercel Web Analytics (no cookies, already on Vercel). Search queries as custom events need a paid Vercel plan; on Hobby only page views are counted. Never send the raw search query anywhere else; no personal data.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| E1 | S1, S2 | worker | done | 4b823b0 |
| E2 | S3 | worker + parent | done | feat(ui): add the methodology page |
| E3 | S4 | worker | done | 7c3c27a |
| E4 | S5 (Senate linkage) | worker + parent | done | 951ffdb + fix(bills): never credit Executive bills |
| E5 | S5 (analytics) | parent | done | feat(analytics) + dashboard enable |
| E6 | S6, S7 | worker, after E1 and E3 | pending | |

## Log

- L1 (user, verbatim): the S1–S5 list above, introduced with "Hace esto:".
- L2 (parent evidence): F5a/F5b recorded Senate-origin bills 31 of 60 linked (51,7 %); unmatched names seen then: `ASUNTOS CONSTITUCIONALES`, Milei, Santilli (Executive and committees, not senators).
- L3 (user, verbatim): "Agrerega tambien al principio los diputados que mas gastan y en que con su desglose"
- L4 (parent): no official per-deputy spending exists: dieta/representación are the same for all; desarraigo/movilidad are generic amounts without recipients; domestic trips have no cost. Per-deputy money exists only as official-mission viáticos (USD, many "-"). User chose S7. Wording rule: "viáticos otorgados/consumidos", never "gasta de más"; show missions without published viáticos as "sin monto publicado", not zero.
- L5 (evidence, E4): no real Senate linkage misses: 24/24 person authors linked; the 29 unlinked bills are Milei (14, PE), Santilli (2, PE) and Asuntos Constitucionales (13, OV) → institutional, Senate rows 31/31. Parent extended it to Diputados: 85 PE/JGM/OV bills (Milei, Francos, Adorni, Santilli, Posse, Petri, Presti, committee) now institutional; Santilli no longer credited, Petri keeps only his 2 -D- 2026 bills. Diputados rows linked 99.7 %.
- L6 (evidence, E3): official accented names for 45 committees from hcdn.gob.ar page titles; test fails on a new committee. Blocs "Coalicion Civica" and "Produccion y Trabajo" stay unaccented: no official accented spelling found.
- L7 (evidence, live): sitemap 442 URLs (443 with /metodologia/), robots, per-page descriptions, JSON-LD, 329 share PNGs (57–72 KB) live; /metodologia/ live. Parent changes to E2: the regional-method table shows district instead of names (the regional flag was a method error); description shortened to 141 characters. Analytics script ships only in Vercel builds; /_vercel/insights/script.js returns 404 until Web Analytics is enabled in the Vercel project (owner action).
- L8 (evidence, E5 closed): Web Analytics enabled in the Vercel dashboard (Hobby plan, included; Pro not selected) via Chrome DevTools on the owner's session, as asked ("activar la analítica en el panel de Vercel vos", "Hacelo desde chrome dev tool"). Redeployed; /_vercel/insights/script.js 200; a real visit sent POST /_vercel/insights/view 200 and the dashboard showed 1 visitor, 1 page view.
