import {Db} from './db.js';import {config} from './config.js';import {deliver,type NotificationJob} from './channels.js';
type QueueJob=NotificationJob&{attempts:number;max_attempts:number};
const failure=(error:unknown)=>({name:error instanceof Error?error.name:'Error',message:error instanceof Error?error.message:String(error),status:(error as any)?.status??null,retryable:(error as any)?.retryable??null});
const delay=(attempt:number)=>Math.min(3600,30*2**Math.max(0,attempt-1));
export class NotificationWorker{
  constructor(private readonly db:Db,private readonly fetchImpl:typeof fetch=fetch){}
  async runOnce(){const claimed=await this.db.query<QueueJob>(`select * from public.claim_notification_job($1)`,[config.WORKER_ID]);const job=claimed.rows[0];if(!job)return false;try{const result=await deliver(job,config,this.fetchImpl);await this.db.query(`select public.complete_notification_job($1,$2,$3,$4)`,[job.id,config.WORKER_ID,result.providerMessageId,result.response]);return true}catch(error){await this.db.query(`select public.fail_notification_job($1,$2,$3,$4)`,[job.id,config.WORKER_ID,failure(error),delay(job.attempts)]);return true}}
  async run(signal:AbortSignal){while(!signal.aborted){const worked=await this.runOnce();if(!worked)await new Promise(resolve=>setTimeout(resolve,config.POLL_INTERVAL_MS))}}
}
