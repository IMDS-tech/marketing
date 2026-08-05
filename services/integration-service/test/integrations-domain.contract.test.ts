import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controller=await readFile(new URL('../src/integrations.controller.ts',import.meta.url),'utf8');
const service=await readFile(new URL('../src/integrations.service.ts',import.meta.url),'utf8');
const migration=await readFile(new URL('../../../supabase/migrations/20260805143000_integrations_domain_completion.sql',import.meta.url),'utf8');

test('integrations api exposes all domain read and operations endpoints',()=>{
  for(const route of ["@Get('workspace')","@Get('schema')","@Patch('sources/:id')","@Post('jobs/:id/retry')"]){
    assert.ok(controller.includes(route),route);
  }
});

test('integrations read model is tenant and permission scoped',()=>{
  assert.match(service,/agency_memberships/);
  assert.match(service,/integrations\.read/);
  assert.match(service,/integrations\.manage/);
  assert.match(service,/client\.agency_id=membership\.agency_id/);
});

test('provider schema and health storage are secured for Supabase Data API',()=>{
  for(const table of ['integration_schema_entities','integration_schema_fields','integration_provider_errors']){
    assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration,new RegExp(`revoke all on public\\.[^;]*${table}`));
  }
  assert.match(migration,/grant select on public\.integration_schema_entities/);
  assert.match(migration,/data_sources_agency_next_sync_idx/);
  assert.match(migration,/sync_depth_days/);
});

test('retry creates a new immutable sync job instead of mutating history',()=>{
  assert.match(service,/insert into public\.sync_jobs/);
  assert.match(service,/retryOf/);
  assert.doesNotMatch(service,/update public\.sync_jobs set state='queued'/);
});
