const AUTH_CODES=new Set(['invalid_grant','invalid_token','token_expired','oauth_expired','permission_denied']);
const NETWORK_CODES=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT']);

function numericStatus(error){const value=Number(error?.status??error?.statusCode??error?.response?.status);return Number.isFinite(value)?value:null}
function retryAfter(error){const raw=error?.retryAfter??error?.retry_after??error?.response?.headers?.get?.('retry-after');if(raw===undefined||raw===null)return null;const seconds=Number(raw);if(Number.isFinite(seconds))return Math.max(0,Math.ceil(seconds));const at=Date.parse(String(raw));return Number.isNaN(at)?null:Math.max(0,Math.ceil((at-Date.now())/1000))}
function jitter(seed,window=15){let hash=2166136261;for(const char of String(seed))hash=Math.imul(hash^char.charCodeAt(0),16777619);return Math.abs(hash)%Math.max(1,window)}

export function classifyProviderError(error){
  const status=numericStatus(error);const code=String(error?.code||error?.name||'').toLowerCase();const message=String(error?.message||error||'');
  if(error?.retryable===false)return{category:'permanent',retryable:false,status,code};
  if(status===401||status===403||AUTH_CODES.has(code))return{category:'authentication',retryable:false,status,code};
  if(status===429||code.includes('rate_limit'))return{category:'rate_limit',retryable:true,status,code};
  if(status!==null&&status>=500)return{category:'upstream',retryable:true,status,code};
  if(error?.retryable===true||error?.isTransient===true||NETWORK_CODES.has(String(error?.code||''))||/timeout|temporar|network|socket|fetch failed/i.test(message))return{category:'transient',retryable:true,status,code};
  if(status!==null&&status>=400)return{category:'provider_request',retryable:false,status,code};
  return{category:'unknown',retryable:true,status,code};
}

export function retryDelaySeconds(job,error,{baseSeconds=30,maxSeconds=3600}={}){
  const classification=classifyProviderError(error);if(!classification.retryable)return 0;
  const providerDelay=retryAfter(error);if(providerDelay!==null)return Math.min(maxSeconds,providerDelay);
  const attempt=Math.max(1,Number(job?.attempts||1));const exponential=Math.min(maxSeconds,baseSeconds*(2**Math.max(0,attempt-1)));
  return Math.min(maxSeconds,exponential+jitter(`${job?.id||'job'}:${attempt}`,Math.max(2,Math.ceil(exponential*0.1))));
}

export function failurePayload(error,job){
  const classification=classifyProviderError(error);
  return{name:error?.name||'Error',message:error?.message||String(error),status:classification.status,code:error?.code||null,category:classification.category,retryable:classification.retryable,attempt:Number(job?.attempts||0),quality:error?.quality?{received:error.quality.received,accepted:error.quality.acceptedCount,rejected:error.quality.rejectedCount,reasons:error.quality.reasons}:undefined};
}
