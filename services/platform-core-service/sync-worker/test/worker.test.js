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

test('repository sends worker ownership to completion RPCs', async () => {
  const calls=[];
  const client={rpc:async(name,payload)=>{calls.push({name,payload});return null;}};
  const repository=new MarketingRepository(client);
  await repository.completeJob('job-1','worker-a',10,8,{provider:'meta-ads'});
  await repository.failJob('job-2','worker-b',{message:'boom'},120);
  assert.deepEqual(calls[0],{
    name:'complete_marketing_sync_job',
    payload:{job_id:'job-1',worker_id:'worker-a',fetched_rows:10,written_rows:8,run_metadata:{provider:'meta-ads'}},
  });
  assert.deepEqual(calls[1],{
    name:'fail_marketing_sync_job',
    payload:{job_id:'job-2',worker_id:'worker-b',failure:{message:'boom'},retry_delay_seconds:120},
  });
});

test('worker marks provider failure for retry with its worker id', async () => {
  const events=[];
  const repository={
    claimJob:async()=>({id:'job-1',data_source_id:'source-1',period_from:'2026-08-01',period_to:'2026-08-02',attempts:1}),
    getDataSource:async()=>({id:'source-1',agency_id:'a',client_id:'c',integration_slug:'unsupported',credential_handle:'h',external_identifier:'x',label:'X'}),
    failJob:async(id,workerId,failure,delay)=>events.push({id,workerId,failure,delay}),
  };
  const credentials={get:async()=>({provider:'unsupported',access_token:'token'})};
  const worker=new SyncWorker({repository,credentials,workerId:'worker-test'});
  assert.equal(await worker.runOnce(),true);
  assert.equal(events[0].id,'job-1');
  assert.equal(events[0].workerId,'worker-test');
  assert.match(events[0].failure.message,/not implemented/);
  assert.equal(events[0].delay,60);
});
