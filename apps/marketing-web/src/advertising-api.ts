import {getSupabaseBrowserClient} from '@imds/auth';

export type AdvertisingPlatform='all'|'meta-ads'|'tiktok-ads'|'google-ads';
export type AdvertisingSort='campaignName'|'accountName'|'status'|'impressions'|'clicks'|'spend'|'leads'|'targetLeads'|'arrived'|'sales'|'revenue'|'ctr'|'cpc'|'cpm'|'cpl'|'cpa'|'roas';
export type SortDirection='asc'|'desc';
export interface AdvertisingSummary{impressions:number;clicks:number;spend:number;leads:number;crmLeads:number;targetLeads:number;arrived:number;sales:number;revenue:number;ctr:number;cpc:number;cpm:number;cpl:number;cpa:number;roas:number;clickToLead:number;leadToSale:number}
export interface AdvertisingCampaign{platform:Exclude<AdvertisingPlatform,'all'>;accountId:string;accountName:string;campaignId:string;campaignName:string;status:string;currency:string;impressions:number;clicks:number;spend:number;leads:number;targetLeads:number;arrived:number;sales:number;revenue:number;ctr:number;cpc:number;cpm:number;cpl:number;cpa:number;roas:number}
export interface AdvertisingTrendPoint{date:string;impressions:number;clicks:number;spend:number;leads:number;targetLeads:number;arrived:number;sales:number;revenue:number}
export interface AdvertisingFunnelStage{key:string;label:string;value:number;conversionFromPrevious:number;conversionFromStart:number}
export interface AdvertisingWorkspace{
  range:{dateFrom:string;dateTo:string;previousFrom:string;previousTo:string;days:number};
  effectiveCurrency:string;
  currencySelectionRequired:boolean;
  filters:{platforms:string[];accounts:Array<{id:string;name:string;platform:string}>;statuses:string[];currencies:string[]};
  current:AdvertisingSummary;
  previous:AdvertisingSummary;
  trend:AdvertisingTrendPoint[];
  funnel:AdvertisingFunnelStage[];
  campaigns:{items:AdvertisingCampaign[];page:number;pageSize:number;total:number;pages:number};
}
export interface AdvertisingWorkspaceParams{
  agencyId:string;clientId:string;dateFrom:string;dateTo:string;platform:AdvertisingPlatform;accountId?:string;status?:string;currency?:string;search?:string;sortBy?:AdvertisingSort;sortDir?:SortDirection;page?:number;pageSize?:number;
}

const base=(import.meta.env.VITE_REPORT_API_URL||'http://127.0.0.1:4200').replace(/\/$/,'');
async function accessToken(){const{data,error}=await getSupabaseBrowserClient().auth.getSession();if(error)throw error;const token=data.session?.access_token;if(!token)throw new Error('AUTH_REQUIRED');return token}
async function request<T>(path:string,params:Record<string,string|number|undefined>){
  const url=new URL(`${base}${path}`);for(const[key,value]of Object.entries(params))if(value!==undefined&&value!=='')url.searchParams.set(key,String(value));
  const response=await fetch(url,{headers:{authorization:`Bearer ${await accessToken()}`,accept:'application/json'}});
  if(!response.ok){let message=`HTTP_${response.status}`;try{const body=await response.json() as {message?:string|object;error?:{message?:string}};message=typeof body.message==='string'?body.message:body.error?.message||message}catch{}throw new Error(message)}
  return response.json() as Promise<T>;
}
export const advertisingApi={workspace:(params:AdvertisingWorkspaceParams)=>request<AdvertisingWorkspace>('/v1/advertising/workspace',params)};
