import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinker, jaroWinkler, nameTokens } from './linkage.ts';

const deputies = [
  { id: 'chiconi', nombre: 'Chiconi, Abel', lugar: 'SANTA FE' },
  { id: 'pauli', nombre: 'Pauli, Santiago', lugar: 'TIERRA DEL FUEGO' },
  { id: 'herrera', nombre: 'Herrera Ahuad, Oscar A.', lugar: 'MISIONES' },
  { id: 'borgatta', nombre: 'Borgatta, Alejandrina', lugar: 'SANTA FE' },
  { id: 'becerra', nombre: 'Becerra, Mónica', lugar: 'SAN LUIS' },
  { id: 'gomez-cba', nombre: 'Gomez, Juan', lugar: 'CÓRDOBA' },
  { id: 'gomez-sal', nombre: 'Gomez, Juan', lugar: 'SALTA' },
  { id: 'marino', nombre: 'Marino, Juan', lugar: 'BUENOS AIRES' },
  { id: 'martinez', nombre: 'Martínez, Álvaro', lugar: 'BUENOS AIRES' },
  { id: 'fernandez', nombre: 'Fernández, Jorge', lugar: 'CHACO' },
  { id: 'juliano', nombre: 'Juliano, Pablo', lugar: 'TUCUMÁN' },
  { id: 'marclay', nombre: 'Marclay, Marianela', lugar: 'BUENOS AIRES' },
  { id: 'aguirre', nombre: 'Aguirre, Hilda', lugar: 'SANTIAGO DEL ESTERO' },
  { id: 'strada', nombre: 'Strada, Julia', lugar: 'BUENOS AIRES' },
  { id: 'moyano', nombre: 'Moyano, Hugo Antonio', lugar: 'BUENOS AIRES' },
  { id: 'ali', nombre: 'Alí, Ernesto "Pipi"', lugar: 'CHUBUT' },
  { id: 'avico', nombre: 'Avico, Belén', lugar: 'CÓRDOBA' },
];

const link = createLinker(deputies).link;

const s2Pairs: [string, string][] = [
  ['CHICONI RICARDO ABEL', 'chiconi'],
  ['PAULI JORGE SANTIAGO', 'pauli'],
  ['HERRERA AHUAD OSCAR ALBERTO', 'herrera'],
  ['BORGATTA ALEJANDRINA BELÉN', 'borgatta'],
  ['BECERRA MONICA MARIELA', 'becerra'],
];

for (const [raw, id] of s2Pairs) {
  test(`S2: ${raw} matches ${id}`, () => {
    const result = link(raw);
    assert.equal(result.status, 'matched');
    assert.equal(result.deputyId, id);
    assert.ok(result.confidence >= 0.9);
  });
}

test('S2: a surname matching no current deputy stays unmatched', () => {
  const result = link('MARTINEZ GERMAN PEDRO');
  assert.equal(result.status, 'unmatched');
  assert.equal(result.deputyId, null);
  assert.deepEqual(result.candidates, []);
});

test('S2: two tied deputies are reported as doubtful, never assigned', () => {
  const result = link('GOMEZ JUAN');
  assert.equal(result.status, 'doubtful');
  assert.equal(result.deputyId, null);
  assert.deepEqual(result.candidates.map(c => c.id).sort(), ['gomez-cba', 'gomez-sal']);
});

test('given-name order, accents and case do not change the match', () => {
  for (const raw of ['chiconi abel ricardo', 'Chiconi, Abel', 'MÓNICA BECERRA']) {
    const result = link(raw);
    assert.equal(result.status, 'matched', raw);
  }
  assert.equal(link('chiconi abel ricardo').deputyId, 'chiconi');
  assert.equal(link('MÓNICA BECERRA').deputyId, 'becerra');
});

test('a surname at the end of the trip name matches through the given-name-first pass', () => {
  const result = link('ABEL RICARDO CHICONI');
  assert.equal(result.status, 'matched');
  assert.equal(result.deputyId, 'chiconi');
});

