import test from 'node:test';
import assert from 'node:assert/strict';
import { describeFetchError, withRetries } from './http.ts';

test('describeFetchError shows the network cause that fetch hides', () => {
  const error = new TypeError('fetch failed', { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) });
  assert.equal(describeFetchError(error), 'fetch failed (ECONNRESET: read ECONNRESET)');
  assert.equal(describeFetchError(new Error('503 Service Unavailable')), '503 Service Unavailable');
  assert.equal(describeFetchError(new TypeError('fetch failed', { cause: new Error('getaddrinfo') })), 'fetch failed (getaddrinfo)');
});

test('withRetries retries failures with growing delays and returns the first success', async () => {
  const waits: number[] = [];
  let calls = 0;
  const result = await withRetries(
    async () => {
      calls++;
      if (calls < 3) throw new Error('boom');
      return 'ok';
    },
    { retries: 2, baseDelayMs: 100, sleep: async ms => { waits.push(ms); } },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(waits, [100, 200]);
});

test('withRetries gives up after the last retry and rethrows the last error', async () => {
  let calls = 0;
  await assert.rejects(
    withRetries(async () => { calls++; throw new Error(`fail ${calls}`); }, { retries: 2, baseDelayMs: 1, sleep: async () => {} }),
    /fail 3/,
  );
  assert.equal(calls, 3);
});
