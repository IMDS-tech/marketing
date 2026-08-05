import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/analytics.controller.ts',import.meta.url),'utf8');
test('report API exposes all analytics surfaces',()=>{for(const route of ["@Get('metrics')","@Post('aggregate')","@Get('dashboard/:dashboardId')","@Get('kpis')","@Get('rollups')","@Get('views')"])assert.ok(source.includes(route),route)});
test('analytics queries are tenant and client scoped',()=>{assert.match(source,/agency_id=\$1/);assert.match(source,/client_id=\$2/);assert.match(source,/CLIENT_ACCESS_DENIED/)});
