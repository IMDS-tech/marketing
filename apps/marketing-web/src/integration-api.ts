import {getSupabaseBrowserClient} from '@imds/auth';
const base=(import.meta.env.VITE_INTEGRATION_SERVICE_URL||'').replace(/\/+$/,'');
async function request<T>(path:string,options:RequestInit={}):Promise<T>{if(!base)throw new Error('Integration Service URL is not configured');const{data}=await getSupabaseBrowserClient().auth.getSession();const token=data.session?.access_token;if(!token)throw new Error('Authentication required');const response=await fetch(`${base}${path}`,{...options,headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...options.headers}});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.message||`Integration Service HTTP ${response.status}`);return payload as T}
export type OAuthAccount={id:string;name?:string;currency?:string;timezone?:string};
export type ManualConnectionPayload={agencyId:string;clientId:string;integrationId:string;externalIdentifier:string;label:string;credentials:Record<string,unknown>};
export const integrationApi={
start:(provider:string,body:{agencyId:string;clientId:string;returnOrigin:string})=>request<{authorizationUrl:string;stateId:string}>(`/v1/oauth/${provider}/start`,{method:'POST',body:JSON.stringify(body)}),
accounts:(handle:string)=>request<OAuthAccount[]>(`/v1/oauth/connections/${handle}/accounts`),
attach:(body:{handle:string;agencyId:string;clientId:string;integrationId:string;externalIdentifier:string;label:string})=>request<{dataSourceId:string}>('/v1/oauth/connections/attach',{method:'POST',body:JSON.stringify(body)}),
manualAttach:(body:ManualConnectionPayload)=>request<{dataSourceId:string;accountId:string;handle:string}>('/v1/connections/manual',{method:'POST',body:JSON.stringify(body)}),
sync:(dataSourceId:string,body:{periodFrom?:string;periodTo?:string}={})=>request<{id:string;state:string}>(`/v1/connections/${dataSourceId}/sync`,{method:'POST',body:JSON.stringify(body)}),
setStatus:(dataSourceId:string,action:'pause'|'resume'|'disconnect')=>request<{status:string}>(`/v1/connections/${dataSourceId}/status`,{method:'POST',body:JSON.stringify({action})}),
remove:(dataSourceId:string)=>request<{deleted:boolean}>(`/v1/connections/${dataSourceId}`,{method:'DELETE'}),
revokeAccount:(accountId:string)=>request<{revoked:boolean}>(`/v1/connections/accounts/${accountId}/revoke`,{method:'POST',body:'{}'}),
};
