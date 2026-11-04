import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jaroWinkler } from '../../lib/linkage.ts';
import { modifiedZScores, type Region } from '../../lib/viajes.ts';
import { jaroSteps, regionalOutliers, riceIndex, zSteps } from './method.ts';

test('jaroSteps ends at the same value as the linker Jaro-Winkler', () => {
  for (const [a, b] of [['marclay', 'marcela'], ['martha', 'marhta'], ['monica', 'monika'], ['abel', 'abel'], ['becerra', 'pauli'], ['dwayne', 'duane']]) {
    assert.equal(jaroSteps(a, b).jw, jaroWinkler(a, b), `${a} / ${b}`);
  }
});

test('jaroSteps shows the classic MARTHA / MARHTA counts', () => {
  const steps = jaroSteps('martha', 'marhta');
  assert.equal(steps.window, 2);
  assert.equal(steps.matches, 6);
  assert.equal(steps.transpositions, 1);
  assert.equal(steps.prefix, 3);
  assert.equal(Math.round(steps.jaro * 10000) / 10000, 0.9444);
  assert.equal(Math.round(steps.jw * 10000) / 10000, 0.9611);
  assert.deepEqual(steps.aMatched, [true, true, true, true, true, true]);
  assert.deepEqual(steps.pairs, [[0, 0], [1, 1], [2, 2], [3, 4], [4, 3], [5, 5]]);
});

test('jaroSteps with nothing in common is 0', () => {
  const steps = jaroSteps('abc', 'xyz');
  assert.equal(steps.matches, 0);
  assert.equal(steps.jw, 0);
});

test('riceIndex is |yes - no| / (yes + no), null without yes or no', () => {
  assert.equal(riceIndex(10, 2), 8 / 12);
  assert.equal(riceIndex(5, 5), 0);
  assert.equal(riceIndex(7, 0), 1);
  assert.equal(riceIndex(0, 0), null);
});

test('zSteps gives the median, MAD and the same z as the travel analysis', () => {
  const values = [1, 2, 2, 3, 3, 4, 12];
  const steps = zSteps(values);
  assert.equal(steps.median, 3);
  assert.deepEqual(steps.deviations, [2, 1, 1, 0, 0, 1, 9]);
  assert.equal(steps.mad, 1);
  assert.deepEqual(steps.z, modifiedZScores(values));
  assert.equal(Math.round(steps.z[6] * 100) / 100, 6.07);
});

test('regionalOutliers flags by region with the same threshold and keeps the band verdict', () => {
  const peer = (id: string, region: Region, legsPerMonth: number, flagged = false) => ({
    deputyId: id, region, legsPerMonth, eligible: true, flagged, band: '< 100 km', homeKm: 10,
    topRoute: { origen: 'A', destino: 'B', count: 1 },
  });
  const deputies = [
    peer('a', 'Buenos Aires', 0.3), peer('b', 'Buenos Aires', 0.4), peer('c', 'Buenos Aires', 0.3),
    peer('d', 'Buenos Aires', 0.5), peer('e', 'Buenos Aires', 6, true), peer('f', 'Buenos Aires', 0.4),
    peer('g', 'NOA', 6), peer('h', 'NOA', 5), { ...peer('i', 'NOA', 40), eligible: false },
  ];
  const flagged = regionalOutliers(deputies);
  assert.deepEqual(flagged.map(d => [d.deputyId, d.region, d.flaggedByBand]), [['e', 'Buenos Aires', true]]);
  assert.ok(flagged[0].z > 3.5);
});
