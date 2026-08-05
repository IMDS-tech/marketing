import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import process from 'node:process';

const root=resolve(import.meta.dirname,'..');
const services=[
  {name:'web',pkg:'@imds/marketing-web',script:'dev',port:5173,env:'apps/marketing-web/.env.local'},
  {name:'platform',pkg:'@imds/platform-core-service',script:'dev',port:4300,env:'services/platform-core-service/.env'},
  {name:'clients',pkg:'@imds/clients-api',script:'dev',port:4102,env:'services/clients-api/.env'},
  {name:'integrations',pkg:'@imds/integration-service',script:'dev',port:4100,env:'services/integration-service/.env'},
  {name:'reports',pkg:'@imds/report-api',script:'dev',port:4200,env:'services/report-api/.env'},
  {name:'notifications',pkg:'@imds/notification-worker',script:'dev',env:'services/notification-worker/.env'},
  {name:'ai',pkg:'@imds/ai-service',script:'dev',port:4304,env:'services/ai-service/.env'},
  {name:'search',pkg:'@imds/search-indexer',script:'dev',port:4305,env:'services/search-indexer/.env'},
  {name:'sync',pkg:'@imds/marketing-sync-worker',script:'start',env:'services/sync-worker/.env'}
];
function parseEnv(path){if(!existsSync(path))return{};return Object.fromEntries(readFileSync(path,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x.includes('=')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')]}))}
function portFree(port){return new Promise(resolveResult=>{const socket=createConnection({host:'127.0.0.1',port});const done=value=>{socket.destroy();resolveResult(value)};socket.once('connect',()=>done(false));socket.once('error',()=>done(true));socket.setTimeout(800,()=>done(true))})}
function prefix(stream,name,target){let pending='';stream.on('data',chunk=>{pending+=chunk.toString();const lines=pending.split(/\r?\n/);pending=lines.pop()||'';for(const line of lines)target.write(`[${name}] ${line}\n`)});stream.on('end',()=>{if(pending)target.write(`[${name}] ${pending}\n`)})}
const selected=process.env.DEV_SERVICES?new Set(process.env.DEV_SERVICES.split(',').map(x=>x.trim())):null;
const active=services.filter(service=>!selected||selected.has(service.name));
for(const service of active){const envPath=resolve(root,service.env);if(!existsSync(envPath)){console.error(`Missing ${service.env}. Run \`pnpm bootstrap:local\` first.`);process.exit(1)}if(service.port&&process.env.SKIP_PORT_CHECK!=='1'&&!(await portFree(service.port))){console.error(`Port ${service.port} for ${service.name} is already in use.`);process.exit(1)}}
let stopping=false;const children=[];
function stop(signal='SIGTERM'){if(stopping)return;stopping=true;for(const child of children)if(!child.killed)child.kill(signal);setTimeout(()=>process.exit(process.exitCode||0),1500).unref()}
process.on('SIGINT',()=>stop('SIGINT'));process.on('SIGTERM',()=>stop('SIGTERM'));
for(const service of active){const command=`pnpm --filter ${service.pkg} ${service.script}`;const child=spawn(command,{cwd:root,env:{...process.env,...parseEnv(resolve(root,service.env))},shell:true,stdio:['inherit','pipe','pipe']});children.push(child);prefix(child.stdout,service.name,process.stdout);prefix(child.stderr,service.name,process.stderr);child.on('exit',code=>{if(!stopping&&code!==0){console.error(`[${service.name}] exited with code ${code}`);process.exitCode=code||1;stop()}})}
console.log(`Started ${active.map(x=>x.name).join(', ')}. Press Ctrl+C to stop.`);
