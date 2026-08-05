import {useMemo,useState} from 'react';
import {Link,useParams} from '@tanstack/react-router';
import {useAuth} from '../../app/AuthProvider';
import './backend-services.css';

type ServiceId='platform-core-service'|'integration-service'|'report-api'|'notification-worker'|'ai-service'|'search-indexer';
type ServiceConfig={name:string;description:string;port:number;env:keyof ImportMetaEnv;capabilities:string[];endpoints:string[]};

const services:Record<ServiceId,ServiceConfig>={
  'platform-core-service':{name:'Platform Core Service',description:'Tenant, workspace, memberships, permissions, branding, entitlements and audit.',port:4300,env:'VITE_PLATFORM_CORE_SERVICE_URL',capabilities:['Workspace bootstrap','Memberships and permissions','Entitlements and billing usage','Audit events'],endpoints:['GET /health','GET /v1/workspace','GET /v1/permissions','GET /v1/entitlements','GET /v1/audit']},
  'integration-service':{name:'Integration Service',description:'OAuth, encrypted credentials, provider catalog and connection lifecycle.',port:4200,env:'VITE_INTEGRATION_SERVICE_URL',capabilities:['OAuth and manual credentials','Account discovery','Connection lifecycle','Operational health'],endpoints:['GET /health','GET /v1/service/providers','GET /v1/service/status','GET /v1/integrations/workspace','POST /v1/connections/:id/sync']},
  'report-api':{name:'Report API',description:'Tenant-safe metrics, aggregations, dashboards, KPI and roll-ups.',port:4301,env:'VITE_REPORT_API_URL',capabilities:['Raw metrics','Aggregations','Dashboard data','KPI and roll-ups'],endpoints:['GET /health','GET /v1/analytics/metrics','GET /v1/analytics/aggregate','GET /v1/analytics/dashboard/:id','GET /v1/analytics/kpis']},
  'notification-worker':{name:'Notification Worker',description:'Queued delivery for email, in-app, Slack, Telegram and signed webhooks.',port:4303,env:'VITE_NOTIFICATION_WORKER_URL',capabilities:['Idempotent queue','Retry policy','Delivery history','Signed webhooks'],endpoints:['GET /health','POST /internal/v1/notifications','PostgreSQL claim/complete/fail RPC']},
  'ai-service':{name:'AI Service',description:'Entitlement-gated AI, prompt templates, tenant RAG and usage metering.',port:4304,env:'VITE_AI_SERVICE_URL',capabilities:['Prompt templates','Tenant-scoped context','Allowlisted tools','Safety and usage metering'],endpoints:['GET /health','GET /v1/ai/templates','GET /v1/ai/requests','POST /v1/ai/execute']},
  'search-indexer':{name:'Search Indexer',description:'Tenant full-text search, incremental indexing and rebuild operations.',port:4305,env:'VITE_SEARCH_INDEXER_URL',capabilities:['Tenant-scoped search','Incremental jobs','Entity rebuilds','Client access checks'],endpoints:['GET /health','GET /v1/search','POST /internal/v1/index','POST /internal/v1/rebuild']},
};
const serviceIds=Object.keys(services) as ServiceId[];

export function BackendServicesPage(){
  const{serviceId}=useParams({strict:false}) as {serviceId?:ServiceId};
  const activeId=serviceId&&services[serviceId]?serviceId:'platform-core-service';
  const active=services[activeId];
  const{session}=useAuth();
  const[checking,setChecking]=useState(false);
  const[result,setResult]=useState<{ok:boolean;message:string}|null>(null);
  const baseUrl=useMemo(()=>String(import.meta.env[active.env]||`http://localhost:${active.port}`).replace(/\/$/,''),[active]);
  const configured=Boolean(import.meta.env[active.env]);
  const checkHealth=async()=>{setChecking(true);setResult(null);try{const response=await fetch(`${baseUrl}/health`,{headers:session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{}});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.message||`HTTP ${response.status}`);setResult({ok:true,message:`${payload?.service||active.name}: healthy`})}catch(error){setResult({ok:false,message:error instanceof Error?error.message:'Service unavailable'})}finally{setChecking(false)}};
  return <div className="backend-console">
    <header className="backend-console__hero"><div><span className="crumb">Backend Services</span><h1>{active.name}</h1><p>{active.description}</p></div><div className="backend-console__hero-actions"><span className={`backend-badge ${configured?'backend-badge--ready':'backend-badge--local'}`}>{configured?'Configured':'Local default'}</span><button type="button" onClick={checkHealth} disabled={checking}>{checking?'Checking…':'Check health'}</button></div></header>
    <nav className="backend-console__tabs" aria-label="Backend services">{serviceIds.map(id=><Link key={id} to="/backend/$serviceId" params={{serviceId:id}} activeProps={{className:'active'}}>{services[id].name}</Link>)}</nav>
    {result&&<div className={`backend-health backend-health--${result.ok?'ok':'error'}`}><strong>{result.ok?'Healthy':'Unavailable'}</strong><span>{result.message}</span></div>}
    <section className="backend-console__grid">
      <article className="backend-panel"><h2>Runtime</h2><dl><dt>Base URL</dt><dd><code>{baseUrl}</code></dd><dt>Default port</dt><dd>{active.port}</dd><dt>Environment</dt><dd><code>{active.env}</code></dd><dt>Authentication</dt><dd>{activeId==='notification-worker'||activeId==='search-indexer'?'Internal service token for writes':'Supabase JWT / JWKS'}</dd></dl></article>
      <article className="backend-panel"><h2>Capabilities</h2><div className="backend-list">{active.capabilities.map(item=><div key={item}><span>✓</span>{item}</div>)}</div></article>
      <article className="backend-panel backend-panel--wide"><h2>Operational endpoints</h2><div className="backend-endpoints">{active.endpoints.map(endpoint=><code key={endpoint}>{endpoint}</code>)}</div></article>
      <article className="backend-panel backend-panel--wide"><h2>Service status</h2><p>Backend implementation is connected to the module catalog. This screen replaces the architectural placeholder and exposes the real runtime configuration and health probe for the selected service.</p><div className="backend-actions"><Link to="/platform/modules">Back to module catalog</Link><button type="button" onClick={checkHealth} disabled={checking}>Refresh status</button></div></article>
    </section>
  </div>;
}
