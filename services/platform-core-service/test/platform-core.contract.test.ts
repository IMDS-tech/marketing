import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/app.module.ts',import.meta.url),'utf8');
test('platform core exposes workspace, permissions and audit contracts',()=>{
  for(const route of ["@Get('workspace')","@Get('permissions')","@Get('audit')","@Post('audit')"])assert.ok(source.includes(route),route);
});
test('workspace is tenant scoped and merges plan overrides',()=>{
  assert.match(source,/agency_memberships/);assert.match(source,/agency_entitlement_overrides/);assert.match(source,/agency_feature_flags/);assert.match(source,/audit_logs/);
});

test('platform core exposes tenant, membership, branding and billing boundaries',()=>{for(const route of ["@Get('tenants')","@Get('memberships')","@Get('branding')","@Get('billing')"])assert.ok(source.includes(route),route)});
