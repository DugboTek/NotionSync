export type RetryOptions = {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number; // exponential factor
  jitter?: boolean;
  maxTotalMs?: number;
  getRetryAfterMs?: (err: unknown) => number | undefined;
  isRetryable?: (err: unknown) => boolean;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 4,
    minDelayMs = 250,
    maxDelayMs = 10_000,
    factor = 2,
    jitter = true,
    maxTotalMs = 60_000,
    getRetryAfterMs,
    isRetryable,
  } = opts;

  const start = Date.now();
  let attempt = 0;
  let delay = minDelayMs;
  // First attempt without delay
  // Subsequent attempts wait with backoff
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const elapsed = Date.now() - start;
      attempt += 1;
      const retryAfter = getRetryAfterMs?.(err);
      const retryable = isRetryable ? isRetryable(err) : true;
      if (!retryable || attempt > retries || elapsed > maxTotalMs) {
        throw err;
      }
      let wait = retryAfter ?? delay;
      if (jitter) wait = wait * (0.5 + Math.random());
      if (wait > maxDelayMs) wait = maxDelayMs;
      await sleep(wait);
      delay = Math.min(maxDelayMs, delay * factor);
    }
  }
}

