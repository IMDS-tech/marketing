import { GoogleApiClient } from './google-api-client.js';

const METRICS = ['sessions', 'totalUsers', 'eventCount', 'conversions', 'totalRevenue'];
const METRIC_MAP = { sessions: 'sessions', totalUsers: 'users', eventCount: 'events', conversions: 'conversions', totalRevenue: 'revenue' };

export class Ga4Client {
  constructor({ accessToken, maxRetries = 5, fetchImpl = fetch, sleepImpl }) {
    this.client = new GoogleApiClient({ accessToken, baseUrl: 'https://analyticsdata.googleapis.com/v1beta', allowedHosts: ['analyticsdata.googleapis.com'], maxRetries, fetchImpl, sleepImpl });
  }

  async fetchCampaignRows(propertyId, { dateFrom, dateTo, signal, pageSize = 10000 } = {}) {
    const rows = [];
    let offset = 0;
    while (true) {
      const payload = await this.client.request(`properties/${String(propertyId).replace(/^properties\//, '')}:runReport`, {
        method: 'POST', signal,
        body: {
          dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
          dimensions: [{ name: 'date' }, { name: 'sessionCampaignName' }, { name: 'sessionSourceMedium' }],
          metrics: METRICS.map(name => ({ name })), limit: String(pageSize), offset: String(offset),
        },
      });
      const page = payload?.rows || [];
      rows.push(...page);
      offset += page.length;
      if (!page.length || offset >= Number(payload?.rowCount || 0)) break;
    }
    return rows;
  }
}

export function normalizeGa4Rows(rows, context) {
  return rows.flatMap(row => {
    const [date, campaignName, sourceMedium] = (row.dimensionValues || []).map(item => item.value || '');
    const metricValues = row.metricValues || [];
    const entityId = `${campaignName || '(not set)'}:${sourceMedium || '(not set)'}`;
    const dimensions = { property_id: String(context.externalIdentifier), campaign_name: campaignName, source_medium: sourceMedium };
    return METRICS.map((providerMetric, index) => ({
      agency_id: context.agencyId, client_id: context.clientId, data_source_id: context.dataSourceId,
      integration_slug: 'ga4', entity_type: 'campaign', entity_id: entityId, entity_name: campaignName || '(not set)',
      metric_date: date ? `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}` : null,
      metric_key: METRIC_MAP[providerMetric], value: Number(metricValues[index]?.value || 0), dimensions,
    }));
  });
}
