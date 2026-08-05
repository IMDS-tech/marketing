import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import process from 'node:process';

const root=resolve(import.meta.dirname,'..');
const cliVersion='2.109.1';
const strip=v=>v?.trim().replace(/^['"]|['"]$/g,'');
function parseEnv(text){return Object.fromEntries(text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),strip(line.slice(i+1))]}))}
function localStatus(){const bin=process.platform==='win32'?'pnpm.cmd':'pnpm';try{return parseEnv(execFileSync(bin,['dlx',`supabase@${cliVersion}`,'status','-o','env'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','inherit']}))}catch{throw new Error('Supabase local stack is not running. Run `pnpm supabase:start` first.')}}
const fileEnv=(()=>{try{return parseEnv(readFileSync(resolve(root,'.env'),'utf8'))}catch{return{}}})();
const status=localStatus();
const env={...fileEnv,...status,...process.env};
const supabaseUrl=env.SUPABASE_URL||env.API_URL;
const serviceRole=env.SUPABASE_SERVICE_ROLE_KEY||env.SERVICE_ROLE_KEY;
const publishableKey=env.VITE_SUPABASE_PUBLISHABLE_KEY||env.ANON_KEY;
const databaseUrl=env.DATABASE_URL||env.DB_URL;
if(!supabaseUrl||!serviceRole||!publishableKey||!databaseUrl)throw new Error('Supabase status did not return API_URL, DB_URL, ANON_KEY and SERVICE_ROLE_KEY.');
const host=new URL(supabaseUrl).hostname;
const isLocal=['127.0.0.1','localhost','::1'].includes(host);
if(!isLocal&&env.ALLOW_REMOTE_BOOTSTRAP!=='true')throw new Error('Remote bootstrap is blocked. Set ALLOW_REMOTE_BOOTSTRAP=true only for an isolated non-production environment.');

const email=env.IMDS_LOCAL_ADMIN_EMAIL||'admin@imds.local';
const password=env.IMDS_LOCAL_ADMIN_PASSWORD||'ImdsLocal123!';
const name=env.IMDS_LOCAL_ADMIN_NAME||'IMDS Local Admin';
const agencyName=env.IMDS_LOCAL_AGENCY_NAME||'IMDS Demo Agency';
const clientName=env.IMDS_LOCAL_CLIENT_NAME||'Demo Client';
const internalToken=randomBytes(32).toString('hex');
const masterKey=randomBytes(32).toString('base64');
const webhookSecret=randomBytes(32).toString('hex');

async function request(path,{method='GET',body,auth=true,prefer}={}){const headers={apikey:serviceRole,'content-type':'application/json'};if(auth)headers.authorization=`Bearer ${serviceRole}`;if(prefer)headers.prefer=prefer;const response=await fetch(`${supabaseUrl}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});if(!response.ok)throw new Error(`${method} ${path} failed (${response.status}): ${await response.text()}`);if(response.status===204)return null;const text=await response.text();return text?JSON.parse(text):null}
async function rest(table,query='',options={}){return request(`/rest/v1/${table}${query}`,options)}

let users=await request('/auth/v1/admin/users?page=1&per_page=1000');
let user=(users.users||[]).find(item=>item.email?.toLowerCase()===email.toLowerCase());
if(!user){const created=await request('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true,user_metadata:{name}}});user=created.user||created}
if(!user?.id)throw new Error('Auth Admin API did not return a user id.');

await rest('user_profiles','?on_conflict=user_id',{method:'POST',body:[{user_id:user.id,name,locale:'ru'}],prefer:'resolution=merge-duplicates,return=representation'});
let agencies=await rest('agencies',`?contact_email=eq.${encodeURIComponent(email)}&select=*`);
let agency=agencies[0];
if(!agency){const rows=await rest('agencies','?select=*',{method:'POST',body:[{name:agencyName,contact_email:email,language:'ru',timezone:'Asia/Almaty',currency:'KZT',plan:'trial',branding:{primaryColor:'#0072EE'}}],prefer:'return=representation'});agency=rows[0]}
await rest('agency_memberships','?on_conflict=agency_id,user_id',{method:'POST',body:[{agency_id:agency.id,user_id:user.id,role:'admin',permissions:['*'],status:'active'}],prefer:'resolution=merge-duplicates,return=representation'});
await rest('agency_subscriptions','?on_conflict=agency_id',{method:'POST',body:[{agency_id:agency.id,plan:'trial',status:'trialing',billing_cycle:'monthly',provider:'internal'}],prefer:'resolution=merge-duplicates,return=representation'});
await rest('agency_onboarding_progress','?on_conflict=agency_id',{method:'POST',body:[{agency_id:agency.id,steps:{welcome:true,company:true,branding:false,firstClient:true,firstIntegration:false,firstDashboard:false,firstReport:false},current_step:'branding',updated_by:user.id}],prefer:'resolution=merge-duplicates,return=representation'});
let clients=await rest('clients',`?agency_id=eq.${agency.id}&company=eq.${encodeURIComponent(clientName)}&select=*`);
let client=clients[0];
if(!client){const rows=await rest('clients','?select=*',{method:'POST',body:[{agency_id:agency.id,company:clientName,timezone:'Asia/Almaty',country:'KZ',language:'ru',currency:'KZT',brand_color:'#0072EE',status:'active'}],prefer:'return=representation'});client=rows[0]}

function write(path,content){const absolute=resolve(root,path);mkdirSync(dirname(absolute),{recursive:true});writeFileSync(absolute,content.endsWith('\n')?content:`${content}\n`,'utf8')}
const rootEnv=`APP_ORIGIN=http://127.0.0.1:5173\nVITE_SUPABASE_URL=${supabaseUrl}\nVITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}\nVITE_PLATFORM_CORE_SERVICE_URL=http://127.0.0.1:4300\nVITE_CLIENTS_API_URL=http://127.0.0.1:4102\nVITE_INTEGRATION_SERVICE_URL=http://127.0.0.1:4100\nVITE_REPORT_API_URL=http://127.0.0.1:4200\nVITE_AI_SERVICE_URL=http://127.0.0.1:4304\nVITE_SEARCH_INDEXER_URL=http://127.0.0.1:4305\nVITE_ENABLE_DEMO_FALLBACK=false\nIMDS_LOCAL_ADMIN_EMAIL=${email}\nIMDS_LOCAL_ADMIN_PASSWORD=${password}\n`;
write('.env',rootEnv);
write('apps/marketing-web/.env.local',rootEnv.split('\n').filter(line=>line.startsWith('VITE_')).join('\n'));
write('services/platform-core-service/.env',`PORT=4300\nDATABASE_URL=${databaseUrl}\nSUPABASE_URL=${supabaseUrl}\nSUPABASE_SERVICE_ROLE_KEY=${serviceRole}\nAPP_ORIGIN=http://127.0.0.1:5173`);
write('services/clients-api/.env',`DATABASE_URL=${databaseUrl}\nSUPABASE_URL=${supabaseUrl}\nSUPABASE_SERVICE_ROLE_KEY=${serviceRole}\nPORT=4102\nCORS_ORIGIN=http://127.0.0.1:5173`);
write('services/integration-service/.env',`PORT=4100\nDATABASE_URL=${databaseUrl}\nSUPABASE_URL=${supabaseUrl}\nAPP_ORIGIN=http://127.0.0.1:5173\nINTERNAL_SERVICE_TOKEN=${internalToken}\nCREDENTIAL_MASTER_KEY_BASE64=${masterKey}\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\nMETA_CLIENT_ID=\nMETA_CLIENT_SECRET=\nTIKTOK_CLIENT_ID=\nTIKTOK_CLIENT_SECRET=\nOAUTH_CALLBACK_BASE_URL=http://127.0.0.1:4100/v1/oauth`);
write('services/report-api/.env',`PORT=4200\nDATABASE_URL=${databaseUrl}\nSUPABASE_URL=${supabaseUrl}\nAPP_ORIGIN=http://127.0.0.1:5173`);
write('services/sync-worker/.env',`SUPABASE_URL=${supabaseUrl}\nSUPABASE_SERVICE_ROLE_KEY=${serviceRole}\nINTEGRATION_SERVICE_URL=http://127.0.0.1:4100\nINTEGRATION_SERVICE_TOKEN=${internalToken}\nWORKER_ID=sync-worker-local\nWORKER_IDLE_MS=5000\nMETRIC_UPSERT_CHUNK_SIZE=500\nWORKER_RUN_ONCE=false\nWORKER_ENQUEUE_RESYNC=false`);
write('services/notification-worker/.env',`PORT=4303\nDATABASE_URL=${databaseUrl}\nWORKER_ID=notification-local\nPOLL_INTERVAL_MS=3000\nEMAIL_WEBHOOK_URL=\nSLACK_WEBHOOK_URL=\nTELEGRAM_BOT_TOKEN=\nWEBHOOK_SIGNING_SECRET=${webhookSecret}\nINTERNAL_SERVICE_TOKEN=${internalToken}`);
write('services/ai-service/.env',`PORT=4304\nDATABASE_URL=${databaseUrl}\nSUPABASE_URL=${supabaseUrl}\nAPP_ORIGIN=http://127.0.0.1:5173\nAI_PROVIDER_BASE_URL=http://127.0.0.1:9999/v1\nAI_PROVIDER_API_KEY=\nAI_PROVIDER_MODEL=local-placeholder\nAI_MAX_INPUT_CHARS=24000\nAI_ALLOWED_TOOLS=search,metric-summary`);
write('services/search-indexer/.env',`PORT=4305\nDATABASE_URL=${databaseUrl}\nSUPABASE_URL=${supabaseUrl}\nAPP_ORIGIN=http://127.0.0.1:5173\nINTERNAL_SERVICE_TOKEN=${internalToken}\nWORKER_ID=search-indexer-local\nPOLL_INTERVAL_MS=3000\nINDEXER_ENABLED=true`);
mkdirSync(resolve(root,'.local'),{recursive:true});
write('.local/bootstrap.json',JSON.stringify({userId:user.id,agencyId:agency.id,clientId:client.id,email,password:isLocal?password:undefined,supabaseUrl,createdAt:new Date().toISOString()},null,2));
console.log('\nLocal IMDS workspace is ready.');
console.log(`User: ${email}`);if(isLocal)console.log(`Password: ${password}`);
console.log(`Agency: ${agencyName} (${agency.id})`);console.log(`Client: ${clientName} (${client.id})`);
console.log('Generated local .env files. Run `pnpm dev:all`, then `pnpm test:e2e`.');
