import { sleep as defaultSleep } from '../../utils/sleep.js';

export class MetaApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'MetaApiError';
    this.status = options.status;
    this.code = options.code;
    this.subcode = options.subcode;
    this.isTransient = Boolean(options.isTransient);
    this.requestId = options.requestId;
    this.retryAfterMs = options.retryAfterMs;
  }
}

const TRANSIENT_META_CODES = new Set([1, 2, 4, 17, 32, 613]);

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function retryDelay(attempt, retryAfterMs) {
  if (retryAfterMs !== null && retryAfterMs !== undefined) return retryAfterMs;
  const base = Math.min(30_000, 500 * (2 ** attempt));
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

function isRetryable(error) {
  if (!(error instanceof MetaApiError)) return error instanceof TypeError;
  if (error.status === 429 || (error.status >= 500 && error.status <= 599)) return true;
  return error.isTransient || TRANSIENT_META_CODES.has(Number(error.code));
}

function normalizeAccountId(externalAccountId) {
  const value = String(externalAccountId).trim();
  return value.startsWith('act_') ? value : `act_${value}`;
}

export class MetaClient {
  constructor({ accessToken, appSecretProof = null, graphVersion = 'v25.0', pageSize = 500, maxRetries = 5, useAccountAttributionSetting = true, fetchImpl = fetch, sleepImpl = defaultSleep }) {
    this.accessToken = accessToken;
    this.appSecretProof = appSecretProof;
    this.graphVersion = graphVersion;
    this.pageSize = pageSize;
    this.maxRetries = maxRetries;
    this.useAccountAttributionSetting = useAccountAttributionSetting;
    this.fetchImpl = fetchImpl;
    this.sleepImpl = sleepImpl;
    this.baseUrl = `https://graph.facebook.com/${graphVersion}`;
  }

  buildUrl(path, params = {}) {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    url.searchParams.set('access_token', this.accessToken);
    if (this.appSecretProof) url.searchParams.set('appsecret_proof', this.appSecretProof);
    return url;
  }

  async request(urlOrPath, { params, signal } = {}) {
    const initialUrl = urlOrPath instanceof URL ? urlOrPath : this.buildUrl(urlOrPath, params);
    if (initialUrl.hostname !== 'graph.facebook.com') throw new MetaApiError('Refusing to call an unexpected Meta pagination host');
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(initialUrl, { headers: { Accept: 'application/json' }, signal });
        let payload = null;
        try { payload = await response.json(); } catch {}
        if (!response.ok || payload?.error) {
          const providerError = payload?.error ?? {};
          throw new MetaApiError(providerError.message || `Meta API request failed with HTTP ${response.status}`, {
            status: response.status,
            code: providerError.code,
            subcode: providerError.error_subcode,
            isTransient: providerError.is_transient,
            requestId: providerError.fbtrace_id || response.headers.get('x-fb-trace-id'),
            retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
          });
        }
        return payload;
      } catch (error) {
        lastError = error;
        if (signal?.aborted || attempt >= this.maxRetries || !isRetryable(error)) throw error;
        await this.sleepImpl(retryDelay(attempt, error.retryAfterMs), signal);
      }
    }
    throw lastError;
  }

  async fetchAll(path, params, { signal } = {}) {
    const rows = [];
    let nextUrl = this.buildUrl(path, { ...params, limit: this.pageSize });
    while (nextUrl) {
      const page = await this.request(nextUrl, { signal });
      if (Array.isArray(page?.data)) rows.push(...page.data);
      const next = page?.paging?.next;
      if (!next) break;
      nextUrl = new URL(next);
      if (nextUrl.hostname !== 'graph.facebook.com') throw new MetaApiError('Meta returned an unexpected pagination host');
    }
    return rows;
  }

  getAccount(externalAccountId, { signal } = {}) {
    return this.request(normalizeAccountId(externalAccountId), { params: { fields: 'id,name,account_status,currency,timezone_name' }, signal });
  }
  getCampaigns(externalAccountId, { signal } = {}) {
    return this.fetchAll(`${normalizeAccountId(externalAccountId)}/campaigns`, { fields: 'id,name,objective,effective_status,start_time,stop_time,updated_time' }, { signal });
  }
  getAdsets(externalAccountId, { signal } = {}) {
    return this.fetchAll(`${normalizeAccountId(externalAccountId)}/adsets`, { fields: 'id,name,campaign_id,effective_status,optimization_goal,billing_event,updated_time' }, { signal });
  }
  getAds(externalAccountId, { signal } = {}) {
    return this.fetchAll(`${normalizeAccountId(externalAccountId)}/ads`, { fields: 'id,name,adset_id,effective_status,creative{id},updated_time' }, { signal });
  }
  getDailyInsights(externalAccountId, { dateFrom, dateTo, signal } = {}) {
    return this.fetchAll(`${normalizeAccountId(externalAccountId)}/insights`, {
      level: 'ad', time_increment: 1, time_range: { since: dateFrom, until: dateTo },
      use_account_attribution_setting: this.useAccountAttributionSetting,
      fields: 'account_id,account_name,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,date_stop,impressions,reach,clicks,inline_link_clicks,spend,actions,video_play_actions',
    }, { signal });
  }
  async getSnapshot(externalAccountId, { dateFrom, dateTo, signal } = {}) {
    const [account, campaigns, adsets, ads, insights] = await Promise.all([
      this.getAccount(externalAccountId, { signal }), this.getCampaigns(externalAccountId, { signal }),
      this.getAdsets(externalAccountId, { signal }), this.getAds(externalAccountId, { signal }),
      this.getDailyInsights(externalAccountId, { dateFrom, dateTo, signal }),
    ]);
    return { account, campaigns, adsets, ads, insights };
  }
}
