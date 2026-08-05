import process from 'node:process';
const targets=[
  ['web',process.env.WEB_URL||'http://127.0.0.1:5173/'],
  ['platform',process.env.PLATFORM_CORE_URL||'http://127.0.0.1:4300/health'],
  ['clients',process.env.CLIENTS_API_URL||'http://127.0.0.1:4102/health'],
  ['integrations',process.env.INTEGRATION_SERVICE_URL||'http://127.0.0.1:4100/health'],
  ['reports',process.env.REPORT_API_URL||'http://127.0.0.1:4200/health'],
  ['ai',process.env.AI_SERVICE_URL||'http://127.0.0.1:4304/health'],
  ['search',process.env.SEARCH_INDEXER_URL||'http://127.0.0.1:4305/health']
];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(name,url){let last;for(let attempt=1;attempt<=10;attempt++){try{const response=await fetch(url,{signal:AbortSignal.timeout(2500)});if(response.ok){console.log(`[ok] ${name} ${url}`);return}last=new Error(`HTTP ${response.status}`)}catch(error){last=error}await sleep(1000)}throw new Error(`${name} is not healthy at ${url}: ${last?.message||last}`)}
for(const [name,url] of targets)await check(name,url);
console.log('All HTTP components are healthy.');
