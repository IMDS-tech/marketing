import type{Session}from'@supabase/supabase-js';
export interface AgencyProfile{id:string;name:string;legal_name:string|null;contact_email:string|null;phone:string|null;website:string|null;country:string|null;language:string;timezone:string;currency:string;address:Record<string,unknown>;registration_number:string|null;tax_id:string|null;working_hours:Record<string,unknown>;agency_markup:number;default_settings:Record<string,unknown>;branding:Record<string,unknown>}
export interface AgencyMember{user_id:string;name:string|null;email:string|null;role:'admin'|'staff'|'client';status:'invited'|'active'|'suspended';permissions:string[]}
export interface AgencyTeam{id:string;agency_id:string;name:string;description:string;color:string;member_ids:string[];client_ids:string[]}
export interface BillingWorkspace{subscription:any;usage:{clients:number;users:number;integrations:number};invoices:any[];plans:any[]}
export interface OnboardingProgress{agency_id:string;steps:Record<string,boolean>;current_step:string;completed_at:string|null}
const base=()=>import.meta.env.VITE_PLATFORM_CORE_URL?.replace(/\/$/,'');
async function request<T>(path:string,session:Session|null,init?:RequestInit){if(!base()||!session)throw new Error('PLATFORM_CORE_NOT_CONFIGURED');const r=await fetch(`${base()}${path}`,{...init,headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`,...init?.headers}});if(!r.ok)throw new Error(await r.text()||`PLATFORM_CORE_${r.status}`);return r.json() as Promise<T>}
export const getAgency=(agencyId:string,s:Session|null)=>request<AgencyProfile>(`/v1/platform/agency?agencyId=${agencyId}`,s);
export const saveAgency=(input:any,s:Session|null)=>request<AgencyProfile>('/v1/platform/agency',s,{method:'PATCH',body:JSON.stringify(input)});
export const listMembers=(agencyId:string,s:Session|null)=>request<{items:AgencyMember[]}>(`/v1/platform/memberships?agencyId=${agencyId}`,s).then(r=>r.items);
export const inviteMember=(input:any,s:Session|null)=>request('/v1/platform/memberships/invite',s,{method:'POST',body:JSON.stringify(input)});
export const updateMember=(userId:string,input:any,s:Session|null)=>request(`/v1/platform/memberships/${userId}`,s,{method:'PATCH',body:JSON.stringify(input)});
export const listTeams=(agencyId:string,s:Session|null)=>request<{items:AgencyTeam[]}>(`/v1/platform/teams?agencyId=${agencyId}`,s).then(r=>r.items);
export const saveTeam=(id:string|null,input:any,s:Session|null)=>request(id?`/v1/platform/teams/${id}`:'/v1/platform/teams',s,{method:id?'PATCH':'POST',body:JSON.stringify(input)});
export const deleteTeam=(id:string,agencyId:string,s:Session|null)=>request(`/v1/platform/teams/${id}?agencyId=${agencyId}`,s,{method:'DELETE'});
export const getBilling=(agencyId:string,s:Session|null)=>request<BillingWorkspace>(`/v1/platform/billing?agencyId=${agencyId}`,s);
export const changeSubscription=(input:any,s:Session|null)=>request('/v1/platform/billing/subscription',s,{method:'PATCH',body:JSON.stringify(input)});
export const cancelSubscription=(agencyId:string,s:Session|null)=>request('/v1/platform/billing/cancel',s,{method:'POST',body:JSON.stringify({agencyId})});
export const getOnboarding=(agencyId:string,s:Session|null)=>request<OnboardingProgress>(`/v1/platform/onboarding?agencyId=${agencyId}`,s);
export const setOnboardingStep=(input:any,s:Session|null)=>request<OnboardingProgress>('/v1/platform/onboarding',s,{method:'PATCH',body:JSON.stringify(input)});
