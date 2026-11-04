import test from 'node:test';
import assert from 'node:assert/strict';
import {
  absoluteUrl,
  blocDescription,
  committeeDescription,
  deputyDescription,
  displayName,
  initials,
  jsonLdScript,
  personJsonLd,
  provinceDescription,
  robotsTxt,
  senatorDescription,
  shareImagePath,
  siteJsonLd,
  sitemapXml,
  staticPagePath,
  topicDescription,
} from './seo.ts';

const site = new URL('https://congreso-abierto-iota.vercel.app');

test('deputyDescription follows the ficha example: name, district, bloc, legs, bills and committees', () => {
  assert.equal(
    deputyDescription({ nombre: 'Yedlin, Pablo Raúl', distrito: 'Tucumán', bloc: 'Independencia', legs: 185, bills: 69, committees: 7 }),
    'Yedlin, Pablo Raúl, diputado/a por Tucumán (bloque Independencia): 185 tramos de viaje, 69 proyectos y 7 comisiones. Con fuente oficial y período.',
  );
});

test('deputyDescription uses singulars, thousands separators and skips legs the source does not cover', () => {
  assert.equal(
    deputyDescription({ nombre: 'Aguirre, Hilda', distrito: 'La Rioja', bloc: 'Unión por la Patria', legs: null, bills: 1, committees: 1 }),
    'Aguirre, Hilda, diputado/a por La Rioja (bloque Unión por la Patria): 1 proyecto y 1 comisión. Con fuente oficial y período.',
  );
  assert.match(
    deputyDescription({ nombre: 'A, B', distrito: null, bloc: 'X', legs: 1, bills: 1200, committees: 0 }),
    /^A, B, diputado\/a nacional \(bloque X\): 1 tramo de viaje, 1\.200 proyectos y 0 comisiones\./,
  );
});

test('every description stays under 160 characters, dropping the bloc before the facts', () => {
  const long = deputyDescription({
    nombre: 'Santillán Juárez Brahim, Juliana',
    distrito: 'Ciudad Autónoma de Buenos Aires',
    bloc: 'Partido Obrero en el Frente de Izquierda y de Trabajadores-Unidad',
    legs: 1234,
    bills: 456,
    committees: 12,
  });
  assert.ok(long.length < 160, `${long.length}: ${long}`);
  assert.match(long, /1\.234 tramos de viaje, 456 proyectos y 12 comisiones/);
  const huge = deputyDescription({ nombre: 'X'.repeat(150), distrito: 'Y'.repeat(40), bloc: 'Z', legs: 1, bills: 1, committees: 1 });
  assert.ok(huge.length < 160 && huge.endsWith('…'), huge);
});

test('senatorDescription names province, bloc, actas, attendance and bills, in title case for capitalized names', () => {
  assert.equal(
    senatorDescription({ nombre: 'ABAD, MAXIMILIANO', provincia: 'Buenos Aires', bloc: 'UCR - Unión Cívica Radical', actas: 412, asistencia: 0.956, bills: 12 }),
    'Abad, Maximiliano, senador/a por Buenos Aires (bloque UCR - Unión Cívica Radical): 412 actas, 95,6 % de asistencia y 12 proyectos. Con fuente oficial.',
  );
  assert.equal(
    senatorDescription({ nombre: 'Lopez, Ana', provincia: 'Salta', bloc: 'PJ', actas: null, asistencia: null, bills: 0 }),
    'Lopez, Ana, senador/a por Salta (bloque PJ): 0 proyectos. Con fuente oficial.',
  );
});

