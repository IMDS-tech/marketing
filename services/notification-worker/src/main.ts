import {createServer,type IncomingMessage} from 'node:http';
import {z} from 'zod';
import {Db} from './db.js';import {NotificationWorker} from './worker.js';import {config} from './config.js';
const db=new Db(),worker=new NotificationWorker(db),abort=new AbortController();let processed=0;
const jobSchema=z.object({agencyId:z.string().uuid(),clientId:z.string().uuid().nullable().optional(),userId:z.string().uuid().nullable().optional(),channel:z.enum(['email','in_app','slack','telegram','webhook']),recipient:z.string().trim().min(1).max(2000),templateKey:z.string().trim().min(1).max(120),payload:z.record(z.string(),z.unknown()).default({}),scheduledAt:z.string().datetime().optional(),dedupeKey:z.string().max(240).optional()});
async function body(request:IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of request){const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=value.length;if(size>1_000_000)throw new Error('BODY_TOO_LARGE');chunks.push(value)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
const run=async()=>{while(!abort.signal.aborted){const worked=await worker.runOnce();if(worked)processed++;else await new Promise(resolve=>setTimeout(resolve,config.POLL_INTERVAL_MS))}};
const server=createServer(async(request,response)=>{response.setHeader('content-type','application/json');try{
  if(request.url==='/health'&&request.method==='GET'){response.end(JSON.stringify({ok:true,service:'notification-worker',workerId:config.WORKER_ID,processed,channels:['email','in_app','slack','telegram','webhook']}));return}
  if(request.url==='/v1/notifications/enqueue'&&request.method==='POST'){
    if(request.headers.authorization!==`Bearer ${config.INTERNAL_SERVICE_TOKEN}`){response.statusCode=401;response.end(JSON.stringify({message:'INTERNAL_AUTH_REQUIRED'}));return}
    const parsed=jobSchema.safeParse(await body(request));if(!parsed.success){response.statusCode=400;response.end(JSON.stringify({message:'VALIDATION_FAILED',issues:parsed.error.flatten()}));return}const input=parsed.data;
    const result=await db.query(`insert into public.notification_jobs(agency_id,client_id,user_id,channel,recipient,template_key,payload,run_after,dedupe_key) values($1,$2,$3,$4,$5,$6,$7,coalesce($8::timestamptz,now()),$9) on conflict(dedupe_key) where dedupe_key is not null and state in ('queued','running') do update set payload=excluded.payload,run_after=excluded.run_after,updated_at=now() returning id,state,run_after`,[input.agencyId,input.clientId??null,input.userId??null,input.channel,input.recipient,input.templateKey,input.payload,input.scheduledAt??null,input.dedupeKey??null]);response.statusCode=202;response.end(JSON.stringify(result.rows[0]));return
  }
  response.statusCode=404;response.end(JSON.stringify({message:'NOT_FOUND'}));
}catch(error){response.statusCode=500;response.end(JSON.stringify({message:error instanceof Error?error.message:String(error)}))}});
server.listen(config.PORT,'0.0.0.0');void run();
const shutdown=async()=>{abort.abort();server.close();await db.close();process.exit(0)};process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
