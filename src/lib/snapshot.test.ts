import test from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, dataMode, deserialize, missingSnapshotMessage, serialize, updateMeta } from './snapshot.ts';

const roundTrip = (value: unknown) => deserialize(serialize(value));

test('serialize and deserialize round-trip plain JSON values', () => {
  const value = { nombre: 'Ñandú "el" \\ Pérez\n', n: 0, neg: -1.5, ok: true, nada: null, list: [1, 'a', null, [2]], empty: {}, none: [] };
  assert.deepEqual(roundTrip(value), value);
  assert.deepEqual(roundTrip([]), []);
  assert.equal(roundTrip('texto'), 'texto');
  assert.equal(roundTrip(null), null);
});

test('Maps and Sets survive, nested and empty', () => {
  const value = {
    byDeputy: new Map([['b', [{ id: 'x', roles: new Map([['k', 'v']]) }]], ['a', []]]),
    empty: new Map(),
    ids: new Set(['z', 'y']),
    noIds: new Set(),
  };
  const back = roundTrip(value) as typeof value;
  assert.ok(back.byDeputy instanceof Map);
  assert.ok(back.empty instanceof Map && back.empty.size === 0);
  assert.ok(back.ids instanceof Set && back.noIds instanceof Set && back.noIds.size === 0);
  assert.ok(back.byDeputy.get('b')![0].roles instanceof Map);
  assert.equal(back.byDeputy.get('b')![0].roles.get('k'), 'v');
  assert.deepEqual([...back.ids], ['y', 'z']);
});

test('Map entries are written sorted by key so a reordered source gives the same file', () => {
  const one = serialize(new Map([['2', 'b'], ['10', 'c'], ['1', 'a']]));
  const other = serialize(new Map([['1', 'a'], ['10', 'c'], ['2', 'b']]));
  assert.equal(one, other);
  assert.deepEqual([...(deserialize(one) as Map<string, string>).keys()], ['1', '10', '2']);
});

test('plain objects keep their key order and the output is byte-for-byte stable', () => {
  const value = { z: 1, a: { y: 2, b: 3 } };
  assert.equal(serialize(value), serialize(structuredClone(value)));
  assert.deepEqual(Object.keys(roundTrip(value) as object), ['z', 'a']);
});

test('objects that look like a tag are escaped, non-finite numbers are kept', () => {
  const value = { tagged: { $map: [['a', 1]] }, set: { $set: 1 }, obj: { $obj: {} }, n: [Number.NaN, Infinity, -Infinity] };
  const back = roundTrip(value) as typeof value;
  assert.deepEqual(back.tagged, { $map: [['a', 1]] });
  assert.deepEqual(back.set, { $set: 1 });
  assert.deepEqual(back.obj, { $obj: {} });
  assert.ok(Number.isNaN(back.n[0]));
  assert.deepEqual(back.n.slice(1), [Infinity, -Infinity]);
});

test('unsupported values fail loudly instead of being lost', () => {
  assert.throws(() => serialize({ when: new Date(0) }), /snapshot: cannot serialize Date at \$\.when/);
  assert.throws(() => serialize([() => 1]), /snapshot: cannot serialize function at \$\[0\]/);
});

test('one entry per line for the top levels keeps git diffs small', () => {
  const text = serialize({ deputies: [{ id: '1', nombre: 'A' }, { id: '2', nombre: 'B' }], byId: new Map([['1', { n: 1 }]]), count: 2 });
  assert.equal(text, [
    '{',
    '  "deputies": [',
    '    {"id":"1","nombre":"A"},',
    '    {"id":"2","nombre":"B"}',
    '  ],',
    '  "byId": {"$map": [',
    '    ["1",{"n":1}]',
    '  ]},',
    '  "count": 2',
    '}',
    '',
  ].join('\n'));
  assert.equal(serialize([]), '[]\n');
  assert.equal(serialize({ m: new Map() }), '{\n  "m": {"$map": []}\n}\n');
});

test('dataMode defaults to snapshot and rejects unknown values', () => {
  assert.equal(dataMode(undefined), 'snapshot');
  assert.equal(dataMode(''), 'snapshot');
  assert.equal(dataMode('snapshot'), 'snapshot');
  assert.equal(dataMode('refresh'), 'refresh');
  assert.throws(() => dataMode('live'), /DATA_MODE must be "snapshot" or "refresh", got "live"/);
});

test('missingSnapshotMessage names the entry and the command', () => {
  assert.equal(missingSnapshotMessage('deputies'), 'Data snapshot missing: deputies — run npm run refresh-data');
});

test('updateMeta moves fetchedAt only when the content hash changes', () => {
  const first = updateMeta(null, 'pay', { text: 'a', items: 3 }, '2026-11-01T06:00:00.000Z');
  assert.deepEqual(first, {
    generatedAt: '2026-11-01T06:00:00.000Z',
    sources: { pay: { fetchedAt: '2026-11-01T06:00:00.000Z', contentHash: contentHash('a'), items: 3 } },
  });
  const same = updateMeta(first, 'pay', { text: 'a', items: 3 }, '2026-11-08T06:00:00.000Z');
  assert.equal(same.generatedAt, '2026-11-08T06:00:00.000Z');
  assert.equal(same.sources.pay.fetchedAt, '2026-11-01T06:00:00.000Z');
  const changed = updateMeta(same, 'pay', { text: 'b', items: 4, period: { desde: '2024-01-01', hasta: '2026-06-30' } }, '2026-11-15T06:00:00.000Z');
  assert.deepEqual(changed.sources.pay, {
    fetchedAt: '2026-11-15T06:00:00.000Z',
    contentHash: contentHash('b'),
    items: 4,
    period: { desde: '2024-01-01', hasta: '2026-06-30' },
  });
  assert.equal(first.sources.pay.fetchedAt, '2026-11-01T06:00:00.000Z', 'previous meta is not mutated');
});

test('updateMeta keeps sources sorted by name', () => {
  const meta = updateMeta(updateMeta(null, 'travel', { text: 'x', items: 1 }, 't1'), 'bills', { text: 'y', items: 2 }, 't2');
  assert.deepEqual(Object.keys(meta.sources), ['bills', 'travel']);
  assert.match(contentHash('x'), /^sha256:[0-9a-f]{64}$/);
});
