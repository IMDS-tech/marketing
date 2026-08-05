import {useEffect,useMemo,type CSSProperties,type ReactNode} from 'react';
import {Link,useRouterState} from '@tanstack/react-router';
import {recordWorkspaceRecentItem,updateWorkspacePreferences} from '@imds/auth';
import {useI18n,type Language} from '../i18n/I18nProvider';
import {getUserNavigationDomains} from '../modules/navigation';
import {BrandGlyph} from './BrandGlyph';
import {useAuth} from './AuthProvider';

const languageLabels:Record<Language,string>={en:'EN',ru:'RU',kk:'ҚАЗ'};
const supportedLanguages:Language[]=['en','ru','kk'];

export function AppShell({children}:{children:ReactNode}){
  const pathname=useRouterState({select:state=>state.location.pathname});
  const{workspace,switchAgency,switchClient,signOut,refresh}=useAuth();
  const{language,setLanguage,t}=useI18n();
  const user=workspace?.currentUser;
  const agency=workspace?.activeAgency;
  const activeClientId=workspace?.activeClientId??workspace?.clients[0]?.id??null;
  const navigationDomains=useMemo(()=>getUserNavigationDomains(activeClientId),[activeClientId]);
  const activeModule=useMemo(()=>navigationDomains.flatMap(domain=>domain.modules).find(item=>pathname===item.href)?.module??null,[navigationDomains,pathname]);
  const initials=user?.name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase()||user?.email.slice(0,2).toUpperCase()||'';
  const role=agency?t(`roles.${String(agency.role).toLowerCase()}`):'';

  useEffect(()=>{const next=workspace?.preferences.language;if(next&&supportedLanguages.includes(next as Language)&&next!==language)setLanguage(next as Language)},[workspace?.preferences.language,language,setLanguage]);
  useEffect(()=>{const preference=workspace?.preferences.theme??'system';const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{const resolved=preference==='system'?(media.matches?'dark':'light'):preference;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved};apply();if(preference!=='system')return;media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)},[workspace?.preferences.theme]);
  useEffect(()=>{if(!agency||!activeModule)return;void recordWorkspaceRecentItem({agencyId:agency.id,clientId:workspace?.activeClientId??null,itemType:'module',itemId:activeModule.id,title:activeModule.name,route:pathname}).catch(()=>undefined)},[agency?.id,workspace?.activeClientId,activeModule?.id,pathname]);

  async function changeLanguage(next:Language){setLanguage(next);try{await updateWorkspacePreferences({language:next});await refresh()}catch{}}

  return <div className="app-shell" style={{'--brand-color':agency?.branding.primaryColor||'#2962ff'} as CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><BrandGlyph/><div><strong>IMDS</strong><span>Signal Workspace</span></div></div>
      {workspace&&<><select className="tenant-switcher" value={agency?.id||''} onChange={event=>void switchAgency(event.target.value)}>{workspace.agencies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="tenant-switcher client-context-switcher" value={workspace.activeClientId??''} onChange={event=>void switchClient(event.target.value||null)}><option value="">Уровень агентства</option>{workspace.clients.map(item=><option key={item.id} value={item.id}>{item.company}</option>)}</select></>}
      <nav className="module-tree" aria-label="Основная навигация">
        {navigationDomains.map((domain,index)=><details className="module-domain" key={domain.id} open={index<6}>
          <summary><span>{domain.name}</span><small>{domain.modules.length}</small></summary>
          <div className="module-domain__items">{domain.modules.map(({module,href})=><Link key={module.id} to={href as never} className={`nav-link ${pathname===href?'is-active':''}`} title={module.description}><span className="nav-signal"/><span className="nav-link__label">{module.name}</span></Link>)}</div>
        </details>)}
      </nav>
      <div className="sidebar-bottom">
        <Link to="/platform/workspace" className="architecture-link">Настройки Workspace</Link>
        <Link to="/platform/modules" className="architecture-link">Архитектура и статусы</Link>
        {user&&<div className="account-card"><div className="avatar">{initials}</div><div><strong>{user.name||user.email}</strong><span>{role}</span></div><button onClick={()=>void signOut('local')} title={t('common.logout')}>↗</button></div>}
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="workspace-heading"><span className="crumb"><i/>{agency?.name||t('common.workspace')}</span><h1>{t('common.marketingPlatform')}</h1></div>
        <div className="top-actions">
          <label className="language-select" title={t('language.select')}><span>LANG</span><select aria-label={t('language.select')} value={language} onChange={event=>void changeLanguage(event.target.value as Language)}>{(Object.keys(languageLabels) as Language[]).map(code=><option key={code} value={code}>{languageLabels[code]}</option>)}</select></label>
          <button className="primary" onClick={()=>window.location.assign('/clients/new')}>+ {t('common.addClient')}</button>
        </div>
      </header>
      <div className="page">{children}</div>
    </main>
  </div>
}
