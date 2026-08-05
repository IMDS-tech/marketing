import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {connectorCatalog,connectorCategories,type ConnectorCategory,type ConnectorDefinition} from '@imds/integrations';
import {getSupabaseBrowserClient,hasSupabaseEnvironment} from '@imds/auth';
import {useAuth} from '../app/AuthProvider';
import {IntegrationBrandMark,integrationBrandStyle} from './integrations/IntegrationBrandMark';

type DataSourceRow={id:string;integration_id:string;label:string;status:string;last_sync_at:string|null;client_id:string};
type IntegrationRow={id:string;slug:string;name:string;category:ConnectorCategory;auth_type:ConnectorDefinition['authType'];lifecycle:ConnectorDefinition['lifecycle'];is_beta:boolean;is_new:boolean;is_popular:boolean};

async function loadCatalog(){
  if(!hasSupabaseEnvironment()) return {integrations:connectorCatalog,sources:[] as DataSourceRow[],mode:'catalog'};
  const client=getSupabaseBrowserClient();
  const [{data:integrations,error:integrationError},{data:sources,error:sourceError}]=await Promise.all([
    client.from('integrations').select('id,slug,name,category,auth_type,lifecycle,is_beta,is_new,is_popular').order('sort_order'),
    client.from('data_sources').select('id,integration_id,label,status,last_sync_at,client_id').order('created_at',{ascending:false}),
  ]);
  if(integrationError) throw integrationError;
  if(sourceError) throw sourceError;
  return {
    integrations:(integrations as IntegrationRow[]).map(item=>({slug:item.slug,name:item.name,category:item.category,authType:item.auth_type,lifecycle:item.lifecycle,scopes:[],isBeta:item.is_beta,isNew:item.is_new,isPopular:item.is_popular,id:item.id})),
    sources:(sources??[]) as DataSourceRow[],
    mode:'live',
  };
}

const categoryOrder:('all'|ConnectorCategory)[]=['all','analytics','paid_ads','seo','social','ecommerce','email','call_tracking','local','database'];
const categoryLabels:{[key:string]:string}={all:'Все',...connectorCategories};

