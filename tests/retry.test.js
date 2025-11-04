import { describe, it, expect } from 'vitest';
import { withRetry } from '../src/utils/retry.js';
describe('withRetry', () => {
    it('retries on failure and respects Retry-After', async () => {
        let calls = 0;
        const start = Date.now();
        const result = await withRetry(async () => {
            calls++;
            if (calls < 3) {
                const err = new Error('rate limited');
                err.status = 429;
                err.response = { headers: { 'retry-after': '0.05' } }; // 50ms
                throw err;
            }
            return 'ok';
        }, {
            retries: 5,
            minDelayMs: 10,
            maxDelayMs: 200,
            getRetryAfterMs: (err) => {
                const ra = err?.response?.headers?.['retry-after'];
                return ra ? Number(ra) * 1000 : undefined;
            },
            isRetryable: (err) => (err?.status === 429),
        });
        const elapsed = Date.now() - start;
        expect(result).toBe('ok');
        expect(calls).toBe(3);
        expect(elapsed).toBeGreaterThanOrEqual(90); // two waits ~50ms each + overhead
    });
});
