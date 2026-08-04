import { GoogleApiClient } from './google-api-client.js';

const BASE_METRICS = [
  ['impressions', row => Number(row.metrics?.impressions || 0)],
  ['clicks', row => Number(row.metrics?.clicks || 0)],
  ['spend', row => Number(row.metrics?.costMicros || 0) / 1_000_000],
  ['conversions', row => Number(row.metrics?.conversions || 0)],
  ['revenue', row => Number(row.metrics?.conversionsValue || 0)],
];

export class GoogleAdsClient {
  constructor({ accessToken, developerToken, loginCustomerId = null, apiVersion = 'v25', maxRetries = 5, fetchImpl = fetch, sleepImpl }) {
    const headers = { 'developer-token': developerToken };
    if (loginCustomerId) headers['login-customer-id'] = String(loginCustomerId).replace(/-/g, '');
    this.client = new GoogleApiClient({
      accessToken,
      baseUrl: `https://googleads.googleapis.com/${apiVersion}`,
      allowedHosts: ['googleads.googleapis.com'],
      defaultHeaders: headers,
      maxRetries,
      fetchImpl,
      sleepImpl,
    });
  }

  async listAccessibleCustomers({ signal } = {}) {
    const payload = await this.client.request('customers:listAccessibleCustomers', { signal });
    return (payload?.resourceNames || []).map(resourceName => ({ id: resourceName.split('/').at(-1), resourceName }));
  }

  async fetchCampaignRows(customerId, { dateFrom, dateTo, signal } = {}) {
    const query = `SELECT segments.date, customer.id, customer.descriptive_name, customer.currency_code, campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}' ORDER BY segments.date`;
    const payload = await this.client.request(`customers/${String(customerId).replace(/-/g, '')}/googleAds:searchStream`, { method: 'POST', body: { query }, signal });
    return (Array.isArray(payload) ? payload : []).flatMap(batch => batch.results || []);
  }
}

export function normalizeGoogleAdsRows(rows, context) {
  const output = [];
  for (const row of rows) {
    const dimensions = {
      account_id: String(row.customer?.id || context.externalIdentifier),
      account_name: row.customer?.descriptiveName || context.label,
      campaign_id: String(row.campaign?.id || ''),
      campaign_name: row.campaign?.name || '',
      effective_status: row.campaign?.status || 'UNKNOWN',
      currency: row.customer?.currencyCode || null,
    };
    for (const [metricKey, read] of BASE_METRICS) output.push({
      agency_id: context.agencyId, client_id: context.clientId, data_source_id: context.dataSourceId,
      integration_slug: 'google-ads', entity_type: 'campaign', entity_id: dimensions.campaign_id,
      entity_name: dimensions.campaign_name, metric_date: row.segments?.date, metric_key: metricKey,
      value: read(row), dimensions,
    });
  }
  return output;
}
