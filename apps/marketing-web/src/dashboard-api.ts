import {getSupabaseBrowserClient} from '@imds/auth';
import type {DashboardDocument,DashboardListItem,DashboardWorkspace,DashboardStatus} from './pages/dashboard/types';

const configured=import.meta.env.VITE_REPORT_API_URL?.trim();
const base=configured?.replace(/\/$/,'')??'';
async function token(){const{data,error}=await getSupabaseBrowserClient().auth.getSession();if(error)throw error;const value=data.session?.access_token;if(!value)throw new Error('AUTH_REQUIRED');return value}
async function request<T>(path:string,init:RequestInit={}){if(!base)throw new Error('REPORT_API_NOT_CONFIGURED');const response=await fetch(`${base}${path}`,{...init,headers:{authorization:`Bearer ${await token()}`,'content-type':'application/json',...(init.headers??{})}});if(!response.ok){let message=`HTTP_${response.status}`;try{const body=await response.json() as {message?:string};message=body.message||message}catch{}throw new Error(message)}return response.status===204?undefined as T:response.json() as Promise<T>}
const query=(params:Record<string,string|undefined>)=>{const value=new URLSearchParams();for(const[key,item]of Object.entries(params))if(item)value.set(key,item);return value.toString()};
export const dashboardApi={
 list:(agencyId:string,clientId:string,search='',status?:DashboardStatus)=>request<{items:DashboardListItem[]}>(`/v1/dashboards?${query({agencyId,clientId,search,status})}`),
 create:(body:{agencyId:string;clientId:string;name:string;description:string;isDefault:boolean;isSmart:boolean})=>request<DashboardListItem>('/v1/dashboards',{method:'POST',body:JSON.stringify(body)}),
 update:(id:string,body:Record<string,unknown>)=>request<DashboardListItem>(`/v1/dashboards/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
 remove:(id:string,agencyId:string)=>request<{ok:boolean}>(`/v1/dashboards/${id}?${query({agencyId})}`,{method:'DELETE'}),
 duplicate:(id:string,agencyId:string)=>request<DashboardListItem>(`/v1/dashboards/${id}/duplicate`,{method:'POST',body:JSON.stringify({agencyId})}),
 reorder:(body:{agencyId:string;clientId:string;dashboardIds:string[]})=>request<{ok:boolean}>('/v1/dashboards/reorder',{method:'POST',body:JSON.stringify(body)}),
 workspace:(id:string,params:Record<string,string>)=>request<DashboardWorkspace>(`/v1/dashboards/${id}/workspace?${query(params)}`),
 save:(id:string,document:DashboardDocument)=>request<{ok:boolean}>(`/v1/dashboards/${id}/document`,{method:'PUT',body:JSON.stringify(document)}),
};
