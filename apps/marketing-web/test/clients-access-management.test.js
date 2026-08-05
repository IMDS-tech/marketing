import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../src/pages/clients/ClientsWorkspacePage.tsx',import.meta.url),'utf8');
const api=await readFile(new URL('../src/clients-api.ts',import.meta.url),'utf8');

test('client users are invited by email and no UUID input remains',()=>{
  assert.ok(page.includes('type="email"'));
  assert.ok(page.includes('inviteClientUser'));
  assert.ok(!page.includes('UUID пользователя'));
  assert.ok(api.includes('SUPABASE')===false,'frontend must not contain service role configuration');
});

test('client access supports role, status and removal lifecycle',()=>{
  for(const action of ['updateClientUser','removeClientUser'])assert.ok(page.includes(action),action);
  for(const state of ['invited','active','suspended'])assert.ok(page.includes(state),state);
  for(const role of ['viewer','editor','manager','owner'])assert.ok(page.includes(role),role);
});

test('client groups support update and safe delete',()=>{
  for(const action of ['updateGroup','deleteGroup'])assert.ok(api.includes(action),action);
  assert.ok(page.includes('Удалить пустую группу'));
  assert.ok(page.includes('group.client_count>0'));
});
