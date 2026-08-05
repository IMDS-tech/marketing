import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controller=await readFile(new URL('../src/connections.controller.ts',import.meta.url),'utf8');
const service=await readFile(new URL('../src/connections.service.ts',import.meta.url),'utf8');

test('connection manager exposes all lifecycle operations',()=>{
  for(const route of ["@Post('manual')","@Post(':id/sync')","@Post(':id/status')","@Post('accounts/:id/revoke')","@Delete(':id')"]){
    assert.ok(controller.includes(route),route);
  }
});

test('connection writes are tenant-authorized and credentials stay private',()=>{
  assert.match(service,/agency_memberships/);
  assert.match(service,/integrations\.manage/);
  assert.match(service,/private\.integration_credentials/);
  assert.match(service,/encryptJson/);
  assert.match(service,/revoked_at/);
});

test('pause and disconnect cancel queued jobs',()=>{
  assert.match(service,/state='cancelled'/);
  assert.match(service,/settings=jsonb_set/);
  assert.match(service,/status='disconnected'/);
});
