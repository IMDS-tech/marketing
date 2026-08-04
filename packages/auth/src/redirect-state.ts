export type AuthRedirectFlow='google'|'azure'|'magic'|'recovery'|'confirmation'|'unknown';
export type AuthRedirectStatus='none'|'success'|'error';

export interface AuthRedirectState{
  status:AuthRedirectStatus;
  flow:AuthRedirectFlow;
  message:string|null;
  errorCode:string|null;
}

const authQueryKeys=['code','error','error_code','error_description','type','token','token_hash','auth_flow'];
const authHashKeys=['access_token','refresh_token','expires_at','expires_in','provider_token','provider_refresh_token','token_type','type','error','error_code','error_description','auth_flow'];

function readFlow(value:string|null):AuthRedirectFlow{
  if(value==='google'||value==='azure'||value==='magic'||value==='recovery'||value==='confirmation')return value;
  return 'unknown';
}

export function buildAuthRedirectUrl(origin:string,flow:Exclude<AuthRedirectFlow,'unknown'>,path='/'){
  const url=new URL(path,origin);
  url.searchParams.set('auth_flow',flow);
  return url.toString();
}

export function parseAuthRedirectState(href:string):AuthRedirectState{
  const url=new URL(href);
  const hash=new URLSearchParams(url.hash.startsWith('#')?url.hash.slice(1):url.hash);
  const flow=readFlow(url.searchParams.get('auth_flow')??hash.get('auth_flow'));
  const errorCode=url.searchParams.get('error_code')??hash.get('error_code')??url.searchParams.get('error')??hash.get('error');
  const rawError=url.searchParams.get('error_description')??hash.get('error_description');
  if(errorCode||rawError){
    return{status:'error',flow,message:rawError?decodeURIComponent(rawError.replace(/\+/g,' ')):'Не удалось завершить аутентификацию.',errorCode};
  }
  const type=url.searchParams.get('type')??hash.get('type');
  const resolvedFlow=flow!=='unknown'?flow:type==='recovery'?'recovery':type==='signup'?'confirmation':'unknown';
  const hasCredential=url.searchParams.has('code')||hash.has('access_token')||url.searchParams.has('token_hash');
  if(hasCredential||type==='recovery'||type==='signup'){
    return{status:'success',flow:resolvedFlow,message:null,errorCode:null};
  }
  return{status:'none',flow:'unknown',message:null,errorCode:null};
}

export function sanitizeAuthRedirectUrl(href:string){
  const url=new URL(href);
  authQueryKeys.forEach(key=>url.searchParams.delete(key));
  const hash=new URLSearchParams(url.hash.startsWith('#')?url.hash.slice(1):url.hash);
  authHashKeys.forEach(key=>hash.delete(key));
  const remainingHash=hash.toString();
  return `${url.pathname}${url.search}${remainingHash?`#${remainingHash}`:''}`;
}
