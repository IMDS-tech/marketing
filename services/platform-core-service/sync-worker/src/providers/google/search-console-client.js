import { GoogleApiClient } from './google-api-client.js';

export class SearchConsoleClient {
  constructor({ accessToken, maxRetries = 5, fetchImpl = fetch, sleepImpl }) {
    this.client = new GoogleApiClient({ accessToken, baseUrl: 'https://www.googleapis.com/webmasters/v3', allowedHosts: ['www.googleapis.com'], maxRetries, fetchImpl, sleepImpl });
  }

  async fetchSearchRows(siteUrl, { dateFrom, dateTo, signal, rowLimit = 25000 } = {}) {
    const rows = [];
    let startRow = 0;
    while (true) {
      const page = await this.client.request(`sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', signal,
        body: { startDate: dateFrom, endDate: dateTo, dimensions: ['date', 'query', 'page', 'device', 'country'], rowLimit, startRow, dataState: 'final' },
      });
      const pageRows = page?.rows || [];
      rows.push(...pageRows);
      if (pageRows.length < rowLimit) break;
      startRow += pageRows.length;
    }
    return rows;
  }
}

export function normalizeSearchConsoleRows(rows, context) {
  return rows.flatMap(row => {
    const [date, query, page, device, country] = row.keys || [];
    const entityId = `${page || context.externalIdentifier}:${query || ''}:${device || ''}:${country || ''}`;
    const dimensions = { site_url: context.externalIdentifier, query, page, device, country };
    const values = [['clicks', row.clicks], ['impressions', row.impressions], ['position', row.position]];
    return values.map(([metricKey, value]) => ({
      agency_id: context.agencyId, client_id: context.clientId, data_source_id: context.dataSourceId,
      integration_slug: 'search-console', entity_type: 'keyword', entity_id: entityId, entity_name: query || '(not set)',
      metric_date: date, metric_key: metricKey, value: Number(value || 0), dimensions,
    }));
  });
}
