import {useEffect,useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {Card} from '@imds/ui';
import {updateWorkspacePreferences} from '@imds/auth';
import {useAuth} from '../../app/AuthProvider';
import {useI18n,type Language} from '../../i18n/I18nProvider';
import {moduleDomains} from '../../modules/catalog';
import {getModuleHref} from '../../modules/navigation';
import {
  PlatformCoreLayout,
  PlatformEmptyState,
  type PlatformCoreTab,
} from './PlatformCoreLayout';

const tabs:PlatformCoreTab[]=[
  {id:'overview',label:'Обзор',description:'Текущий контекст'},
  {id:'context',label:'Контекст',description:'Agency и client'},
  {id:'preferences',label:'Настройки',description:'Язык и тема'},
  {id:'modules',label:'Модули',description:'Доступ и поиск'},
  {id:'recent',label:'Недавние',description:'История работы'},
];

const timezoneOptions=[
  'Asia/Almaty','Asia/Tashkent','Asia/Dubai','Europe/Moscow',
  'Europe/London','America/New_York','UTC',
];

type Theme='system'|'light'|'dark';

type CapabilityCopy={label:string;description:string;icon:string};

const entitlementCopy:Record<string,CapabilityCopy>={
  clients:{label:'Управление клиентами',description:'Карточки, группы и клиентский контекст',icon:'CL'},
  integrations:{label:'Интеграции и данные',description:'Подключение рекламных и аналитических источников',icon:'DS'},
  dashboards:{label:'Дашборды',description:'Визуализация показателей и рабочие представления',icon:'DB'},
  reports:{label:'Отчёты',description:'Подготовка и доставка маркетинговых отчётов',icon:'RP'},
  ai:{label:'AgencyAI',description:'Помощник, рекомендации и автоматические инсайты',icon:'AI'},
  clientPortal:{label:'Клиентский портал',description:'Защищённый доступ клиента к результатам',icon:'CP'},
  api:{label:'Developer API',description:'API-ключи, webhooks и программный доступ',icon:'API'},
  whiteLabel:{label:'White Label',description:'Фирменное оформление и собственный домен',icon:'WL'},
};

const featureCopy:Record<string,CapabilityCopy>={
  agency_ai:{label:'AgencyAI',description:'Ассистент и генерация маркетинговых инсайтов',icon:'AI'},
  client_portal:{label:'Клиентский портал',description:'Отдельный интерфейс для клиентов агентства',icon:'CP'},
  developer_api:{label:'Developer API',description:'API-ключи, webhooks, playground и MCP',icon:'API'},
  custom_metrics:{label:'Пользовательские метрики',description:'Формулы и повторно используемые показатели',icon:'FX'},
  report_scheduler:{label:'Расписание отчётов',description:'Автоматическая генерация и доставка отчётов',icon:'SC'},
  platform_core_v2:{label:'Новое ядро платформы',description:'Расширенный контекст, тарифы и feature flags',icon:'PC'},
};

const planLabels:Record<string,string>={trial:'Пробный',starter:'Стартовый',growth:'Рост',scale:'Масштаб'};
const roleLabels:Record<string,string>={admin:'Администратор',staff:'Сотрудник',client:'Клиент'};

function humanize(value:string){
  return value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,letter=>letter.toUpperCase());
}

function capabilityCopy(key:string,source:Record<string,CapabilityCopy>):CapabilityCopy{
  return source[key]??{label:humanize(key),description:'Возможность рабочего пространства',icon:key.slice(0,2).toUpperCase()};
}

