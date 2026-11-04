import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CommitteeSummary } from './comisiones.ts';
import { COMMITTEE_NAMES, committeeName } from './committee-names.ts';
import { normalizeText } from './legislators.ts';
import { deserialize } from './snapshot.ts';

const snapshot = deserialize(readFileSync(new URL('../data/snapshot/committees.json', import.meta.url), 'utf8')) as {
  committees: Map<string, CommitteeSummary>;
};
const published = [...snapshot.committees.values()];

test('every committee of the snapshot has an official name with the published wording', () => {
  assert.equal(published.length, 46);
  for (const c of published) {
    if (c.nombre === c.id) {
      // published without a name: the page keeps its explicit placeholder
      assert.equal(committeeName(c.id, c.nombre), undefined, c.id);
      continue;
    }
    const official = COMMITTEE_NAMES[c.id];
    assert.ok(official, `${c.id} "${c.nombre}" has no official name in committee-names.ts`);
    assert.equal(normalizeText(official), normalizeText(c.nombre), c.id);
    assert.equal(committeeName(c.id, c.nombre), official);
  }
});

test('official names carry accents and Spanish capitalization', () => {
  const byName = new Map(published.map(c => [c.nombre, committeeName(c.id, c.nombre)]));
  assert.equal(byName.get('ACCION SOCIAL Y SALUD PUBLICA'), 'Acción Social y Salud Pública');
  assert.equal(byName.get('PRESUPUESTO Y HACIENDA'), 'Presupuesto y Hacienda');
  assert.equal(byName.get('PREVISION Y SEGURIDAD SOCIAL'), 'Previsión y Seguridad Social');
  assert.equal(byName.get('CIENCIA, TECNOLOGIA E INNOVACION PRODUCTIVA'), 'Ciencia, Tecnología e Innovación Productiva');
  assert.equal(byName.get('PREVENCION DE ADICCIONES Y CONTROL DEL NARCOTRAFICO'), 'Prevención de Adicciones y Control del Narcotráfico');
  assert.equal(byName.get('ASUNTOS COOPERATIVOS, MUTUALES Y ORGANIZACIONES NO GUBERNAMENTALES'), 'Asuntos Cooperativos, Mutuales y Organizaciones no Gubernamentales');
});

test('a committee with a new id but a known name falls back to its name; an unknown one gets nothing', () => {
  assert.equal(committeeName('HCDN99999', 'Accion Social y Salud Publica'), 'Acción Social y Salud Pública');
  assert.equal(committeeName('HCDN99999', 'ACCIÓN SOCIAL  Y SALUD PÚBLICA'), 'Acción Social y Salud Pública');
  assert.equal(committeeName('HCDN99999', 'COMISION NUEVA'), undefined);
});
