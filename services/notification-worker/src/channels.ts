import {createHmac} from 'node:crypto';
export type NotificationJob={id:string;channel:'email'|'in_app'|'slack'|'telegram'|'webhook';recipient:string;template_key:string;payload:Record<string,unknown>};
type ChannelConfig={EMAIL_WEBHOOK_URL?:string;SLACK_WEBHOOK_URL?:string;TELEGRAM_BOT_TOKEN?:string;WEBHOOK_SIGNING_SECRET:string};
const json=async(response:Response)=>{const payload=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error((payload as any)?.message||`DELIVERY_HTTP_${response.status}`),{status:response.status,retryable:response.status===429||response.status>=500});return payload};
export function signWebhook(secret:string,timestamp:string,body:string){return createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex')}
export async function deliver(job:NotificationJob,config:ChannelConfig,fetchImpl:typeof fetch=fetch){
  if(job.channel==='in_app')return{providerMessageId:`in-app:${job.id}`,response:{stored:true}};
  if(job.channel==='email'){
    if(!config.EMAIL_WEBHOOK_URL)throw Object.assign(new Error('EMAIL_PROVIDER_NOT_CONFIGURED'),{retryable:false});
    const response=await fetchImpl(config.EMAIL_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({to:job.recipient,template:job.template_key,payload:job.payload,idempotencyKey:job.id})});const data=await json(response);return{providerMessageId:String((data as any)?.id??job.id),response:data};
  }
  if(job.channel==='slack'){
    const endpoint=job.recipient.startsWith('https://')?job.recipient:config.SLACK_WEBHOOK_URL;if(!endpoint)throw Object.assign(new Error('SLACK_PROVIDER_NOT_CONFIGURED'),{retryable:false});
    const response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:String(job.payload.text??job.template_key),blocks:job.payload.blocks})});if(!response.ok)throw Object.assign(new Error(`SLACK_HTTP_${response.status}`),{status:response.status,retryable:response.status===429||response.status>=500});return{providerMessageId:`slack:${job.id}`,response:{status:response.status}};
  }
  if(job.channel==='telegram'){
    if(!config.TELEGRAM_BOT_TOKEN)throw Object.assign(new Error('TELEGRAM_PROVIDER_NOT_CONFIGURED'),{retryable:false});
    const response=await fetchImpl(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:job.recipient,text:String(job.payload.text??job.template_key),parse_mode:'HTML',disable_web_page_preview:true})});const data=await json(response);return{providerMessageId:String((data as any)?.result?.message_id??job.id),response:data};
  }
  if(!job.recipient.startsWith('https://'))throw Object.assign(new Error('WEBHOOK_HTTPS_REQUIRED'),{retryable:false});
  const timestamp=Math.floor(Date.now()/1000).toString(),body=JSON.stringify({id:job.id,event:job.template_key,data:job.payload});const signature=signWebhook(config.WEBHOOK_SIGNING_SECRET,timestamp,body);
  const response=await fetchImpl(job.recipient,{method:'POST',headers:{'content-type':'application/json','x-imds-timestamp':timestamp,'x-imds-signature':`sha256=${signature}`,'idempotency-key':job.id},body});const data=await response.text();if(!response.ok)throw Object.assign(new Error(`WEBHOOK_HTTP_${response.status}`),{status:response.status,retryable:response.status===408||response.status===429||response.status>=500});return{providerMessageId:response.headers.get('x-request-id')??job.id,response:{status:response.status,body:data.slice(0,2000)}};
}