for (const raw of [
  'BARLETTA MARIO DOMINGO',
  'ARJOL MARTIN ALFREDO',
  'BRÜGGE JUAN FERNANDO',
  'CARBAJAL FERNANDO',
  'COBOS JULIO CESAR CLETO',
  'COLI MARCELA INES',
]) {
  test(`a given name equal to a deputy surname stays unmatched: ${raw}`, () => {
    const result = link(raw);
    assert.equal(result.status, 'unmatched');
    assert.equal(result.deputyId, null);
    assert.deepEqual(result.candidates, []);
  });
}

for (const raw of ['AGUIRRE MANUEL IGNACIO', 'ESTRADA EMILIANO RAFAEL', 'MOYANO NILDA', 'FERNANDEZ CARLOS ALBERTO']) {
  test(`a shared surname with no matching given name stays unmatched: ${raw}`, () => {
    const result = link(raw);
    assert.equal(result.status, 'unmatched');
    assert.equal(result.deputyId, null);
    assert.deepEqual(result.candidates, []);
  });
}

test('a quoted nickname in the deputy name is ignored', () => {
  const result = link('ALI ERNESTO NADER');
  assert.equal(result.status, 'matched');
  assert.equal(result.deputyId, 'ali');
});

for (const raw of ['AVICO MARIA BELÃ‰N', 'AVICO MARIA BELA?N']) {
  test(`a garbled accent in the source still matches: ${raw}`, () => {
    const result = link(raw);
    assert.equal(result.status, 'matched');
    assert.equal(result.deputyId, 'avico');
  });
}

test('a single-letter typo in a surname still matches', () => {
  const result = link('BORGATA ALEJANDRINA');
  assert.equal(result.status, 'matched');
  assert.equal(result.deputyId, 'borgatta');
});

test('a given-name subset with the only same-surname deputy matches', () => {
  const result = link('MOYANO HUGO');
  assert.equal(result.status, 'matched');
  assert.equal(result.deputyId, 'moyano');
});

test('a PROVINCIA that differs from the district makes the row doubtful', () => {
  const result = link('CHICONI RICARDO ABEL', 'MENDOZA');
  assert.equal(result.status, 'doubtful');
  assert.equal(result.deputyId, null);
  assert.equal(result.candidates[0].id, 'chiconi');
});

test('a PROVINCIA equal to the district keeps the match', () => {
  const result = link('BECERRA MONICA MARIELA', 'San Luis');
  assert.equal(result.status, 'matched');
  assert.equal(result.deputyId, 'becerra');
});

test('results are cached per raw name and provincia', () => {
  const linker = createLinker(deputies);
  assert.equal(linker.link('PAULI JORGE SANTIAGO'), linker.link('PAULI JORGE SANTIAGO'));
  assert.notEqual(linker.link('PAULI JORGE SANTIAGO'), linker.link('PAULI JORGE SANTIAGO', 'SALTA'));
});

test('jaroWinkler known values', () => {
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  assert.equal(round3(jaroWinkler('MARTHA', 'MARHTA')), 0.961);
  assert.equal(round3(jaroWinkler('DIXON', 'DICKSONX')), 0.813);
  assert.equal(jaroWinkler('abel', 'abel'), 1);
  assert.equal(jaroWinkler('', 'abel'), 0);
  assert.equal(jaroWinkler('abel', ''), 0);
});

test('nameTokens splits deputy names into surname and given names', () => {
  assert.deepEqual(nameTokens('Herrera Ahuad, Oscar A.'), { surname: ['herrera', 'ahuad'], given: ['oscar', 'a'] });
  assert.deepEqual(nameTokens('De la Torre, María de los Ángeles'), { surname: ['torre'], given: ['maria', 'angeles'] });
  assert.deepEqual(nameTokens('CHICONI RICARDO ABEL'), { surname: [], given: ['chiconi', 'ricardo', 'abel'] });
  assert.deepEqual(nameTokens('Alí, Ernesto "Pipi"'), { surname: ['ali'], given: ['ernesto'] });
  assert.deepEqual(nameTokens('Pérez, Juan “Toto”'), { surname: ['perez'], given: ['juan'] });
  assert.deepEqual(nameTokens('BRÃœGGE JUAN FERNANDO'), { surname: [], given: ['brugge', 'juan', 'fernando'] });
  assert.deepEqual(nameTokens('AVICO MARIA BELÃ‰N'), { surname: [], given: ['avico', 'maria', 'belen'] });
  assert.deepEqual(nameTokens('AVICO MARIA BELA?N'), { surname: [], given: ['avico', 'maria', 'belan'] });
});

