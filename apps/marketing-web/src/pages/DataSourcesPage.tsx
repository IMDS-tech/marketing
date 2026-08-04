import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {connectorCatalog,connectorCategories,type ConnectorCategory,type ConnectorDefinition} from '@imds/integrations';
import {getSupabaseBrowserClient,hasSupabaseEnvironment} from '@imds/auth';
import {useAuth} from '../app/AuthProvider';

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
const iconFor=(category:ConnectorCategory)=>({analytics:'↗',paid_ads:'◎',seo:'⌕',social:'◉',ecommerce:'◆',email:'✉',call_tracking:'☎',local:'⌖',database:'▦'}[category]);

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
    <style>{`.catalog-page{display:flex;flex-direction:column;gap:18px}.catalog-heading{display:flex;justify-content:space-between;align-items:flex-start}.catalog-heading h2{margin:0 0 5px;font-size:24px}.catalog-heading p{margin:0;color:#6b7280}.catalog-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.catalog-stat{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px}.catalog-stat span{display:block;color:#6b7280;font-size:12px}.catalog-stat strong{display:block;font-size:24px;margin-top:7px}.catalog-toolbar{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.catalog-search{min-width:260px;flex:1;border:1px solid #d1d5db;border-radius:7px;padding:10px 12px}.catalog-tabs{display:flex;gap:6px;flex-wrap:wrap}.catalog-tab{border:1px solid #dbe0e6;background:#fff;border-radius:999px;padding:7px 10px;font-size:12px}.catalog-tab.active{background:#eaf3ff;border-color:#0072ee;color:#0064d2}.catalog-check{display:flex;align-items:center;gap:7px;color:#4b5563;font-size:13px}.catalog-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.connector-card{background:#fff;border:1px solid #e5e7eb;border-radius:9px;padding:15px;display:flex;flex-direction:column;gap:12px;min-height:150px}.connector-top{display:flex;align-items:flex-start;justify-content:space-between}.connector-icon{width:38px;height:38px;border-radius:9px;background:#eef5ff;color:#0072ee;display:grid;place-items:center;font-weight:800}.connector-badges{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.connector-badge{font-size:9px;font-weight:700;padding:3px 5px;border-radius:4px;background:#f3f4f6;color:#6b7280}.connector-badge.popular{background:#e8f7ef;color:#15803d}.connector-badge.beta{background:#fff5df;color:#a16207}.connector-badge.new{background:#eaf3ff;color:#0064d2}.connector-card h3{margin:0;font-size:14px}.connector-card p{margin:3px 0 0;color:#6b7280;font-size:11px}.connector-bottom{margin-top:auto;display:flex;justify-content:space-between;align-items:center}.connector-state{font-size:11px;color:#6b7280}.connector-state.connected{color:#15803d}.connector-button{border:1px solid #0072ee;background:#0072ee;color:#fff;border-radius:6px;padding:7px 10px;font-size:12px}.connector-button[disabled]{border-color:#d1d5db;background:#f3f4f6;color:#9ca3af}.catalog-error{padding:10px 12px;border-radius:7px;background:#fef2f2;color:#b91c1c}.catalog-empty{padding:40px;text-align:center;background:#fff;border:1px solid #e5e7eb;border-radius:8px;color:#6b7280}@media(max-width:1300px){.catalog-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}`}</style>
    <section className="catalog-heading"><div><h2>Data Sources</h2><p>Подключайте рекламные, аналитические, SEO и CRM-системы клиентов.</p></div><span className="connector-badge beta">{result.data?.mode==='live'?'LIVE CATALOG':'LOCAL CATALOG'}</span></section>
    <section className="catalog-summary"><div className="catalog-stat"><span>Доступно коннекторов</span><strong>{integrations.length}</strong></div><div className="catalog-stat"><span>Подключено источников</span><strong>{connected}</strong></div><div className="catalog-stat"><span>Phase 2 ready/beta</span><strong>{integrations.filter(item=>item.lifecycle!=='planned').length}</strong></div></section>
    {result.error&&<div className="catalog-error">Не удалось загрузить live-каталог: {result.error instanceof Error?result.error.message:'unknown error'}. Показан локальный каталог.</div>}
    <section className="catalog-toolbar"><input className="catalog-search" placeholder="Поиск интеграции…" value={query} onChange={event=>setQuery(event.target.value)}/><label className="catalog-check"><input type="checkbox" checked={onlyAvailable} onChange={event=>setOnlyAvailable(event.target.checked)}/> Только доступные</label></section>
    <div className="catalog-tabs">{categoryOrder.map(item=><button key={item} className={`catalog-tab ${category===item?'active':''}`} onClick={()=>setCategory(item)}>{categoryLabels[item]}</button>)}</div>
    {visible.length?<section className="catalog-grid">{visible.map(item=>{const integrationId=(item as ConnectorDefinition&{id?:string}).id;const source=integrationId?sourceByIntegration.get(integrationId):undefined;return <article className="connector-card" key={item.slug}><div className="connector-top"><div className="connector-icon">{iconFor(item.category)}</div><div className="connector-badges">{item.isNew&&<span className="connector-badge new">NEW</span>}{item.isPopular&&<span className="connector-badge popular">POPULAR</span>}{(item.isBeta||item.lifecycle==='beta')&&<span className="connector-badge beta">BETA</span>}</div></div><div><h3>{item.name}</h3><p>{connectorCategories[item.category]} · {item.authType.toUpperCase()}</p></div><div className="connector-bottom"><span className={`connector-state ${source?.status==='connected'?'connected':''}`}>{source?`${source.label} · ${source.status}`:item.lifecycle==='planned'?'Planned':'Not connected'}</span><button className="connector-button" disabled={item.lifecycle==='planned'}>{source?'Manage':'Connect'}</button></div></article>})}</section>:<div className="catalog-empty">По выбранным фильтрам интеграции не найдены.</div>}
  </div>;
}