test('bloc, province, committee and topic descriptions are descriptive and under 160 characters', () => {
  const texts = [
    blocDescription({ titulo: 'Independencia', camara: 'diputados', seats: 3, chamberSeats: 257, districts: 1 }),
    blocDescription({ titulo: 'Partido Obrero en el Frente de Izquierda y de Trabajadores-Unidad', camara: 'senado', seats: 1, chamberSeats: 72, districts: 1 }),
    provinceDescription({ nombre: 'Tucumán', deputies: 9, senators: 3 }),
    committeeDescription({ titulo: 'Acción Social y Salud Pública', tipo: 'permanente', integrantes: 47, blocs: 6, districts: 20 }),
    topicDescription('diputados', 257),
    topicDescription('senado', 72, 310),
    topicDescription('proyectos', 14711),
    topicDescription('viajes', 120),
  ];
  for (const text of texts) assert.ok(text.length < 160, `${text.length}: ${text}`);
  assert.equal(texts[0], 'Bloque Independencia en Diputados: 3 de 257 bancas, de 1 distrito. Integrantes, comisiones, proyectos y viajes, con fuente oficial y período.');
  assert.equal(texts[1], 'Bloque Partido Obrero en el Frente de Izquierda y de Trabajadores-Unidad en el Senado: 1 de 72 bancas, de 1 distrito.');
  assert.equal(texts[2], 'Tucumán: 9 diputados y 3 senadores nacionales, con sus bloques, viajes, comisiones, proyectos y votaciones. Con fuente oficial y período.');
  assert.equal(texts[3], 'Acción Social y Salud Pública, comisión permanente de Diputados: 47 integrantes de 6 bloques y 20 distritos. Autoridades e integrantes, con fuente oficial.');
  assert.match(texts[5], /^Los 72 senadores y senadoras en funciones: asistencia, lealtad al bloque y cohesión de cada bloque en 310 actas/);
  assert.match(texts[6], /^14\.711 proyectos presentados por los diputados y diputadas en funciones/);
  assert.equal(
    committeeDescription({ titulo: 'Comisión sin nombre publicado (99)', tipo: null, integrantes: 0, blocs: 0, districts: 0 }),
    'Comisión sin nombre publicado (99), comisión de Diputados. Autoridades e integrantes, con fuente oficial.',
  );
});

test('displayName and initials follow the ficha header', () => {
  assert.equal(displayName('KIRCHNER, ALICIA MARGARITA ANTONIA'), 'Kirchner, Alicia Margarita Antonia');
  assert.equal(displayName('Yedlin, Pablo Raúl'), 'Yedlin, Pablo Raúl');
  assert.equal(initials('Yedlin, Pablo Raúl'), 'PY');
  assert.equal(initials('ÁLVAREZ, ÉRIKA'), 'ÉÁ');
  assert.equal(initials('Cher'), 'C');
});

test('shareImagePath maps only legislator pages to their PNG', () => {
  assert.equal(shareImagePath('/diputados/dip-yedlin-pablo-raul-tucuman/'), '/og/diputados/dip-yedlin-pablo-raul-tucuman.png');
  assert.equal(shareImagePath('/senadores/sen-546/'), '/og/senadores/sen-546.png');
  assert.equal(shareImagePath('/diputados/'), null);
  assert.equal(shareImagePath('/bloques/diputados/pro/'), null);
  assert.equal(shareImagePath('/'), null);
});

test('absoluteUrl resolves root paths against the site, with or without a trailing slash or base path', () => {
  assert.equal(absoluteUrl(site, '/diputados/x/'), 'https://congreso-abierto-iota.vercel.app/diputados/x/');
  assert.equal(absoluteUrl(new URL('https://example.org/base'), '/og.png'), 'https://example.org/base/og.png');
  assert.equal(absoluteUrl(undefined, '/og.png'), '/og.png');
});

test('staticPagePath turns page module keys into routes and skips dynamic and error pages', () => {
  assert.equal(staticPagePath('./index.astro'), '/');
  assert.equal(staticPagePath('./diputados/index.astro'), '/diputados/');
  assert.equal(staticPagePath('./metodologia.astro'), '/metodologia/');
  assert.equal(staticPagePath('./diputados/[id].astro'), null);
  assert.equal(staticPagePath('./404.astro'), null);
  assert.equal(staticPagePath('./500.astro'), null);
});

