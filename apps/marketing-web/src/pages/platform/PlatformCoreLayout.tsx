import {useEffect,useState,type ReactNode} from 'react';

export type PlatformCoreTab={id:string;label:string;description?:string};

interface PlatformCoreLayoutProps{
  title:string;
  description:string;
  status?:'in_progress'|'complete'|'error';
  tabs:PlatformCoreTab[];
  defaultTab:string;
  actions?:ReactNode;
  notice?:ReactNode;
  children:(activeTab:string)=>ReactNode;
}

function readTab(tabs:PlatformCoreTab[],fallback:string){
  if(typeof window==='undefined')return fallback;
  const value=new URLSearchParams(window.location.search).get('tab');
  return tabs.some(tab=>tab.id===value)?value!:fallback;
}

export function PlatformCoreLayout({title,description,status='in_progress',tabs,defaultTab,actions,notice,children}:PlatformCoreLayoutProps){
  const[activeTab,setActiveTab]=useState(()=>readTab(tabs,defaultTab));
  useEffect(()=>{const onPop=()=>setActiveTab(readTab(tabs,defaultTab));window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[tabs,defaultTab]);
  function selectTab(tabId:string){
    setActiveTab(tabId);
    const url=new URL(window.location.href);
    if(tabId===defaultTab)url.searchParams.delete('tab');else url.searchParams.set('tab',tabId);
    window.history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
  }
  const statusLabel=status==='complete'?'Готово':status==='error'?'Ошибка':'В работе';
  return <div className="pc-page">
    <header className="pc-hero">
      <div className="pc-hero__copy"><span>Platform Core</span><h1>{title}</h1><p>{description}</p></div>
      <div className="pc-hero__side"><span className={`pc-status pc-status--${status}`}>{statusLabel}</span>{actions&&<div className="pc-hero__actions">{actions}</div>}</div>
    </header>
    {notice}
    <nav className="pc-tabs" aria-label={`${title} sections`}>
      {tabs.map(tab=><button key={tab.id} type="button" className={activeTab===tab.id?'is-active':''} aria-current={activeTab===tab.id?'page':undefined} onClick={()=>selectTab(tab.id)}><strong>{tab.label}</strong>{tab.description&&<span>{tab.description}</span>}</button>)}
    </nav>
    <main className="pc-content">{children(activeTab)}</main>
  </div>;
}

export function PlatformEmptyState({title,description,action}:{title:string;description:string;action?:ReactNode}){
  return <div className="pc-empty"><div className="pc-empty__mark">◇</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function PlatformLoadingState({label='Загрузка данных…'}:{label?:string}){
  return <div className="pc-loading" aria-live="polite"><span/><span/><span/><p>{label}</p></div>;
}
