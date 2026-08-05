import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const file=resolve(import.meta.dirname,'../docs/openapi/platform.openapi.json');
const document=JSON.parse(readFileSync(file,'utf8'));
if(!String(document.openapi||'').startsWith('3.1.'))throw new Error('OpenAPI version must be 3.1.x.');
if(!document.info?.title||!document.info?.version)throw new Error('OpenAPI info is incomplete.');
if(!document.paths||Object.keys(document.paths).length<8)throw new Error('OpenAPI path catalog is incomplete.');
if(!document.components?.securitySchemes?.bearerAuth)throw new Error('bearerAuth security scheme is missing.');
console.log(`OpenAPI ${document.info.version}: ${Object.keys(document.paths).length} paths validated.`);
