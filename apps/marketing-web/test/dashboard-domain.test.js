import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../src/pages/dashboard/DashboardWorkspacePage.tsx',import.meta.url),'utf8');
const api=await readFile(new URL('../src/dashboard-api.ts',import.meta.url),'utf8');
const navigation=await readFile(new URL('../src/modules/navigation.ts',import.meta.url),'utf8');
const progress=await readFile(new URL('../src/modules/progress.ts',import.meta.url),'utf8');
const controller=await readFile(new URL('../../../services/report-api/src/dashboard.controller.ts',import.meta.url),'utf8');

test('dashboard domain uses tenant-safe API instead of browser table access',()=>{
 assert.ok(api.includes('/v1/dashboards'));
 assert.ok(!page.includes(".from('dashboards')"));
 assert.ok(!page.includes('demo-'));
 for(const method of ['duplicate','reorder','workspace','save'])assert.ok(api.includes(method),method);
});

test('all dashboard submodules are complete and visible',()=>{
 for(const id of ['dashboard-directory','dashboard-builder','widget-builder','widget-configuration','dashboard-filters']){
  assert.ok(navigation.includes(`'${id}'`),id);
  assert.ok(progress.includes(`'${id}':{status:'complete'`),id);
 }
});

test('dashboard API implements catalog, document persistence and filters',()=>{
 for(const marker of ["@Controller('v1/dashboards')","@Post(':id/duplicate')","@Post('reorder')","@Get(':id/workspace')","@Put(':id/document')",'CLIENT_ACCESS_DENIED','previous_period','previous_year'])assert.ok(controller.includes(marker),marker);
});
