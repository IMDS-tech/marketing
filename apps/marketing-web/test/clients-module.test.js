import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const main=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8');
const navigation=await readFile(new URL('../src/modules/navigation.ts',import.meta.url),'utf8');
const progress=await readFile(new URL('../src/modules/progress.ts',import.meta.url),'utf8');
const workspace=await readFile(new URL('../src/pages/clients/ClientsWorkspacePage.tsx',import.meta.url),'utf8');
const css=await readFile(new URL('../src/pages/clients/clients-workspace.css',import.meta.url),'utf8');

const clientRoutes=['/','/clients/new','/clients/groups','/client/$clientId/profile','/client/$clientId/users','/client/$clientId/settings'];
const moduleIds=['client-directory','client-creation','client-profile','client-users','client-settings','client-groups'];

test('all Clients pages use live application routes',()=>{
  for(const route of clientRoutes)assert.ok(main.includes(`path:'${route}'`),route);
  for(const moduleId of moduleIds){
    assert.ok(navigation.includes(`'${moduleId}'`),moduleId);
    assert.ok(progress.includes(`'${moduleId}':{status:'complete'`),moduleId);
  }
});

test('Clients workspace contains working directory, profile, users, settings and groups surfaces',()=>{
  for(const marker of ['listClients','ClientEditor','UsersView','GroupsView','archiveClient'])assert.ok(workspace.includes(marker),marker);
});

test('Clients directory keeps responsive stats and table layout',()=>{
  for(const selector of ['.stats-grid{display:grid','.clients-card table{width:100%','.form-grid{display:grid','@media(max-width:900px)'])assert.ok(css.includes(selector),selector);
  assert.ok(css.includes('var(--app-line)'));
  assert.ok(!css.includes('var(--border)'));
});
