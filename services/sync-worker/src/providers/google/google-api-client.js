import { sleep as defaultSleep } from '../../utils/sleep.js';

export class GoogleApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.reason = options.reason ?? null;
    this.requestId = options.requestId ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.retryable = Boolean(options.retryable);
  }
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function retryDelay(attempt, retryAfterMs) {
  if (retryAfterMs !== null && retryAfterMs !== undefined) return retryAfterMs;
  return Math.round(Math.min(30_000, 500 * (2 ** attempt)) * (0.75 + Math.random() * 0.5));
}

export class GoogleApiClient {
  constructor({ accessToken, baseUrl, allowedHosts, defaultHeaders = {}, maxRetries = 5, fetchImpl = fetch, sleepImpl = defaultSleep }) {
    if (!accessToken) throw new Error('Google access token is required');
    this.accessToken = accessToken;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.allowedHosts = new Set(allowedHosts);
    this.defaultHeaders = defaultHeaders;
    this.maxRetries = maxRetries;
    this.fetchImpl = fetchImpl;
    this.sleepImpl = sleepImpl;
  }

  buildUrl(pathOrUrl, query = {}) {
    const url = pathOrUrl instanceof URL || /^https:\/\//.test(pathOrUrl)
      ? new URL(pathOrUrl)
      : new URL(`${this.baseUrl}/${String(pathOrUrl).replace(/^\//, '')}`);
    if (!this.allowedHosts.has(url.hostname)) throw new GoogleApiError(`Refusing unexpected Google API host: ${url.hostname}`);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    return url;
  }

  async request(pathOrUrl, { method = 'GET', query, body, headers = {}, signal } = {}) {
    const url = this.buildUrl(pathOrUrl, query);
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            ...this.defaultHeaders,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
        });
        let payload = null;
        try { payload = await response.json(); } catch {}
        if (!response.ok) {
          const provider = payload?.error ?? {};
          const detail = Array.isArray(provider.details) ? provider.details[0] : null;
          const reason = detail?.errors?.[0]?.errorCode ? JSON.stringify(detail.errors[0].errorCode) : provider.status;
          throw new GoogleApiError(provider.message || `Google API HTTP ${response.status}`, {
            status: response.status,
            code: provider.code,
            reason,
            requestId: response.headers.get('request-id') || response.headers.get('x-request-id'),
            retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
            retryable: response.status === 429 || response.status >= 500,
          });
        }
        return payload;
      } catch (error) {
        lastError = error;
        const retryable = error instanceof TypeError || error?.retryable;
        if (signal?.aborted || !retryable || attempt >= this.maxRetries) throw error;
        await this.sleepImpl(retryDelay(attempt, error.retryAfterMs), signal);
      }
    }
    throw lastError;
  }
}