export function WorkspacePage(){
  const{
    workspace,session,switchAgency,switchClient,refresh,signOut,loading,error,
  }=useAuth();
  const{setLanguage}=useI18n();
  const[notice,setNotice]=useState('');
  const[localError,setLocalError]=useState('');
  const[busy,setBusy]=useState(false);
  const[language,setPreferenceLanguage]=useState(workspace?.preferences.language??'ru');
  const[timezone,setTimezone]=useState(workspace?.preferences.timezone??'Asia/Almaty');
  const[theme,setTheme]=useState<Theme>(workspace?.preferences.theme??'system');
  const[moduleQuery,setModuleQuery]=useState('');
  const[moduleDomain,setModuleDomain]=useState('all');
  const[recentType,setRecentType]=useState('all');

  useEffect(()=>{
    if(!workspace)return;
    setPreferenceLanguage(workspace.preferences.language);
    setTimezone(workspace.preferences.timezone);
    setTheme(workspace.preferences.theme);
  },[workspace?.preferences.language,workspace?.preferences.timezone,workspace?.preferences.theme]);

  const dirty=Boolean(workspace)&&(
    language!==workspace!.preferences.language||
    timezone!==workspace!.preferences.timezone||
    theme!==workspace!.preferences.theme
  );

  useEffect(()=>{
    const guard=(event:BeforeUnloadEvent)=>{
      if(!dirty)return;
      event.preventDefault();
      event.returnValue='';
    };
    window.addEventListener('beforeunload',guard);
    return()=>window.removeEventListener('beforeunload',guard);
  },[dirty]);

  const availableModules=useMemo(()=>{
    const currentWorkspace=workspace;
    if(!currentWorkspace?.activeAgency)return[];
    const agency=currentWorkspace.activeAgency;
    return moduleDomains
      .flatMap(domain=>domain.modules.map(module=>({domain,module})))
      .filter(({module})=>{
        if(module.surface==='backend'||module.surface==='superadmin')return false;
        const permissionAllowed=
          agency.role==='admin'||agency.permissions.includes('*')||
          module.permissions.length===0||
          module.permissions.every(permission=>agency.permissions.includes(permission));
        const entitlementAllowed=
          module.entitlements.length===0||
          module.entitlements.every(
            entitlement=>currentWorkspace.entitlements.entitlements[entitlement]===true,
          );
        return permissionAllowed&&entitlementAllowed;
      });
  },[workspace]);

  const filteredModules=useMemo(()=>{
    const normalizedQuery=moduleQuery.trim().toLowerCase();
    return availableModules.filter(({domain,module})=>{
      const matchesDomain=moduleDomain==='all'||domain.id===moduleDomain;
      const matchesQuery=!normalizedQuery||
        `${module.name} ${module.description} ${domain.name}`.toLowerCase().includes(normalizedQuery);
      return matchesDomain&&matchesQuery;
    });
  },[availableModules,moduleDomain,moduleQuery]);

  const recentTypes=useMemo(
    ()=>Array.from(new Set(workspace?.recentItems.map(item=>item.itemType)??[])),
    [workspace?.recentItems],
  );
  const filteredRecent=useMemo(
    ()=>workspace?.recentItems.filter(item=>recentType==='all'||item.itemType===recentType)??[],
    [workspace?.recentItems,recentType],
  );

  if(!workspace)return <Card className="pc-card">Загрузка рабочего пространства…</Card>;

  const currentWorkspace=workspace;
  const agency=currentWorkspace.activeAgency;
  const activeClient=currentWorkspace.clients.find(item=>item.id===currentWorkspace.activeClientId)??null;
  const expiresAt=session?.expires_at?new Date(session.expires_at*1000):null;
  const dashboardModule=moduleDomains.flatMap(item=>item.modules).find(item=>item.id==='dashboard-directory');
  const fallbackClientId=currentWorkspace.activeClientId||currentWorkspace.clients[0]?.id||'amanat-med';
  const planLabel=planLabels[currentWorkspace.entitlements.plan]??humanize(currentWorkspace.entitlements.plan);
  const roleLabel=agency?roleLabels[agency.role]??humanize(agency.role):'Не назначена';
  const clientLimit=currentWorkspace.entitlements.limits.clients;
  const enabledFeatures=Object.values(currentWorkspace.featureFlags).filter(item=>item.enabled).length;
  const enabledEntitlements=Object.values(currentWorkspace.entitlements.entitlements).filter(Boolean).length;
  const visibleFeatures=Object.entries(currentWorkspace.featureFlags).filter(([key])=>key!=='platform_core_v2');

  async function savePreferences(){
    setBusy(true);setNotice('');setLocalError('');
    try{
      await updateWorkspacePreferences({language,timezone,theme});
      setLanguage(language as Language);
      await refresh();
      setNotice('Настройки рабочего пространства сохранены.');
    }catch(value){
      setLocalError(value instanceof Error?value.message:'Не удалось сохранить настройки.');
    }finally{setBusy(false)}
  }

  function resetPreferences(){
    setPreferenceLanguage(currentWorkspace.preferences.language);
    setTimezone(currentWorkspace.preferences.timezone);
    setTheme(currentWorkspace.preferences.theme);
  }

  const noticeNode=<>
    {(error||localError)&&<div className="pc-banner pc-banner--error">{error||localError}</div>}
    {notice&&<div className="pc-banner pc-banner--success">{notice}</div>}
    {dirty&&<div className="pc-banner pc-banner--warning">Есть несохранённые настройки Workspace.</div>}
  </>;

  return <PlatformCoreLayout
    title="Workspace"
    description="Единая точка входа в агентство, клиентов, возможности тарифа и персональные настройки."
    tabs={tabs}
    defaultTab="overview"
    actions={<button className="pc-button pc-button--primary" disabled={loading} onClick={()=>void refresh()}>{loading?'Обновление…':'Обновить данные'}</button>}
    notice={noticeNode}
  >
    {activeTab=>{
      if(activeTab==='overview')return <>
        <section className="pc-grid pc-grid--stats">
          <Card className="pc-stat pc-stat--identity"><span>Пользователь</span><strong>{currentWorkspace.currentUser.name}</strong><small>{roleLabel} · {currentWorkspace.currentUser.email}</small></Card>
          <Card className="pc-stat"><span>Рабочее пространство</span><strong>{agency?.name??'Агентство не выбрано'}</strong><small>{planLabel} тариф</small></Card>
          <Card className="pc-stat"><span>Текущий уровень</span><strong>{activeClient?.company??'Всё агентство'}</strong><small>{activeClient?.url??'Данные всех доступных клиентов'}</small></Card>
          <Card className="pc-stat"><span>Доступно модулей</span><strong>{availableModules.length}</strong><small>{enabledEntitlements} возможностей тарифа</small></Card>
        </section>

        <section className="pc-grid">
          <Card className="pc-card pc-workspace-summary">
            <div className="pc-card-heading"><div><span className="pc-eyebrow">Текущий контекст</span><h2>Готово к работе</h2></div><span className="pc-health-dot">Онлайн</span></div>
            <div className="pc-summary-list">
              <div><span className="pc-summary-icon">AG</span><div><strong>{agency?.name??'Агентство'}</strong><small>{roleLabel}</small></div></div>
              <div><span className="pc-summary-icon">{activeClient?'CL':'ALL'}</span><div><strong>{activeClient?.company??'Уровень агентства'}</strong><small>{activeClient?'Выбран один клиент':'Доступен обзор всех клиентов'}</small></div></div>
              <div><span className="pc-summary-icon">TZ</span><div><strong>{currentWorkspace.preferences.timezone}</strong><small>{currentWorkspace.preferences.language.toUpperCase()} · {currentWorkspace.preferences.theme==='dark'?'Тёмная тема':currentWorkspace.preferences.theme==='light'?'Светлая тема':'Системная тема'}</small></div></div>
            </div>
          </Card>

          <Card className="pc-card">
            <div className="pc-card-heading"><div><span className="pc-eyebrow">Навигация</span><h2>Быстрые действия</h2></div></div>
            <div className="pc-action-grid">
              <Link className="pc-action-card" to={'/' as never}><span>CL</span><div><strong>Клиенты</strong><small>Открыть список клиентов</small></div><b>→</b></Link>
              <Link className="pc-action-card" to={'/data' as never}><span>DS</span><div><strong>Источники данных</strong><small>Подключения и синхронизация</small></div><b>→</b></Link>
              {dashboardModule&&<Link className="pc-action-card" to={getModuleHref(dashboardModule,fallbackClientId) as never}><span>DB</span><div><strong>Дашборды</strong><small>Перейти к визуализации</small></div><b>→</b></Link>}
            </div>
          </Card>
        </section>

        <section className="pc-grid">
          <Card className="pc-card">
            <div className="pc-card-heading"><div><span className="pc-eyebrow">Тариф {planLabel}</span><h2>Возможности платформы</h2></div><span className="pc-count-badge">{enabledEntitlements} включено</span></div>
            <div className="pc-capability-list">
              {Object.entries(currentWorkspace.entitlements.entitlements).map(([key,enabled])=>{
                const copy=capabilityCopy(key,entitlementCopy);
                return <div className={`pc-capability ${enabled?'is-enabled':'is-disabled'}`} key={key}><span className="pc-capability__icon">{copy.icon}</span><div><strong>{copy.label}</strong><small>{copy.description}</small></div><b>{enabled?'Доступно':'Не входит'}</b></div>;
              })}
            </div>
          </Card>

          <Card className="pc-card">
            <div className="pc-card-heading"><div><span className="pc-eyebrow">Дополнительные функции</span><h2>Функции Workspace</h2></div><span className="pc-count-badge">{enabledFeatures} активна</span></div>
            <div className="pc-capability-list">
              {visibleFeatures.map(([key,value])=>{
                const copy=capabilityCopy(key,featureCopy);
                return <div className={`pc-capability ${value.enabled?'is-enabled':'is-disabled'}`} key={key}><span className="pc-capability__icon">{copy.icon}</span><div><strong>{copy.label}</strong><small>{copy.description}</small></div><b>{value.enabled?'Включена':'Выключена'}</b></div>;
              })}
            </div>
          </Card>
        </section>

        <details className="pc-tech-details">
          <summary>Техническая информация</summary>
          <dl className="pc-kv"><dt>Agency ID</dt><dd className="pc-mono">{agency?.id??'—'}</dd><dt>Client ID</dt><dd className="pc-mono">{currentWorkspace.activeClientId??'agency-level'}</dd><dt>Режим данных</dt><dd>{currentWorkspace.mode}</dd><dt>Product context</dt><dd>{currentWorkspace.productContext.id} / {currentWorkspace.productContext.surface}</dd><dt>Platform Core</dt><dd>{currentWorkspace.featureFlags.platform_core_v2?.enabled?'v2 включён':'v2 выключен'}</dd></dl>
        </details>
      </>;

      if(activeTab==='context')return <section className="pc-grid">
        <Card className="pc-card"><h2>Контекст рабочего пространства</h2><div className="pc-form"><label>Агентство<select value={agency?.id??''} disabled={loading} onChange={event=>void switchAgency(event.target.value)}>{currentWorkspace.agencies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Клиент<select value={currentWorkspace.activeClientId??''} disabled={loading} onChange={event=>void switchClient(event.target.value||null)}><option value="">Все клиенты агентства</option>{currentWorkspace.clients.map(item=><option key={item.id} value={item.id}>{item.company}</option>)}</select></label></div><p className="pc-footer-note">Выбор сохраняется в профиле и восстанавливается после следующего входа.</p></Card>
        <Card className="pc-card"><h2>Доступный контекст</h2><div className="pc-context-metrics"><div><strong>{currentWorkspace.agencies.length}</strong><span>агентств</span></div><div><strong>{currentWorkspace.clients.length}{clientLimit>0?` / ${clientLimit}`:''}</strong><span>клиентов</span></div><div><strong>{roleLabel}</strong><span>роль пользователя</span></div><div><strong>{agency?.permissions.includes('*')?'Полный':String(agency?.permissions.length??0)}</strong><span>уровень доступа</span></div></div></Card>
      </section>;

      if(activeTab==='preferences')return <section className="pc-grid">
        <Card className="pc-card"><h2>Персональные настройки</h2><div className="pc-form"><label>Язык<select value={language} onChange={event=>setPreferenceLanguage(event.target.value)}><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select></label><label>Часовой пояс<select value={timezone} onChange={event=>setTimezone(event.target.value)}>{!timezoneOptions.includes(timezone)&&<option value={timezone}>{timezone}</option>}{timezoneOptions.map(item=><option key={item} value={item}>{item}</option>)}</select></label><label>Тема<select value={theme} onChange={event=>setTheme(event.target.value as Theme)}><option value="system">Как в системе</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label><div className="pc-actions"><button className="pc-button" disabled={!dirty||busy} onClick={resetPreferences}>Сбросить</button><button className="pc-button pc-button--primary" disabled={!dirty||busy} onClick={()=>void savePreferences()}>{busy?'Сохранение…':'Сохранить настройки'}</button></div></div></Card>
        <Card className="pc-card pc-preference-preview"><span className="pc-eyebrow">Предпросмотр</span><h2>{theme==='dark'?'Тёмное оформление':theme==='light'?'Светлое оформление':'Системное оформление'}</h2><p>Язык интерфейса: <strong>{language.toUpperCase()}</strong></p><p>Рабочий часовой пояс: <strong>{timezone}</strong></p><span className={`pc-sync-state ${dirty?'is-dirty':'is-synced'}`}>{dirty?'Есть несохранённые изменения':'Настройки синхронизированы'}</span></Card>
      </section>;

      if(activeTab==='modules')return <section className="pc-grid"><Card className="pc-card pc-card--wide"><div className="pc-toolbar"><div><h2>Доступные модули</h2><p>Список учитывает роль, permissions и возможности тарифа.</p></div><div className="pc-actions"><input aria-label="Поиск модулей" placeholder="Найти модуль" value={moduleQuery} onChange={event=>setModuleQuery(event.target.value)}/><select className="pc-button" value={moduleDomain} onChange={event=>setModuleDomain(event.target.value)}><option value="all">Все разделы</option>{moduleDomains.map(domain=><option key={domain.id} value={domain.id}>{domain.name}</option>)}</select></div></div>{filteredModules.length?<div className="pc-tiles">{filteredModules.map(({domain,module})=><Link className="pc-tile" key={module.id} to={getModuleHref(module,fallbackClientId) as never}><strong>{module.name}</strong><span>{domain.name} · {module.surface}</span></Link>)}</div>:<PlatformEmptyState title="Модули не найдены" description="Измените запрос или выбранный раздел."/>}</Card></section>;

      return <section className="pc-grid"><Card className="pc-card pc-card--wide"><div className="pc-toolbar"><div><h2>Недавние элементы</h2><p>Последние рабочие объекты и посещённые модули.</p></div><select className="pc-button" value={recentType} onChange={event=>setRecentType(event.target.value)}><option value="all">Все типы</option>{recentTypes.map(type=><option key={type} value={type}>{humanize(type)}</option>)}</select></div>{filteredRecent.length?<div className="pc-tiles">{filteredRecent.map(item=><Link className="pc-tile" key={item.id} to={item.route as never}><strong>{item.title}</strong><span>{humanize(item.itemType)} · {new Date(item.visitedAt).toLocaleString('ru-RU')}</span></Link>)}</div>:<PlatformEmptyState title="Недавних элементов пока нет" description="Они появятся после переходов по клиентам, дашбордам и отчётам."/>}</Card><Card className="pc-card pc-card--wide"><h2>Управление сессией</h2><p>{session?`Текущая сессия действует до ${expiresAt?.toLocaleString('ru-RU')??'окончания политики Auth'}.`:'Демо-режим.'}</p><div className="pc-actions"><button className="pc-button" onClick={()=>void signOut('local')}>Выйти на этом устройстве</button><button className="pc-button pc-button--danger" onClick={()=>{if(window.confirm('Выйти на всех устройствах?'))void signOut('global')}}>Выйти на всех устройствах</button></div></Card></section>;
    }}
  </PlatformCoreLayout>;
}
