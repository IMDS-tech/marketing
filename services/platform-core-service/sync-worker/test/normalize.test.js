import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMetaSnapshot, sumActions } from '../src/providers/meta/normalize.js';

test('counts configured Meta lead action types', () => {
  assert.equal(sumActions([{ action_type: 'lead', value: '2' }, { action_type: 'link_click', value: '9' }], new Set(['lead'])), 2);
});

test('normalizes current and archived entities', () => {
  const result = normalizeMetaSnapshot({
    account: { id: 'act_1', name: 'Account', currency: 'USD', timezone_name: 'Asia/Almaty' },
    campaigns: [], adsets: [], ads: [],
    insights: [{ campaign_id: 'c1', campaign_name: 'Campaign', adset_id: 's1', adset_name: 'Set', ad_id: 'a1', ad_name: 'Ad', date_start: '2026-08-01', impressions: '100', clicks: '5', spend: '10', actions: [{ action_type: 'lead', value: '1' }] }],
  }, { leadActionTypes: new Set(['lead']) });
  assert.equal(result.account.externalAccountId, '1');
  assert.equal(result.campaigns.length, 1);
  assert.equal(result.metrics[0].platformLeads, 1);
  assert.match(result.metrics[0].sourceHash, /^[a-f0-9]{64}$/);
});
