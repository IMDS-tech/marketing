import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../src/app.module.ts',import.meta.url),'utf8');
const auth=await readFile(new URL('../src/auth-admin.ts',import.meta.url),'utf8');
const env=await readFile(new URL('../.env.example',import.meta.url),'utf8');

test('auth admin credentials remain server-side',()=>{
  assert.ok(auth.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(env.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(auth.includes('/auth/v1/invite'));
});

test('client users expose invite, update and delete endpoints',()=>{
  assert.ok(app.includes('@Post()async invite'));
  assert.ok(app.includes("@Patch(':userId')"));
  assert.ok(app.includes("@Delete(':userId')"));
  assert.ok(app.includes('client_users.manage'));
});

test('client groups expose update and safe delete endpoints',()=>{
  assert.ok(app.includes("@Patch(':id')async update"));
  assert.ok(app.includes('CLIENT_GROUP_NOT_EMPTY_OR_NOT_FOUND'));
  assert.ok(app.includes('not exists(select 1 from public.clients where group_id=$1)'));
});
