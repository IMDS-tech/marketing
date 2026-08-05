import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const expected=[
  ['services/platform-core-service/.env.example','PORT','4300'],
  ['services/clients-api/.env.example','PORT','4102'],
  ['services/integration-service/.env.example','PORT','4100'],
  ['services/report-api/.env.example','PORT','4200'],
  ['services/notification-worker/.env.example','PORT','4303'],
  ['services/ai-service/.env.example','PORT','4304'],
  ['services/search-indexer/.env.example','PORT','4305']
];
function parse(path){return Object.fromEntries(readFileSync(resolve(root,path),'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)]}))}
let failed=false;for(const [path,key,value] of expected){const actual=parse(path)[key];if(actual!==value){failed=true;console.error(`${path}: expected ${key}=${value}, received ${actual??'<missing>'}`)}}
const frontend=readFileSync(resolve(root,'apps/marketing-web/.env.example'),'utf8');for(const port of ['4300','4102','4100','4200','4304','4305'])if(!frontend.includes(`:${port}`)){failed=true;console.error(`Frontend env does not reference service port ${port}.`)}
if(failed)process.exit(1);console.log('Port matrix is consistent.');
