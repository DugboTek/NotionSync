export type NormalizedError = {
  name: string;
  message: string;
  status?: number;
  code?: string | number;
  request_id?: string;
  retry_after_ms?: number;
  cause?: unknown;
};

export function normalizeError(err: any): NormalizedError {
  const status = err?.status ?? err?.statusCode;
  const retry_after = err?.response?.headers?.['retry-after'] ?? err?.headers?.['retry-after'];
  let retry_after_ms: number | undefined = undefined;
  if (retry_after) {
    const n = Number(retry_after);
    if (!Number.isNaN(n)) retry_after_ms = n * 1000;
  }
  return {
    name: err?.name ?? 'Error',
    message: String(err?.message ?? err),
    status,
    code: err?.code,
    request_id: err?.response?.headers?.['x-request-id'] ?? err?.request_id,
    retry_after_ms,
    cause: err?.cause,
  };
}

export function isRetryableError(err: any): boolean {
  const status = err?.status ?? err?.statusCode;
  if (!status) return true; // network/unknown
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