const f6Deputies = [
  ...deputies,
  { id: 'banfi', nombre: 'Banfi, Karina', lugar: 'BUENOS AIRES' },
  { id: 'valdes', nombre: 'Valdés, Eduardo Félix', lugar: 'CIUDAD DE BUENOS AIRES' },
  { id: 'santillan', nombre: 'Santillán Juárez Brahim, Juliana', lugar: 'BUENOS AIRES' },
  { id: 'yedlin', nombre: 'Yedlin, Pablo Raúl', lugar: 'TUCUMAN' },
  { id: 'gonzalez-diogenes', nombre: 'González, Diógenes Ignacio', lugar: 'CORRIENTES' },
  { id: 'gonzalez-gerardo', nombre: 'González, Gerardo Gustavo', lugar: 'FORMOSA' },
  { id: 'gonzalez-alvaro', nombre: 'González, Álvaro', lugar: 'CIUDAD DE BUENOS AIRES' },
  { id: 'stolbizer', nombre: 'Stolbizer, Margarita Rosa', lugar: 'BUENOS AIRES' },
  { id: 'fernandez-elia', nombre: 'Fernández, Elia Marina', lugar: 'TUCUMAN' },
];
const f6 = createLinker(f6Deputies).link;

for (const provincia of ['CABA', 'C.A.B.A.', 'Capital Federal', 'CAPITAL FEDERAL', 'Ciudad Autónoma de Buenos Aires', ' caba ']) {
  test(`district alias ${provincia} equals CIUDAD DE BUENOS AIRES`, () => {
    const result = f6('VALDES EDUARDO FELIX', provincia);
    assert.equal(result.status, 'matched');
    assert.equal(result.deputyId, 'valdes');
  });
}

test('a district alias of a deputy listed with the alias also matches', () => {
  const linker = createLinker([{ id: 'caba', nombre: 'Valdés, Eduardo Félix', lugar: 'CABA' }]);
  assert.equal(linker.link('VALDES EDUARDO FELIX', 'Ciudad de Buenos Aires').status, 'matched');
});

test('a district alias does not hide a different district', () => {
  assert.equal(f6('VALDES EDUARDO FELIX', 'BUENOS AIRES').status, 'doubtful');
});

for (const [raw, id] of [
  ['VERONICA KARINA BANFI', 'banfi'],
  ['EDUARDO FELIX VALDES', 'valdes'],
] as const) {
  test(`given-name-first order matches with a small penalty: ${raw}`, () => {
    const result = f6(raw);
    assert.equal(result.status, 'matched');
    assert.equal(result.deputyId, id);
    assert.equal(result.confidence, 0.97);
  });
}

test('given-name-first order still needs the margin over the runner-up', () => {
  const result = f6('JUAN CARLOS GOMEZ');
  assert.equal(result.status, 'doubtful');
  assert.equal(result.deputyId, null);
  assert.deepEqual(result.candidates.map(c => c.id).sort(), ['gomez-cba', 'gomez-sal']);
});

for (const raw of [
  'BARLETTA MARIO DOMINGO',
  'ARJOL MARTIN ALFREDO',
  'COBOS JULIO CESAR CLETO',
  'AGUIRRE MANUEL IGNACIO',
  'MOYANO NILDA',
  'CAMPAGNOLI MARIA MARCELA',
  'ARAUJO MARIA FERNANDA',
]) {
  test(`the given-name-first pass keeps a former deputy unmatched: ${raw}`, () => {
    const result = f6(raw);
    assert.equal(result.status, 'unmatched');
    assert.equal(result.deputyId, null);
    assert.deepEqual(result.candidates, []);
  });
}

