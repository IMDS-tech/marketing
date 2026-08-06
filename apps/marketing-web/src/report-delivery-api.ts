import type{Session}from'@supabase/supabase-js';
export type DeliveryChannel='email'|'in_app'|'slack'|'telegram'|'webhook';
export type ReportRecipient={id:string;channel:DeliveryChannel;address:string;name:string;enabled:boolean};
export type ReportSchedule={enabled:boolean;frequency:'once'|'daily'|'weekly'|'monthly';timezone:string;nextRunAt:string|null;weekday?:number;monthday?:number};
export type ReportDelivery={reportId:string;status:string;schedule:ReportSchedule;recipients:ReportRecipient[];subject:string;message:string;includeLink:boolean;lastGeneratedAt:string|null};
export type ReportDeliveryHistory={id:string;channel:DeliveryChannel;recipient:string;state:'queued'|'running'|'succeeded'|'failed'|'cancelled';attempts:number;maxAttempts:number;runAfter:string;lastError:unknown;createdAt:string;updatedAt:string;finishedAt:string|null;providerMessageId:string|null;deliveryStatus:string|null};
const base=()=>import.meta.env.VITE_REPORT_API_URL?.replace(/\/$/,'');async function request<T>(path:string,session:Session|null,init?:RequestInit){const url=base();if(!url||!session)throw new Error('REPORT_API_NOT_CONFIGURED');const response=await fetch(`${url}${path}`,{...init,headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`,...init?.headers}});if(!response.ok)throw new Error(await response.text()||`REPORT_API_${response.status}`);return response.json()as Promise<T>}
export const reportDeliveryApi={
 get:(reportId:string,agencyId:string,session:Session|null)=>request<ReportDelivery>(`/v1/reports/${reportId}/delivery?agencyId=${encodeURIComponent(agencyId)}`,session),
 save:(delivery:ReportDelivery,agencyId:string,session:Session|null)=>request<ReportDelivery>(`/v1/reports/${delivery.reportId}/delivery`,session,{method:'PUT',body:JSON.stringify({agencyId,schedule:delivery.schedule,recipients:delivery.recipients,subject:delivery.subject,message:delivery.message,includeLink:delivery.includeLink})}),
 send:(reportId:string,agencyId:string,session:Session|null)=>request<{queued:number}>(`/v1/reports/${reportId}/delivery/send`,session,{method:'POST',body:JSON.stringify({agencyId})}),
 history:(reportId:string,agencyId:string,session:Session|null)=>request<{items:ReportDeliveryHistory[]}>(`/v1/reports/${reportId}/delivery/history?agencyId=${encodeURIComponent(agencyId)}`,session).then(result=>result.items),
};
