import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const modules=['platform-core-service','integration-service','report-api','notification-worker','ai-service','search-indexer'];
test('all Backend Services modules are marked complete',async()=>{const source=await readFile(new URL('../src/modules/progress.ts',import.meta.url),'utf8');for(const module of modules)assert.match(source,new RegExp(`'${module}':\\{status:'complete'`),module)});
test('all Backend Services have executable service packages',async()=>{for(const module of modules){const packageUrl=new URL(`../../../services/${module}/package.json`,import.meta.url);assert.equal((await stat(packageUrl)).isFile(),true,module);const pkg=JSON.parse(await readFile(packageUrl,'utf8'));assert.ok(pkg.scripts?.check,module);assert.ok(pkg.scripts?.build,module);assert.ok(pkg.scripts?.test,module)}});
