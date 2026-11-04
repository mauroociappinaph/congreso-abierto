import test from 'node:test';
import assert from 'node:assert/strict';
import { pageItems, paginate, pageStatus } from './pagination.ts';

test('paginate with no rows keeps one empty page', () => {
  assert.deepEqual(paginate(0, 1, 25), { page: 1, pages: 1, from: 0, to: 0, hasPrev: false, hasNext: false });
  assert.equal(pageStatus(paginate(0, 1, 25), 0), 'Sin resultados');
});

test('paginate counts only the filtered rows: Tucumán, 9 rows at 25 per page, is one page', () => {
  const state = paginate(9, 1, 25);
  assert.deepEqual(state, { page: 1, pages: 1, from: 1, to: 9, hasPrev: false, hasNext: false });
  assert.equal(pageStatus(state, 9), 'Mostrando 1–9 de 9');
});

test('paginate splits 257 rows into 11 pages of 25 and the last page is short', () => {
  assert.deepEqual(paginate(257, 2, 25), { page: 2, pages: 11, from: 26, to: 50, hasPrev: true, hasNext: true });
  assert.equal(pageStatus(paginate(257, 2, 25), 257), 'Mostrando 26–50 de 257');
  assert.deepEqual(paginate(257, 11, 25), { page: 11, pages: 11, from: 251, to: 257, hasPrev: true, hasNext: false });
});

test('paginate with an exact multiple has no extra empty page', () => {
  assert.deepEqual(paginate(100, 4, 25), { page: 4, pages: 4, from: 76, to: 100, hasPrev: true, hasNext: false });
});

test('paginate clamps a page out of range', () => {
  assert.deepEqual(paginate(92, 9, 25), { page: 4, pages: 4, from: 76, to: 92, hasPrev: true, hasNext: false });
  assert.deepEqual(paginate(92, 0, 25), paginate(92, 1, 25));
  assert.deepEqual(paginate(92, Number.NaN, 25), paginate(92, 1, 25));
});

test('paginate with every row on one page ("Todos")', () => {
  assert.deepEqual(paginate(257, 3, Infinity), { page: 1, pages: 1, from: 1, to: 257, hasPrev: false, hasNext: false });
});

test('pageItems lists every page when they fit', () => {
  assert.deepEqual(pageItems(1, 1), [1]);
  assert.deepEqual(pageItems(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('pageItems collapses distant pages into gaps around the current one', () => {
  assert.deepEqual(pageItems(5, 12), [1, 'gap', 4, 5, 6, 'gap', 12]);
  assert.deepEqual(pageItems(1, 11), [1, 2, 3, 4, 5, 'gap', 11]);
  assert.deepEqual(pageItems(4, 11), [1, 2, 3, 4, 5, 'gap', 11]);
  assert.deepEqual(pageItems(8, 11), [1, 'gap', 7, 8, 9, 10, 11]);
  assert.deepEqual(pageItems(11, 11), [1, 'gap', 7, 8, 9, 10, 11]);
});
