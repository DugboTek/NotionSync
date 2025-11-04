import { Client } from '@notionhq/client';
import type { Logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { isRetryableError, normalizeError } from '../utils/errors.js';

export type NotionOptions = {
  auth: string;
  notionVersion?: string;
  baseUrl?: string;
  logger: Logger;
};

export function createNotionClient(opts: NotionOptions) {
  const client = new Client({
    auth: opts.auth,
    notionVersion: opts.notionVersion,
    baseUrl: opts.baseUrl,
  });

  async function call<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(fn, {
      isRetryable: isRetryableError,
      getRetryAfterMs: (err) => normalizeError(err).retry_after_ms,
    });
  }

  return { client, call };
}

