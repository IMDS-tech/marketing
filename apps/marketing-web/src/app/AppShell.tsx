import type {ReactNode} from 'react';
import {Link,useRouterState} from '@tanstack/react-router';
import {useI18n,type Language} from '../i18n/I18nProvider';
import {BrandGlyph} from './BrandGlyph';
import {useAuth} from './AuthProvider';

const languageLabels:Record<Language,string>={en:'EN',ru:'RU',kk:'ҚАЗ'};

export function AppShell({children}:{children:ReactNode}){
  const pathname=useRouterState({select:state=>state.location.pathname});
  const{workspace,switchAgency,signOut,configured}=useAuth();
  const{language,setLanguage,t}=useI18n();
  const user=workspace?.currentUser;
  const agency=workspace?.activeAgency;
  const activeClientId=workspace?.clients[0]?.id||'amanat-med';
  const initials=(user?.name||'IM').split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
  const roleKey=String(agency?.role||'demo').toLowerCase();
  const role=t(`roles.${roleKey}`);
  const sections=[
    {label:t('nav.clients'),to:'/'},{group:t('nav.paidAds')},
    {label:t('nav.metaAds'),to:`/client/${activeClientId}/meta-ads/campaigns`},{label:t('nav.tiktokAds'),to:`/client/${activeClientId}/tiktok-ads/campaigns`},
    {group:t('nav.analysis')},{label:t('nav.reports'),to:'/reports'},{label:t('nav.rollups'),to:'/rollups'},
    {group:t('nav.projectManagement')},{label:t('nav.kpis'),to:'/kpis'},
    {group:t('nav.management')},{label:t('nav.data'),to:'/data'},{label:t('nav.templates'),to:'/templates'},{label:t('nav.exports'),to:'/exports'},
  ] as const;

  return <div className="app-shell" style={{'--brand-color':agency?.branding.primaryColor||'#2962ff'} as React.CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><BrandGlyph/><div><strong>IMDS</strong><span>Signal Workspace</span></div></div>
      {workspace&&<select className="tenant-switcher" value={agency?.id||''} onChange={event=>void switchAgency(event.target.value)}>{workspace.agencies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>}
      <button className="global-search"><span className="search-pulse"/><span>{t('common.searchEverything')}</span><kbd>⌘K</kbd></button>
      <nav>{sections.map((item,index)=>'group' in item?<div className="nav-group" key={`${item.group}-${index}`}>{item.group}</div>:<Link key={item.to} to={item.to as never} className={`nav-link ${pathname===item.to?'is-active':''}`}><span className="nav-signal"/>{item.label}</Link>)}</nav>
      <div className="sidebar-bottom">
        <div className="setup-card"><div><span>{t('account.setup')}</span><strong>40%</strong></div><div className="progress"><span/></div><small>{t('account.stepsCompleted',{completed:2,total:5})}</small></div>
        <div className="account-card"><div className="avatar">{initials}</div><div><strong>{user?.name||t('account.demoUser')}</strong><span>{role}</span></div>{configured?<button onClick={()=>void signOut()} title={t('common.logout')}>↗</button>:<button title={t('common.demoMode')}>•••</button>}</div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="workspace-heading"><span className="crumb"><i/>{agency?.name||t('common.workspace')}</span><h1>{t('common.marketingPlatform')}</h1></div>
        <div className="top-actions">
          <label className="language-select" title={t('language.select')}><span>LANG</span><select aria-label={t('language.select')} value={language} onChange={event=>setLanguage(event.target.value as Language)}>{(Object.keys(languageLabels) as Language[]).map(code=><option key={code} value={code}>{languageLabels[code]}</option>)}</select></label>
          <button className="signal-action">✦ AgencyAI</button>
          <button className="quiet-action">{t('common.inbox')}</button>
          <button className="primary">+ {t('common.addClient')}</button>
        </div>
      </header>
      <div className="page">{children}</div>
    </main>
  </div>
}