test('the first token of a compound surname matches when every given name matches', () => {
  const result = f6('JULIANA SANTILLAN');
  assert.equal(result.status, 'matched');
  assert.equal(result.deputyId, 'santillan');
  assert.ok(result.confidence >= 0.9 && result.confidence < 1, String(result.confidence));
  assert.equal(f6('SANTILLAN JULIANA').deputyId, 'santillan');
});

test('the first token of a compound surname without the given name stays unmatched', () => {
  const result = f6('SANTILLAN WALTER');
  assert.equal(result.status, 'unmatched');
  assert.equal(result.deputyId, null);
});

test('the first token of a compound surname with another trip token left over stays unmatched', () => {
  const result = f6('SANTILLAN GOMEZ JULIANA');
  assert.equal(result.status, 'unmatched');
  assert.equal(result.deputyId, null);
});

test('a partial compound surname shared by two deputies is doubtful', () => {
  const linker = createLinker([
    { id: 'a', nombre: 'Santillán Juárez Brahim, Juliana', lugar: 'BUENOS AIRES' },
    { id: 'b', nombre: 'Santillán Pérez, Juliana', lugar: 'SALTA' },
  ]);
  const result = linker.link('JULIANA SANTILLAN');
  assert.equal(result.status, 'doubtful');
  assert.deepEqual(result.candidates.map(c => c.id).sort(), ['a', 'b']);
});

for (const [raw, provincia, id] of [
  ['YEDLIN,PABLO', undefined, 'yedlin'],
  ['GÓNZALEZ, Diógenes', 'CORRIENTES', 'gonzalez-diogenes'],
] as const) {
  test(`a given-name subset with an exact, unique surname matches: ${raw}`, () => {
    const result = f6(raw, provincia);
    assert.equal(result.status, 'matched');
    assert.equal(result.deputyId, id);
    assert.ok(result.confidence >= 0.9);
  });
}

test('a given-name subset shared by two same-surname deputies stays doubtful', () => {
  const linker = createLinker([
    { id: 'a', nombre: 'González, Diógenes Ignacio', lugar: 'CORRIENTES' },
    { id: 'b', nombre: 'González, Diógenes Martín', lugar: 'CORRIENTES' },
  ]);
  const result = linker.link('GONZALEZ, Diógenes', 'CORRIENTES');
  assert.equal(result.status, 'doubtful');
  assert.deepEqual(result.candidates.map(c => c.id).sort(), ['a', 'b']);
});

test('a given-name subset with other unclaimed given names in the trip stays doubtful', () => {
  const result = f6('GONZALEZ GUSTAVO CARLOS MIGUEL');
  assert.equal(result.status, 'doubtful');
  assert.equal(result.candidates[0].id, 'gonzalez-gerardo');
});

test('a reversed comma order matches', () => {
  const result = f6('MARGARITA, STOLBIZER');
  assert.equal(result.status, 'matched');
  assert.equal(result.deputyId, 'stolbizer');
});

test('PROVINCIA breaks a tie between same-surname deputies from different districts', () => {
  const linker = createLinker([
    { id: 'cordoba', nombre: 'Gutiérrez, Carlos', lugar: 'CORDOBA' },
    { id: 'bsas', nombre: 'Gutiérrez, Ramiro', lugar: 'BUENOS AIRES' },
  ]);
  assert.equal(linker.link('GUTIERREZ CARLOS RAMIRO', 'Buenos Aires').status, 'matched');
  assert.equal(linker.link('GUTIERREZ CARLOS RAMIRO', 'Buenos Aires').deputyId, 'bsas');
  assert.equal(linker.link('GUTIERREZ CARLOS RAMIRO').status, 'doubtful');
  assert.equal(linker.link('GUTIERREZ CARLOS RAMIRO', 'Mendoza').status, 'doubtful');
});