test('sitemapXml lists absolute, escaped, sorted, unique URLs with lastmod', () => {
  const xml = sitemapXml(site, ['/diputados/', '/', '/a&b/', '/'], '2026-11-04');
  assert.equal(
    xml,
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '<url><loc>https://congreso-abierto-iota.vercel.app/</loc><lastmod>2026-11-04</lastmod></url>\n' +
      '<url><loc>https://congreso-abierto-iota.vercel.app/a&amp;b/</loc><lastmod>2026-11-04</lastmod></url>\n' +
      '<url><loc>https://congreso-abierto-iota.vercel.app/diputados/</loc><lastmod>2026-11-04</lastmod></url>\n' +
      '</urlset>\n',
  );
  assert.doesNotMatch(sitemapXml(site, ['/'], null), /lastmod/);
});

test('robotsTxt allows everything and points to the absolute sitemap', () => {
  assert.equal(robotsTxt(site), 'User-agent: *\nAllow: /\n\nSitemap: https://congreso-abierto-iota.vercel.app/sitemap.xml\n');
});

test('personJsonLd describes the legislator with chamber, bloc, province, url and share image', () => {
  const person = personJsonLd(site, {
    camara: 'diputados',
    nombre: 'Yedlin, Pablo Raúl',
    url: '/diputados/dip-y/',
    bloc: { titulo: 'Independencia', url: '/bloques/diputados/independencia/' },
    province: 'Tucumán',
  });
  assert.deepEqual(person, {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Pablo Raúl Yedlin',
    givenName: 'Pablo Raúl',
    familyName: 'Yedlin',
    jobTitle: 'Diputado/a nacional',
    url: 'https://congreso-abierto-iota.vercel.app/diputados/dip-y/',
    image: 'https://congreso-abierto-iota.vercel.app/og/diputados/dip-y.png',
    memberOf: [
      { '@type': 'GovernmentOrganization', name: 'Cámara de Diputados de la Nación Argentina', url: 'https://www.hcdn.gob.ar/' },
      { '@type': 'Organization', name: 'Bloque Independencia', url: 'https://congreso-abierto-iota.vercel.app/bloques/diputados/independencia/' },
    ],
    workLocation: { '@type': 'AdministrativeArea', name: 'Tucumán' },
    areaServed: { '@type': 'AdministrativeArea', name: 'Tucumán' },
  });
  const senator = personJsonLd(site, { camara: 'senado', nombre: 'ABAD, MAXIMILIANO', url: '/senadores/sen-546/', bloc: { titulo: 'PRO', url: '/bloques/senado/pro/' }, province: null });
  assert.equal(senator.name, 'Maximiliano Abad');
  assert.equal(senator.jobTitle, 'Senador/a nacional');
  assert.equal(senator.image, 'https://congreso-abierto-iota.vercel.app/og/senadores/sen-546.png');
  assert.equal((senator.memberOf as { name: string }[])[0].name, 'Senado de la Nación Argentina');
  assert.equal(senator.workLocation, undefined);
});

test('siteJsonLd has a WebSite and an Organization and no SearchAction', () => {
  const graph = siteJsonLd(site, 'Descripción');
  const text = JSON.stringify(graph);
  assert.deepEqual((graph['@graph'] as { '@type': string }[]).map(n => n['@type']), ['WebSite', 'Organization']);
  assert.doesNotMatch(text, /SearchAction/);
  assert.match(text, /"url":"https:\/\/congreso-abierto-iota\.vercel\.app\/"/);
  assert.match(text, /"logo":"https:\/\/congreso-abierto-iota\.vercel\.app\/apple-touch-icon\.png"/);
});

test('jsonLdScript escapes "<" so data cannot close the script tag, and still parses back', () => {
  const data = { name: 'a</script><script>alert(1)</script>' };
  const text = jsonLdScript(data);
  assert.doesNotMatch(text, /</);
  assert.deepEqual(JSON.parse(text), data);
});
