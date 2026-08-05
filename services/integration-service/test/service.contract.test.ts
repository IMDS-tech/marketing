import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/service.controller.ts',import.meta.url),'utf8');
test('integration service publishes health, provider catalog and tenant status',()=>{for(const token of ["@Get('health')","@Get('v1/providers')","@Get('v1/service/status')"])assert.ok(source.includes(token),token)});
test('status never exposes credential contents',()=>{assert.match(source,/count\(\*\).*integration_credentials/s);assert.doesNotMatch(source,/ciphertext|client_secret|access_token/)});
