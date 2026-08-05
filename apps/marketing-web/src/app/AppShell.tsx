import type {ReactNode} from 'react';
import {Link,useRouterState} from '@tanstack/react-router';
import {useI18n,type Language} from '../i18n/I18nProvider';
import {moduleDomains} from '../modules/catalog';
import {getModuleHref,isImplementedModule} from '../modules/navigation';
import {getModuleDeliveryStatus,moduleDeliveryLabels} from '../modules/progress';
import {BrandGlyph} from './BrandGlyph';
import {useAuth} from './AuthProvider';

const languageLabels:Record<Language,string>={en:'EN',ru:'RU',kk:'ҚАЗ'};
const hiddenSidebarModuleIds=new Set(['multi-tenancy']);
const sidebarDomains=moduleDomains
  .map(domain=>({...domain,modules:domain.modules.filter(module=>!hiddenSidebarModuleIds.has(module.id))}))
  .filter(domain=>domain.modules.length>0);

export function AppShell({children}:{children:ReactNode}){
  const pathname=useRouterState({select:state=>state.location.pathname});
  const{workspace,switchAgency,switchClient,signOut,configured}=useAuth();
  const{language,setLanguage,t}=useI18n();
  const user=workspace?.currentUser;
  const agency=workspace?.activeAgency;
  const activeClientId=workspace?.activeClientId||workspace?.clients[0]?.id||'amanat-med';
  const initials=(user?.name||'IM').split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
  const roleKey=String(agency?.role||'demo').toLowerCase();
  const role=t(`roles.${roleKey}`);

  return <div className="app-shell" style={{'--brand-color':agency?.branding.primaryColor||'#2962ff'} as React.CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><BrandGlyph/><div><strong>IMDS</strong><span>Signal Workspace</span></div></div>
      {workspace&&<><select className="tenant-switcher" value={agency?.id||''} onChange={event=>void switchAgency(event.target.value)}>{workspace.agencies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="tenant-switcher client-context-switcher" value={workspace.activeClientId??''} onChange={event=>void switchClient(event.target.value||null)}><option value="">Уровень агентства</option>{workspace.clients.map(item=><option key={item.id} value={item.id}>{item.company}</option>)}</select></>}
      <button className="global-search"><span className="search-pulse"/><span>{t('common.searchEverything')}</span><kbd>⌘K</kbd></button>
      <div className="module-status-legend" aria-label="Статусы готовности модулей">
        <span><i className="nav-module-state nav-module-state--not_started"/>Не начат</span>
        <span><i className="nav-module-state nav-module-state--in_progress"/>В работе</span>
        <span><i className="nav-module-state nav-module-state--complete"/>Готов</span>
        <span><i className="nav-module-state nav-module-state--error"/>Ошибка</span>
      </div>
      <nav className="module-tree">
        {sidebarDomains.map((domain,index)=><details className="module-domain" key={domain.id} open={index<8}>
          <summary><span>{domain.name}</span><small>{domain.modules.length}</small></summary>
          <div className="module-domain__items">{domain.modules.map(module=>{const href=getModuleHref(module,activeClientId);const active=pathname===href||(!isImplementedModule(module.id)&&pathname===`/platform/module/${module.id}`);const deliveryStatus=getModuleDeliveryStatus(module.id);return <Link key={module.id} to={href as never} className={`nav-link ${active?'is-active':''}`} title={`${module.description} · ${moduleDeliveryLabels[deliveryStatus]}`}><span className="nav-signal"/><span className="nav-link__label">{module.name}</span><i className={`nav-module-state nav-module-state--${deliveryStatus}`} title={moduleDeliveryLabels[deliveryStatus]}/></Link>})}</div>
        </details>)}
      </nav>
      <div className="sidebar-bottom">
        <Link to="/platform/modules" className="architecture-link">Архитектура и статусы</Link>
        <div className="setup-card"><div><span>{t('account.setup')}</span><strong>40%</strong></div><div className="progress"><span/></div><small>{t('account.stepsCompleted',{completed:2,total:5})}</small></div>
        <div className="account-card"><div className="avatar">{initials}</div><div><strong>{user?.name||t('account.demoUser')}</strong><span>{role}</span></div>{configured?<button onClick={()=>void signOut('local')} title={t('common.logout')}>↗</button>:<button title={t('common.demoMode')}>•••</button>}</div>
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
