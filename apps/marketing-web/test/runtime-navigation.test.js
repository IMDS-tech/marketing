import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appShell=await readFile(new URL('../src/app/AppShell.tsx',import.meta.url),'utf8');
const navigation=await readFile(new URL('../src/modules/navigation.ts',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8');
const apiClient=await readFile(new URL('../../../packages/api-client/src/index.ts',import.meta.url),'utf8');
const clientsApi=await readFile(new URL('../src/clients-api.ts',import.meta.url),'utf8');
const reportApi=await readFile(new URL('../src/report-api.ts',import.meta.url),'utf8');
const crossClientPage=await readFile(new URL('../src/pages/cross-client/CrossClientAnalyticsPage.tsx',import.meta.url),'utf8');

const backendModules=['platform-core-service','integration-service','report-api','notification-worker','ai-service','search-indexer'];

test('sidebar contains only completed user-facing modules',()=>{
  assert.ok(appShell.includes('getUserNavigationDomains'));
  assert.ok(navigation.includes("module.surface==='backend'||module.surface==='superadmin'"));
  assert.ok(navigation.includes("getModuleDeliveryStatus(module.id)!=='complete'"));
  for(const marker of ['global-search','module-status-legend','setup-card','AgencyAI','quiet-action','demoMode','demoUser'])assert.ok(!appShell.includes(marker),marker);
  for(const moduleId of backendModules)assert.ok(navigation.includes(`'${moduleId}'`),moduleId);
});

test('placeholder routes are not mounted',()=>{
  for(const marker of ['EmptySectionPage','ModulePlaceholderPage',"path:'/kpis'","path:'/templates'","path:'/exports'","path:'/platform/module/$moduleId'"])assert.ok(!main.includes(marker),marker);
  assert.ok(main.includes("path:'/rollups'"));
  assert.ok(main.includes('CrossClientAnalyticsPage'));
  assert.ok(crossClientPage.includes('Client Comparison'));
  assert.ok(main.includes("path:'/platform/modules'"));
  assert.ok(main.includes("path:'/backend/$serviceId'"));
});

test('runtime requires configured services and contains no demo records',()=>{
  assert.ok(main.includes('if(!configured)return <ConfigurationError/>'));
  for(const source of [apiClient,clientsApi,reportApi]){
    assert.ok(!source.includes('demo-agency'));
    assert.ok(!source.includes('Amanat Med'));
    assert.ok(!source.includes('Demo Clinic'));
  }
  assert.ok(clientsApi.includes('CLIENTS_API_NOT_CONFIGURED'));
  assert.ok(reportApi.includes('REPORT_API_NOT_CONFIGURED'));
});
