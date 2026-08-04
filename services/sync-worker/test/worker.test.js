import test from 'node:test';
import assert from 'node:assert/strict';
import { MarketingRepository } from '../src/repositories/marketing-repository.js';
import { SyncWorker } from '../src/worker.js';

test('repository chunks idempotent metric upserts', async () => {
  const calls=[];
  const client={request:async(path,options)=>{calls.push({path,options});return null;}};
  const repository=new MarketingRepository(client,{chunkSize:2});
  const count=await repository.upsertMetrics([{a:1},{a:2},{a:3}]);
  assert.equal(count,3);
  assert.equal(calls.length,2);
  assert.match(calls[0].path,/on_conflict=/);
  assert.equal(calls[0].options.headers.Prefer,'resolution=merge-duplicates,return=minimal');
});

test('worker marks provider failure for retry', async () => {
  const events=[];
  const repository={
    claimJob:async()=>({id:'job-1',data_source_id:'source-1',period_from:'2026-08-01',period_to:'2026-08-02',attempts:1}),
    getDataSource:async()=>({id:'source-1',agency_id:'a',client_id:'c',integration_slug:'unsupported',credential_handle:'h',external_identifier:'x',label:'X'}),
    failJob:async(id,failure,delay)=>events.push({id,failure,delay}),
  };
  const credentials={get:async()=>({provider:'unsupported',access_token:'token'})};
  const worker=new SyncWorker({repository,credentials,workerId:'test'});
  assert.equal(await worker.runOnce(),true);
  assert.equal(events[0].id,'job-1');
  assert.match(events[0].failure.message,/not implemented/);
  assert.equal(events[0].delay,60);
});
