import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const navigation=await readFile(new URL('../src/modules/navigation.ts',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8');
const page=await readFile(new URL('../src/pages/backend/BackendServicesPage.tsx',import.meta.url),'utf8');
const modules=['platform-core-service','integration-service','report-api','notification-worker','ai-service','search-indexer'];
test('Backend Services modules do not route to placeholder',()=>{for(const id of modules){assert.ok(navigation.includes(`'${id}':()=>'/backend/${id}'`),id)}assert.ok(main.includes("path:'/backend/$serviceId'"));assert.ok(main.includes('BackendServicesPage'))});
test('Backend Services console exposes runtime health and operational endpoints',()=>{for(const id of modules)assert.ok(page.includes(`'${id}'`),id);assert.ok(page.includes('/health'));assert.ok(page.includes('Check health'));assert.ok(page.includes('Operational endpoints'))});
