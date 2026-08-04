import test from 'node:test';
import assert from 'node:assert/strict';
import { MetaClient } from '../src/providers/meta/meta-client.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('follows Meta cursor pagination', async () => {
  let calls = 0;
  const client = new MetaClient({ accessToken: 'secret', maxRetries: 0, fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? json({ data: [{ id: '1' }], paging: { next: 'https://graph.facebook.com/v25.0/next?after=x&access_token=secret' } }) : json({ data: [{ id: '2' }] });
  }});
  assert.deepEqual(await client.fetchAll('act_1/campaigns', { fields: 'id' }), [{ id: '1' }, { id: '2' }]);
});

test('retries transient errors', async () => {
  let calls = 0;
  const client = new MetaClient({ accessToken: 'secret', maxRetries: 2, sleepImpl: async () => {}, fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? json({ error: { message: 'rate', code: 4, is_transient: true } }, 400) : json({ data: [] });
  }});
  await client.request('act_1/campaigns');
  assert.equal(calls, 2);
});

test('refuses an external pagination host', async () => {
  const client = new MetaClient({ accessToken: 'secret', maxRetries: 0, fetchImpl: async () => json({ data: [], paging: { next: 'https://example.com/leak' } }) });
  await assert.rejects(client.fetchAll('act_1/campaigns', { fields: 'id' }), /unexpected pagination host/);
});
