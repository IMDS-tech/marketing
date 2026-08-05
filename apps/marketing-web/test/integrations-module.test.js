import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const main=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8');const navigation=await readFile(new URL('../src/modules/navigation.ts',import.meta.url),'utf8');const workspace=await readFile(new URL('../src/pages/integrations/IntegrationsWorkspacePage.tsx',import.meta.url),'utf8');const api=await readFile(new URL('../src/integration-api.ts',import.meta.url),'utf8');
const routes=['/data','/data/connections','/data/agency-connections','/client/$clientId/data','/data/schema','/data/sync-health'];
test('all Integrations and Data Sources pages are routed',()=>{for(const route of routes)assert.ok(main.includes(`path:'${route}'`),route);for(const moduleId of ['integration-catalog','connection-manager','agency-connections','data-source-management','integration-schema','sync-health'])assert.ok(navigation.includes(`'${moduleId}'`),moduleId)});
test('connection manager exposes full source lifecycle',()=>{for(const action of ['manualAttach','sync:','setStatus:','remove:','revokeAccount:'])assert.ok(api.includes(action),action);for(const label of ['Sync now','Pause','Resume','Reconnect','Disconnect','Delete'])assert.ok(workspace.includes(label),label)});
test('sync health contains queue, freshness and run history',()=>{for(const value of ['Sync queue','Run history','Stale sources','attempts','rows_written'])assert.ok(workspace.includes(value),value)});