export function DataSourcesPage(){
  const{workspace}=useAuth();
  const[query,setQuery]=useState('');
  const[category,setCategory]=useState<'all'|ConnectorCategory>('all');
  const[onlyAvailable,setOnlyAvailable]=useState(false);
  const result=useQuery({queryKey:['integration-catalog',workspace?.activeAgency?.id],queryFn:loadCatalog,staleTime:120000});
  const integrations=result.data?.integrations??connectorCatalog;
  const sources=result.data?.sources??[];
  const sourceByIntegration=new Map(sources.map(source=>[source.integration_id,source]));
  const visible=useMemo(()=>integrations.filter(item=>{
    const matchesCategory=category==='all'||item.category===category;
    const matchesQuery=`${item.name} ${item.slug}`.toLowerCase().includes(query.toLowerCase());
    const matchesAvailable=!onlyAvailable||item.lifecycle!=='planned';
    return matchesCategory&&matchesQuery&&matchesAvailable;
  }),[integrations,category,query,onlyAvailable]);
  const connected=sources.filter(item=>item.status==='connected').length;
  return <div className="catalog-page">
    <style>{`.catalog-page{display:flex;flex-direction:column;gap:18px}.catalog-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.catalog-heading h2{margin:0 0 5px;font-size:24px}.catalog-heading p{margin:0;color:var(--muted,#6b7280)}.catalog-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.catalog-stat{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:16px;box-shadow:0 8px 22px rgba(15,23,42,.04)}.catalog-stat span{display:block;color:var(--muted,#6b7280);font-size:12px}.catalog-stat strong{display:block;font-size:24px;margin-top:7px}.catalog-toolbar{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.catalog-search{min-width:260px;flex:1;border:1px solid var(--border-strong,#d1d5db);background:var(--surface,#fff);color:inherit;border-radius:9px;padding:10px 12px}.catalog-tabs{display:flex;gap:6px;flex-wrap:wrap}.catalog-tab{border:1px solid var(--border,#dbe0e6);background:var(--surface,#fff);color:inherit;border-radius:999px;padding:7px 10px;font-size:12px;cursor:pointer}.catalog-tab.active{background:#eaf3ff;border-color:#0072ee;color:#0064d2}.catalog-check{display:flex;align-items:center;gap:7px;color:var(--muted,#4b5563);font-size:13px}.catalog-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.connector-card{position:relative;isolation:isolate;overflow:hidden;background:var(--connector-surface);border:1px solid var(--connector-border);color:var(--connector-foreground);border-radius:15px;padding:16px;display:flex;flex-direction:column;gap:13px;min-height:172px;box-shadow:var(--connector-shadow);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.connector-card::after{content:'';position:absolute;z-index:-1;width:150px;height:150px;border-radius:50%;right:-72px;top:-80px;background:var(--connector-accent);opacity:.12;filter:blur(2px)}.connector-card:hover{transform:translateY(-3px);border-color:var(--connector-accent);box-shadow:0 18px 38px rgba(15,23,42,.13)}.connector-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.connector-brand-mark{width:48px;height:48px;border-radius:13px;background:var(--connector-logo-surface);color:var(--connector-logo-foreground);display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--connector-accent) 20%,transparent);box-shadow:0 7px 18px rgba(15,23,42,.09);flex:0 0 auto}.connector-brand-mark svg{width:34px;height:34px}.connector-brand-fallback{font-size:14px;font-weight:850;letter-spacing:-.02em}.connector-badges{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.connector-badge{font-size:9px;font-weight:800;padding:4px 6px;border-radius:999px;background:rgba(148,163,184,.16);color:inherit}.connector-badge.popular{background:#e8f7ef;color:#15803d}.connector-badge.beta{background:#fff5df;color:#a16207}.connector-badge.new{background:#eaf3ff;color:#0064d2}.connector-card h3{margin:0;font-size:15px;line-height:1.25}.connector-card p{margin:4px 0 0;color:color-mix(in srgb,currentColor 65%,transparent);font-size:11px}.connector-bottom{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:10px}.connector-state{font-size:11px;color:color-mix(in srgb,currentColor 68%,transparent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.connector-state.connected{color:#15803d;font-weight:700}.connector-button{border:1px solid var(--connector-accent);background:var(--connector-accent);color:#fff;border-radius:8px;padding:8px 11px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 5px 12px color-mix(in srgb,var(--connector-accent) 24%,transparent)}.connector-button[disabled]{border-color:rgba(148,163,184,.35);background:rgba(148,163,184,.16);color:color-mix(in srgb,currentColor 48%,transparent);box-shadow:none;cursor:not-allowed}.catalog-error{padding:10px 12px;border-radius:9px;background:#fef2f2;color:#b91c1c}.catalog-empty{padding:40px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;color:var(--muted,#6b7280)}[data-theme='dark'] .catalog-tab.active{background:#132b4f;color:#8bbcff}[data-theme='dark'] .connector-badge.popular{background:rgba(22,163,74,.18);color:#86efac}[data-theme='dark'] .connector-badge.beta{background:rgba(217,119,6,.18);color:#fcd34d}[data-theme='dark'] .connector-badge.new{background:rgba(37,99,235,.2);color:#93c5fd}@media(max-width:1300px){.catalog-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:980px){.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.catalog-summary{grid-template-columns:1fr}}@media(max-width:620px){.catalog-heading{flex-direction:column}.catalog-grid{grid-template-columns:1fr}.catalog-search{min-width:100%}.connector-card{min-height:158px}}`}</style>
    <section className="catalog-heading"><div><h2>Data Sources</h2><p>Подключайте рекламные, аналитические, SEO и CRM-системы клиентов.</p></div><span className="connector-badge beta">{result.data?.mode==='live'?'LIVE CATALOG':'LOCAL CATALOG'}</span></section>
    <section className="catalog-summary"><div className="catalog-stat"><span>Доступно коннекторов</span><strong>{integrations.length}</strong></div><div className="catalog-stat"><span>Подключено источников</span><strong>{connected}</strong></div><div className="catalog-stat"><span>Phase 2 ready/beta</span><strong>{integrations.filter(item=>item.lifecycle!=='planned').length}</strong></div></section>
    {result.error&&<div className="catalog-error">Не удалось загрузить live-каталог: {result.error instanceof Error?result.error.message:'unknown error'}. Показан локальный каталог.</div>}
    <section className="catalog-toolbar"><input className="catalog-search" placeholder="Поиск интеграции…" value={query} onChange={event=>setQuery(event.target.value)}/><label className="catalog-check"><input type="checkbox" checked={onlyAvailable} onChange={event=>setOnlyAvailable(event.target.checked)}/> Только доступные</label></section>
    <div className="catalog-tabs">{categoryOrder.map(item=><button key={item} className={`catalog-tab ${category===item?'active':''}`} onClick={()=>setCategory(item)}>{categoryLabels[item]}</button>)}</div>
    {visible.length?<section className="catalog-grid">{visible.map(item=>{const integrationId=(item as ConnectorDefinition&{id?:string}).id;const source=integrationId?sourceByIntegration.get(integrationId):undefined;return <article className="connector-card" style={integrationBrandStyle(item.slug,item.category)} key={item.slug}><div className="connector-top"><IntegrationBrandMark slug={item.slug} name={item.name} category={item.category}/><div className="connector-badges">{item.isNew&&<span className="connector-badge new">NEW</span>}{item.isPopular&&<span className="connector-badge popular">POPULAR</span>}{(item.isBeta||item.lifecycle==='beta')&&<span className="connector-badge beta">BETA</span>}</div></div><div><h3>{item.name}</h3><p>{connectorCategories[item.category]} · {item.authType.toUpperCase()}</p></div><div className="connector-bottom"><span className={`connector-state ${source?.status==='connected'?'connected':''}`}>{source?`${source.label} · ${source.status}`:item.lifecycle==='planned'?'Planned':'Not connected'}</span><button className="connector-button" disabled={item.lifecycle==='planned'}>{source?'Manage':'Connect'}</button></div></article>})}</section>:<div className="catalog-empty">По выбранным фильтрам интеграции не найдены.</div>}
  </div>;
}
