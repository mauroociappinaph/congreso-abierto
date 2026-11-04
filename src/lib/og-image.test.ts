import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSvg, keyFigure, renderShareImage, wrapText, type CardInput } from './og-image.ts';

// Fake metrics: every character is half the font size wide.
const measure = (text: string, size: number) => text.length * size * 0.5;

const yedlin: CardInput = {
  camara: 'diputados',
  nombre: 'Yedlin, Pablo Raúl',
  distrito: 'Tucumán',
  bloc: 'Independencia',
  key: { value: '2,5', label: 'tramos de viaje por mes' },
};

test('keyFigure: deputies show legs per month, or bills without travel; senators show attendance, or bills', () => {
  assert.deepEqual(keyFigure({ camara: 'diputados', legsPerMonth: 2.53, bills: 69, asistencia: null }), { value: '2,53', label: 'tramos de viaje por mes' });
  assert.deepEqual(keyFigure({ camara: 'diputados', legsPerMonth: null, bills: 1, asistencia: null }), { value: '1', label: 'proyecto como primer firmante' });
  assert.deepEqual(keyFigure({ camara: 'senado', legsPerMonth: null, bills: 3, asistencia: 0.956 }), { value: '95,6 %', label: 'de asistencia en las actas del Senado' });
  assert.deepEqual(keyFigure({ camara: 'senado', legsPerMonth: null, bills: 1200, asistencia: null }), { value: '1.200', label: 'proyectos como primer firmante' });
});

test('wrapText keeps the largest size that fits on one line, then wraps, then truncates with an ellipsis', () => {
  assert.deepEqual(wrapText('Yedlin, Pablo', 400, [60, 50], 2, measure), { size: 60, lines: ['Yedlin, Pablo'] });
  assert.deepEqual(wrapText('Yedlin, Pablo', 330, [60, 50], 2, measure), { size: 50, lines: ['Yedlin, Pablo'] });
  assert.deepEqual(wrapText('Yedlin, Pablo Raúl', 300, [60, 50], 2, measure), { size: 60, lines: ['Yedlin,', 'Pablo Raúl'] });
  const cut = wrapText('aaaa bbbb cccc dddd eeee', 100, [20], 1, measure);
  assert.equal(cut.size, 20);
  assert.equal(cut.lines.length, 1);
  assert.ok(cut.lines[0].endsWith('…') && measure(cut.lines[0], 20) <= 100, cut.lines[0]);
});

test('cardSvg draws a 1200x630 card with initials, name, role, district, bloc, key number and the seal, all local', () => {
  const svg = cardSvg({ ...yedlin, bloc: 'A & B <x>' }, measure);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1200" height="630" viewBox="0 0 1200 630">/);
  for (const text of ['PY', 'Yedlin, Pablo Raúl', 'DIPUTADO/A NACIONAL', 'Tucumán · Bloque A &amp; B &lt;x&gt;', '2,5', 'tramos de viaje por mes', 'Congreso Abierto', 'CONGRESO ABIERTO']) {
    assert.ok(svg.includes(text), text);
  }
  assert.doesNotMatch(svg, /href="(https?:|\/\/)/);
  assert.doesNotMatch(svg, /var\(--/);
  assert.match(cardSvg({ ...yedlin, camara: 'senado', nombre: 'ABAD, MAXIMILIANO', distrito: null }, measure), /SENADOR\/A NACIONAL[\s\S]*Abad, Maximiliano[\s\S]*Bloque Independencia/);
});

test('renderShareImage writes a deterministic 1200x630 PNG under 120 KB with the bundled fonts', async () => {
  const png = await renderShareImage(yedlin);
  const again = await renderShareImage(yedlin);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assert.equal(view.getUint32(16), 1200);
  assert.equal(view.getUint32(20), 630);
  assert.ok(png.byteLength < 120_000, `${png.byteLength} bytes`);
  assert.ok(Buffer.from(png).equals(Buffer.from(again)), 'same input, same bytes');
});
