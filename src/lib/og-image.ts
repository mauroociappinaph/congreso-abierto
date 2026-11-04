// Share image of a legislator page (S2): a 1200x630 PNG drawn at build time, offline and deterministic. The card is an
// SVG (initials avatar, name, chamber, district and bloc, one key number, the monochrome seal) rasterized by resvg
// (WASM) with the OFL fonts in src/assets/fonts; system fonts are never loaded, so every machine draws the same pixels.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import type { Camara } from './entities.ts';
import { displayName, initials } from './seo.ts';
import { formatNumber, formatShare } from './view.ts';

export const WIDTH = 1200;
export const HEIGHT = 630;

// design tokens (src/styles/tokens.css)
const INK = '#1c1b19';
const MUTED = '#55524b';
const PAPER = '#fbfaf7';
const LINE = '#d9d5cc';
const ACCENT = '#1f4e79';
const ACCENT_INK = '#163a5c';
const CELESTE_50 = '#eaf3fb';

const SERIF = 'Source Serif 4';
const SANS = 'Source Sans 3';
export type FontName = 'serif' | 'sans' | 'sans-bold';
const FONTS: Record<FontName, { family: string; weight: number }> = {
  serif: { family: SERIF, weight: 600 },
  sans: { family: SANS, weight: 400 },
  'sans-bold': { family: SANS, weight: 600 },
};

// width in px of `text` at `size` in `font`
export type Measure = (text: string, size: number, font: FontName) => number;

export interface CardInput {
  camara: Camara;
  nombre: string;
  distrito: string | null;
  bloc: string;
  key: { value: string; label: string };
}

// The one number of the card: deputies' legs per month (bills without travel data), senators' attendance (bills without votes).
export function keyFigure(f: { camara: Camara; legsPerMonth: number | null; bills: number; asistencia: number | null }): CardInput['key'] {
  if (f.camara === 'diputados' && f.legsPerMonth !== null) return { value: formatNumber(f.legsPerMonth), label: 'tramos de viaje por mes' };
  if (f.camara === 'senado' && f.asistencia !== null) return { value: formatShare(f.asistencia), label: 'de asistencia en las actas del Senado' };
  return { value: formatNumber(f.bills), label: f.bills === 1 ? 'proyecto como primer firmante' : 'proyectos como primer firmante' };
}

// Greedy word wrap into at most maxLines lines at the largest size that fits; past the smallest size, the last line
// is cut with an ellipsis.
export function wrapText(text: string, maxWidth: number, sizes: number[], maxLines: number, measure: (text: string, size: number) => number) {
  const words = text.split(/\s+/).filter(Boolean);
  const wrap = (size: number) => {
    const lines: string[] = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last !== undefined && measure(`${last} ${word}`, size) <= maxWidth) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    return lines;
  };
  for (let lines = 1; lines <= maxLines; lines++) {
    for (const size of sizes) {
      const wrapped = wrap(size);
      if (wrapped.length <= lines && wrapped.every(line => measure(line, size) <= maxWidth)) return { size, lines: wrapped };
    }
  }
  const size = sizes.at(-1)!;
  const lines = wrap(size).slice(0, maxLines);
  let last = lines[maxLines - 1] ?? '';
  while (last && measure(`${last}…`, size) > maxWidth) last = last.slice(0, -1).trimEnd();
  lines[maxLines - 1] = `${last}…`;
  return { size, lines };
}

