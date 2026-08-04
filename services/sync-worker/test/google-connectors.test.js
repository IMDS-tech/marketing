import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleApiClient } from '../src/providers/google/google-api-client.js';
import { normalizeGoogleAdsRows } from '../src/providers/google/google-ads-client.js';
import { normalizeGa4Rows } from '../src/providers/google/ga4-client.js';
import { normalizeSearchConsoleRows } from '../src/providers/google/search-console-client.js';

const context = { agencyId: 'a', clientId: 'c', dataSourceId: 'd', externalIdentifier: 'external', label: 'Account' };

test('Google API client rejects pagination to an unexpected host', () => {
  const client = new GoogleApiClient({ accessToken: 'token', baseUrl: 'https://www.googleapis.com', allowedHosts: ['www.googleapis.com'] });
  assert.throws(() => client.buildUrl('https://evil.example/path'), /unexpected Google API host/);
});

test('Google Ads normalization emits base metric rows and converts micros', () => {
  const rows = normalizeGoogleAdsRows([{ segments: { date: '2026-08-01' }, customer: { id: '1', descriptiveName: 'Demo', currencyCode: 'KZT' }, campaign: { id: '2', name: 'Campaign', status: 'ENABLED' }, metrics: { impressions: '100', clicks: '4', costMicros: '1250000', conversions: 2, conversionsValue: 9 } }], context);
  assert.equal(rows.length, 5);
  assert.equal(rows.find(row => row.metric_key === 'spend').value, 1.25);
});

test('GA4 normalization converts compact date and canonical metric names', () => {
  const rows = normalizeGa4Rows([{ dimensionValues: [{ value: '20260801' }, { value: 'Brand' }, { value: 'google / cpc' }], metricValues: [{ value: '10' }, { value: '8' }, { value: '20' }, { value: '2' }, { value: '300' }] }], context);
  assert.equal(rows[0].metric_date, '2026-08-01');
  assert.deepEqual(rows.map(row => row.metric_key), ['sessions', 'users', 'events', 'conversions', 'revenue']);
});

test('Search Console normalization preserves query dimensions', () => {
  const rows = normalizeSearchConsoleRows([{ keys: ['2026-08-01', 'clinic', 'https://example.com', 'MOBILE', 'kaz'], clicks: 3, impressions: 40, ctr: 0.075, position: 2.5 }], context);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].dimensions.query, 'clinic');
});
