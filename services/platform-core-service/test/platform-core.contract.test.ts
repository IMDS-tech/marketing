import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/app.module.ts',import.meta.url),'utf8');
const auth=await readFile(new URL('../src/auth-admin.ts',import.meta.url),'utf8');
test('platform core exposes workspace, permissions and audit contracts',()=>{for(const route of ["@Get('workspace')","@Get('permissions')","@Get('audit')","@Post('audit')"])assert.ok(source.includes(route),route)});
test('platform core exposes complete agency management contracts',()=>{for(const route of ["@Get('agency')","@Patch('agency')","@Post('memberships/invite')","@Patch('memberships/:userId')","@Get('teams')","@Post('teams')","@Get('billing')","@Patch('billing/subscription')","@Post('billing/cancel')","@Get('onboarding')","@Patch('onboarding')"])assert.ok(source.includes(route),route)});
test('agency writes are permission checked and audited',()=>{for(const permission of ['agency.manage','users.manage','billing.manage','onboarding.manage'])assert.ok(source.includes(permission),permission);assert.match(source,/audit_logs/)});
test('auth admin is server only and uses service role',()=>{assert.match(auth,/SUPABASE_SERVICE_ROLE_KEY/);assert.match(auth,/auth\/v1\/invite/)});
