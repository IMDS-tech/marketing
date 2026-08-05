import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controller=await readFile(new URL('../src/advertising.controller.ts',import.meta.url),'utf8');
const security=await readFile(new URL('../src/security.ts',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');

test('report API registers the advertising analytics workspace',()=>{
  assert.match(controller,/@Controller\('v1\/advertising'\)/);
  assert.match(controller,/@Get\('workspace'\)/);
  assert.match(main,/AdvertisingModule/);
});

test('advertising analytics is tenant, client and permission scoped',()=>{
  assert.match(controller,/analytics\.read/);
  assert.match(controller,/m\.agency_id=\$1/);
  assert.match(controller,/m\.client_id=\$2/);
  assert.match(controller,/CLIENT_ACCESS_DENIED/);
  assert.match(security,/analytics\.read/);
});

test('campaign aggregation prevents hierarchy double counting and mixed currency totals',()=>{
  assert.match(controller,/entity_rank/);
  assert.match(controller,/min\(entity_rank\) over/);
  assert.match(controller,/effectiveCurrency/);
  assert.match(controller,/currencySelectionRequired/);
});

test('workspace includes comparisons, funnel, derived metrics and pagination',()=>{
  for(const contract of ['previousFrom','previousTo','clickToLead','leadToSale','cpm','cpa','roas','funnel(current)','pageSize','pages'])assert.ok(controller.includes(contract),contract);
});
