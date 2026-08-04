import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertBreakdownRequest,
  deriveBreakdownMetrics,
  getBreakdownCapability,
  normalizeBreakdownValue,
} from '../src/reporting/breakdown-capabilities.js';
import { MarketingRepository } from '../src/repositories/marketing-repository.js';

test('normalizes provider breakdown values to canonical keys', () => {
  assert.equal(normalizeBreakdownValue('gender', 'FEMALE'), 'female');
  assert.equal(normalizeBreakdownValue('gender', 'NONE'), 'unknown');
  assert.equal(normalizeBreakdownValue('operating_system', 'IPHONE'), 'ios_iphone');
  assert.equal(normalizeBreakdownValue('operating_system', 'IPAD'), 'ios_ipad');
  assert.equal(normalizeBreakdownValue('age', 'AGE_25_34'), '25_34');
  assert.equal(normalizeBreakdownValue('country', 'kz'), 'KZ');
});

test('rejects unsupported provider breakdown requests', () => {
  assert.equal(getBreakdownCapability('meta-ads', 'gender').availability, 'available');
  assert.throws(
    () => assertBreakdownRequest({
      integration: 'meta-ads',
      breakdown: 'operating_system',
      level: 'account',
      metrics: ['clicks'],
    }),
    /does not support operating_system/,
  );
  assert.throws(
    () => assertBreakdownRequest({
      integration: 'google-ads',
      breakdown: 'age',
      level: 'ad',
      metrics: ['clicks'],
    }),
    /does not support age at ad level/,
  );
});

test('derives ratio metrics after additive aggregation', () => {
  const result = deriveBreakdownMetrics({
    spend: 100,
    clicks: 20,
    impressions: 1000,
    conversions: 5,
    revenue: 400,
  });
  assert.equal(result.cpc, 5);
  assert.equal(result.cpm, 100);
  assert.equal(result.ctr, 0.02);
  assert.equal(result.conversion_rate, 0.25);
  assert.equal(result.cost_per_conversion, 20);
  assert.equal(result.roas, 4);
});

test('repository chunks idempotent breakdown upserts', async () => {
  const calls = [];
  const client = {
    request: async (path, options) => {
      calls.push({ path, options });
      return null;
    },
  };
  const repository = new MarketingRepository(client, { chunkSize: 2 });
  const count = await repository.upsertBreakdowns([{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(count, 3);
  assert.equal(calls.length, 2);
  assert.match(calls[0].path, /^marketing_breakdown_daily\?on_conflict=/);
  assert.match(decodeURIComponent(calls[0].path), /breakdown_type,breakdown_value/);
  assert.equal(calls[0].options.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
});
