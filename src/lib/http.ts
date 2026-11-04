// Network helpers for the build-time loaders.

// Node's fetch reports every network problem as "fetch failed" and hides the reason in `cause`.
export function describeFetchError(error: unknown): string {
  const err = error as Error & { cause?: Error & { code?: string } };
  const cause = err?.cause;
  if (!cause) return err?.message ?? String(error);
  const reason = cause.code ? `${cause.code}: ${cause.message}` : cause.message;
  return `${err.message} (${reason})`;
}

interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Retries `run` after base, 2×base, 3×base… milliseconds; rethrows the last error.
export async function withRetries<T>(run: () => Promise<T>, { retries, baseDelayMs, sleep = wait }: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
}
