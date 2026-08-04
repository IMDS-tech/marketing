export type AgencyRole='admin'|'staff'|'client';
export interface WorkspaceAgency{id:string;name:string;slug:string;role:AgencyRole;permissions:string[];branding:{primaryColor:string;logoUrl:string|null}}
export interface WorkspaceClient{id:string;company:string;url:string|null;status:'active'|'paused'|'archived';createdAt:string;logoUrl:string|null;brandColor:string;connectedSources:number}
export interface WorkspaceBootstrap{currentUser:{id:string;email:string;name:string;avatarUrl:string|null};agencies:WorkspaceAgency[];activeAgency:WorkspaceAgency|null;clients:WorkspaceClient[];mode:'supabase'|'demo'}
const agency:WorkspaceAgency={id:'demo-agency',name:'IMDS Agency',slug:'imds',role:'admin',permissions:['*'],branding:{primaryColor:'#0072EE',logoUrl:null}};
const demo:WorkspaceBootstrap={currentUser:{id:'demo-user',email:'admin@imds.tech',name:'Имомали Худайкулов',avatarUrl:null},agencies:[agency],activeAgency:agency,clients:[{id:'amanat-med',company:'Amanat Med',url:'amanatmed.kz',status:'active',createdAt:'2026-08-01',logoUrl:null,brandColor:'#0072EE',connectedSources:2},{id:'demo-clinic',company:'Demo Clinic',url:'demo-clinic.kz',status:'paused',createdAt:'2026-08-03',logoUrl:null,brandColor:'#7C3AED',connectedSources:0}],mode:'demo'};
export function getDemoBootstrap():WorkspaceBootstrap{return structuredClone(demo)}