const esc = (value: string) => value.replace(/[<>&"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]!);
const font = (name: FontName, size: number) => `font-family="${FONTS[name].family}" font-weight="${FONTS[name].weight}" font-size="${size}"`;

// Full monochrome seal of design/logo-congreso-abierto/03-sello.html (the footer seal of SiteLayout), in a 200x200 box.
const SEAL = `<defs><mask id="seal-m" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><g fill="#fff"><rect x="50" y="121" width="100" height="17"/><rect x="48" y="118.5" width="104" height="3"/><rect x="50" y="114" width="12" height="24"/><rect x="138" y="114" width="12" height="24"/><path d="M49.5 114.5C50.5 106 61.5 106 62.5 114.5Z"/><path d="M137.5 114.5C138.5 106 149.5 106 150.5 114.5Z"/><rect x="55.3" y="104.5" width="1.4" height="4"/><rect x="143.3" y="104.5" width="1.4" height="4"/><rect x="76" y="112" width="48" height="26"/><path d="M75 112.5L100 101.5L125 112.5Z"/><rect x="80" y="96" width="40" height="9"/><rect x="79" y="94.5" width="42" height="2"/><rect x="85" y="80" width="30" height="15"/><rect x="83.5" y="78" width="33" height="2.5"/><path d="M86.5 78.5C86.5 62 93 54 100 50C107 54 113.5 62 113.5 78.5Z"/><rect x="97" y="43" width="6" height="8"/><path d="M96 43.5Q100 38.5 104 43.5Z"/><rect x="99.4" y="34" width="1.2" height="6"/><rect x="72" y="136" width="56" height="2.6"/></g><g fill="none" stroke="#000" stroke-linecap="round"><path d="M82.5 114V135.5M89.5 114V135.5M96.5 114V135.5M103.5 114V135.5M110.5 114V135.5M117.5 114V135.5" stroke-width="1.7"/><path d="M88 81V95M92 81V95M96 81V95M100 81V95M104 81V95M108 81V95M112 81V95" stroke-width="1.1"/><path d="M100 51V78.5M93.5 55Q90 64 91.5 78.5M106.5 55Q110 64 108.5 78.5" stroke-width="0.9"/><path d="M50 121.6H150M80 97H120" stroke-width="0.7"/><path d="M83 111.6L100 104L117 111.6" stroke-width="0.7"/><path d="M46 138.6H154" stroke-width="1.2"/></g><g fill="#000"><rect x="65" y="125.5" width="2.5" height="5"/><rect x="70.5" y="125.5" width="2.5" height="5"/><rect x="127" y="125.5" width="2.5" height="5"/><rect x="132.5" y="125.5" width="2.5" height="5"/><rect x="54.8" y="124" width="2.4" height="7"/><rect x="142.8" y="124" width="2.4" height="7"/><rect x="98.6" y="128" width="2.8" height="8"/></g></mask></defs><g fill="none" stroke="${INK}"><circle cx="100" cy="100" r="96" stroke-width="2.6"/><circle cx="100" cy="100" r="91.5" stroke-width="0.8"/><circle cx="100" cy="100" r="70" stroke-width="1.8"/></g><path id="seal-top" d="M24 100A76 76 0 0 1 176 100" fill="none"/><path id="seal-bot" d="M12 100A88 88 0 0 0 188 100" fill="none"/><g fill="${INK}" text-anchor="middle"><text font-family="${SERIF}" font-weight="600" font-size="13.5" letter-spacing="1.8"><textPath href="#seal-top" startOffset="50%">CONGRESO ABIERTO</textPath></text><text font-family="${SANS}" font-weight="600" font-size="9" letter-spacing="1.5"><textPath href="#seal-bot" startOffset="50%">DATOS ABIERTOS · ARGENTINA</textPath></text></g><g fill="${INK}"><circle cx="18.5" cy="100" r="2.3"/><circle cx="181.5" cy="100" r="2.3"/></g><rect x="30" y="30" width="140" height="140" fill="${INK}" mask="url(#seal-m)"/>`;

const PAD = 80;
const AVATAR = { cx: PAD + 100, cy: 250, r: 100 };
const TEXT_X = AVATAR.cx + AVATAR.r + 56;
const TEXT_W = WIDTH - TEXT_X - PAD;
const FOOTER_Y = 512;

export function cardSvg(card: CardInput, measure: Measure): string {
  const role = card.camara === 'diputados' ? 'DIPUTADO/A NACIONAL' : 'SENADOR/A NACIONAL';
  const name = wrapText(displayName(card.nombre), TEXT_W, [68, 62, 56, 50], 2, (t, s) => measure(t, s, 'serif'));
  const where = [card.distrito, `Bloque ${card.bloc}`].filter(Boolean).join(' · ');
  const sub = wrapText(where, TEXT_W, [32, 29, 26], 2, (t, s) => measure(t, s, 'sans'));

  let y = 150;
  const parts: string[] = [`<text x="${TEXT_X}" y="${y}" ${font('sans-bold', 24)} letter-spacing="3" fill="${ACCENT_INK}">${role}</text>`];
  y += 18;
  for (const line of name.lines) {
    y += Math.round(name.size * 1.12);
    parts.push(`<text x="${TEXT_X}" y="${y}" ${font('serif', name.size)} fill="${INK}">${esc(line)}</text>`);
  }
  y += 14;
  for (const line of sub.lines) {
    y += Math.round(sub.size * 1.3);
    parts.push(`<text x="${TEXT_X}" y="${y}" ${font('sans', sub.size)} fill="${MUTED}">${esc(line)}</text>`);
  }

  // key number: big figure with its label beside it, on the baseline above the footer rule
  const keySize = 88;
  const keyY = Math.max(y + 24 + keySize, 440);
  const valueW = measure(card.key.value, keySize, 'serif');
  const label = wrapText(card.key.label, TEXT_W - valueW - 24, [30, 26], 2, (t, s) => measure(t, s, 'sans'));
  parts.push(`<text x="${TEXT_X}" y="${keyY}" ${font('serif', keySize)} fill="${ACCENT}">${esc(card.key.value)}</text>`);
  label.lines.forEach((line, i) => {
    const lineY = keyY - (label.lines.length - 1 - i) * Math.round(label.size * 1.2) - 10;
    parts.push(`<text x="${Math.round(TEXT_X + valueW + 24)}" y="${lineY}" ${font('sans', label.size)} fill="${MUTED}">${esc(line)}</text>`);
  });

  const initialsText = initials(card.nombre);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>`,
    `<rect width="${WIDTH}" height="12" fill="${ACCENT}"/>`,
    `<circle cx="${AVATAR.cx}" cy="${AVATAR.cy}" r="${AVATAR.r + 14}" fill="${CELESTE_50}"/>`,
    `<circle cx="${AVATAR.cx}" cy="${AVATAR.cy}" r="${AVATAR.r}" fill="${ACCENT}"/>`,
    `<text x="${AVATAR.cx}" y="${AVATAR.cy + 27}" text-anchor="middle" ${font('serif', initialsText.length > 1 ? 76 : 88)} fill="#ffffff">${esc(initialsText)}</text>`,
    ...parts,
    `<rect x="${PAD}" y="${FOOTER_Y}" width="${WIDTH - 2 * PAD}" height="1.5" fill="${LINE}"/>`,
    `<svg x="${PAD - 4}" y="${FOOTER_Y + 10}" width="104" height="104" viewBox="0 0 200 200">${SEAL}</svg>`,
    `<text x="${PAD + 120}" y="${FOOTER_Y + 60}" ${font('serif', 36)} fill="${INK}">Congreso Abierto</text>`,
    `<text x="${PAD + 120}" y="${FOOTER_Y + 92}" ${font('sans', 22)} fill="${MUTED}">Datos abiertos del Congreso argentino</text>`,
    `</svg>`,
  ].join('');
}

// --- Rendering ------------------------------------------------------------------------

const FONT_FILES = ['SourceSerif4-Semibold.ttf', 'SourceSans3-Regular.ttf', 'SourceSans3-Semibold.ttf'];
let ready: Promise<Uint8Array[]> | null = null;

function setup(): Promise<Uint8Array[]> {
  ready ??= (async () => {
    const wasm = createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm');
    await initWasm(readFileSync(wasm));
    return FONT_FILES.map(file => new Uint8Array(readFileSync(join(process.cwd(), 'src/assets/fonts', file))));
  })();
  return ready;
}

const options = (fontBuffers: Uint8Array[]) => ({
  font: { fontBuffers, defaultFontFamily: SANS, serifFamily: SERIF, sansSerifFamily: SANS },
  fitTo: { mode: 'original' as const },
});

function resvgMeasure(fontBuffers: Uint8Array[]): Measure {
  const cache = new Map<string, number>();
  return (text, size, name) => {
    const key = `${name}|${size}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${size * 2}"><text x="0" y="${size * 1.5}" ${font(name, size)}>${esc(text)}</text></svg>`;
      const resvg = new Resvg(svg, options(fontBuffers));
      width = resvg.getBBox()?.width ?? 0;
      resvg.free();
      cache.set(key, width);
    }
    return width;
  };
}

// Copied into its own ArrayBuffer so it is a valid Response body.
export async function renderShareImage(card: CardInput): Promise<Uint8Array<ArrayBuffer>> {
  const fontBuffers = await setup();
  const resvg = new Resvg(cardSvg(card, resvgMeasure(fontBuffers)), options(fontBuffers));
  const image = resvg.render();
  const png = new Uint8Array(image.asPng());
  image.free();
  resvg.free();
  return png;
}
