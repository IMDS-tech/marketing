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
  'Asia/Almaty',
  'Asia/Tashkent',
  'Asia/Dubai',
  'Europe/Moscow',
  'Europe/London',
  'America/New_York',
  'UTC',
];

type Theme='system'|'light'|'dark';

export function WorkspacePage(){
  const{
    workspace,
    session,
    switchAgency,
    switchClient,
    refresh,
    signOut,
    loading,
    error,
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
  },[
    workspace?.preferences.language,
    workspace?.preferences.timezone,
    workspace?.preferences.theme,
  ]);

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
          agency.role==='admin'||
          agency.permissions.includes('*')||
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
      const matchesQuery=
        normalizedQuery.length===0||
        `${module.name} ${module.description} ${domain.name}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesDomain&&matchesQuery;
    });
  },[availableModules,moduleDomain,moduleQuery]);

  const recentTypes=useMemo(
    ()=>Array.from(new Set(workspace?.recentItems.map(item=>item.itemType)??[])),
    [workspace?.recentItems],
  );

  const filteredRecent=useMemo(
    ()=>workspace?.recentItems.filter(
      item=>recentType==='all'||item.itemType===recentType,
    )??[],
    [workspace?.recentItems,recentType],
  );

  if(!workspace){
    return <Card className="pc-card">Загрузка рабочего пространства…</Card>;
  }

  const currentWorkspace=workspace;
  const agency=currentWorkspace.activeAgency;
  const activeClient=currentWorkspace.clients.find(
    item=>item.id===currentWorkspace.activeClientId,
  )??null;
  const expiresAt=session?.expires_at?new Date(session.expires_at*1000):null;
  const dashboardModule=moduleDomains
    .flatMap(item=>item.modules)
    .find(item=>item.id==='dashboard-directory');
  const fallbackClientId=
    currentWorkspace.activeClientId||
    currentWorkspace.clients[0]?.id||
    'amanat-med';

  async function savePreferences(){
    setBusy(true);
    setNotice('');
    setLocalError('');
    try{
      await updateWorkspacePreferences({language,timezone,theme});
      setLanguage(language as Language);
      document.documentElement.dataset.theme=theme;
      await refresh();
      setNotice('Настройки рабочего пространства сохранены.');
    }catch(value){
      setLocalError(
        value instanceof Error
          ?value.message
          :'Не удалось сохранить настройки.',
      );
    }finally{
      setBusy(false);
    }
  }

  function resetPreferences(){
    setPreferenceLanguage(currentWorkspace.preferences.language);
    setTimezone(currentWorkspace.preferences.timezone);
    setTheme(currentWorkspace.preferences.theme);
  }

  const noticeNode=<>
    {(error||localError)&&(
      <div className="pc-banner pc-banner--error">{error||localError}</div>
    )}
    {notice&&<div className="pc-banner pc-banner--success">{notice}</div>}
    {dirty&&(
      <div className="pc-banner pc-banner--error">
        Есть несохранённые настройки Workspace.
      </div>
    )}
  </>;

  return <PlatformCoreLayout
    title="Workspace"
    description="Пользователь, tenant, клиентский и продуктовый контекст, preferences и доступные возможности."
    tabs={tabs}
    defaultTab="overview"
    actions={
      <button
        className="pc-button pc-button--primary"
        disabled={loading}
        onClick={()=>void refresh()}
      >
        {loading?'Обновление…':'Обновить workspace'}
      </button>
    }
    notice={noticeNode}
  >
    {activeTab=>{
      if(activeTab==='overview'){
        return <>
          <section className="pc-grid pc-grid--stats">
            <Card className="pc-stat">
              <span>Пользователь</span>
              <strong>{currentWorkspace.currentUser.name}</strong>
              <small>{currentWorkspace.currentUser.email}</small>
            </Card>
            <Card className="pc-stat">
              <span>Активное агентство</span>
              <strong>{agency?.name??'Не выбрано'}</strong>
              <small>
                {agency?.role??'—'} · {agency?.plan??currentWorkspace.entitlements.plan}
              </small>
            </Card>
            <Card className="pc-stat">
              <span>Активный клиент</span>
              <strong>{activeClient?.company??'Уровень агентства'}</strong>
              <small>{activeClient?.url??'Клиент не выбран'}</small>
            </Card>
            <Card className="pc-stat">
              <span>Продукт</span>
              <strong>{currentWorkspace.productContext.name}</strong>
              <small>
                {currentWorkspace.productContext.surface} · {currentWorkspace.mode}
              </small>
            </Card>
          </section>

          <section className="pc-grid">
            <Card className="pc-card">
              <h2>Состояние Workspace</h2>
              <dl className="pc-kv">
                <dt>Agency ID</dt>
                <dd className="pc-mono">{agency?.id??'—'}</dd>
                <dt>Client ID</dt>
                <dd className="pc-mono">
                  {currentWorkspace.activeClientId??'agency-level'}
                </dd>
                <dt>Тариф</dt>
                <dd>{currentWorkspace.entitlements.plan}</dd>
                <dt>Язык</dt>
                <dd>{currentWorkspace.preferences.language}</dd>
                <dt>Тема</dt>
                <dd>{currentWorkspace.preferences.theme}</dd>
                <dt>Часовой пояс</dt>
                <dd>{currentWorkspace.preferences.timezone}</dd>
              </dl>
            </Card>

            <Card className="pc-card">
              <h2>Быстрые действия</h2>
              <div className="pc-tiles">
                <Link className="pc-tile" to={'/' as never}>
                  <strong>Клиенты</strong>
                  <span>Открыть directory</span>
                </Link>
                <Link className="pc-tile" to={'/data' as never}>
                  <strong>Источники данных</strong>
                  <span>Подключения и sync</span>
                </Link>
                {dashboardModule&&(
                  <Link
                    className="pc-tile"
                    to={getModuleHref(dashboardModule,fallbackClientId) as never}
                  >
                    <strong>Дашборды</strong>
                    <span>Рабочее пространство</span>
                  </Link>
                )}
              </div>
            </Card>
          </section>

          <section className="pc-grid">
            <Card className="pc-card">
              <h2>Feature flags</h2>
              <div className="pc-list">
                {Object.entries(currentWorkspace.featureFlags)
                  .slice(0,6)
                  .map(([key,value])=>(
                    <div className="pc-list__row" key={key}>
                      <div>
                        <strong>{key}</strong>
                        <span>{value.description}</span>
                      </div>
                      <span className={`pc-badge ${value.enabled?'pc-badge--on':'pc-badge--off'}`}>
                        {value.enabled?'Включён':'Выключен'}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>

            <Card className="pc-card">
              <h2>Entitlements</h2>
              <div className="pc-list">
                {Object.entries(currentWorkspace.entitlements.entitlements).map(
                  ([key,value])=>(
                    <div className="pc-list__row" key={key}>
                      <strong>{key}</strong>
                      <span className={`pc-badge ${value?'pc-badge--on':'pc-badge--off'}`}>
                        {value?'Доступно':'Недоступно'}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </Card>
          </section>
        </>;
      }

      if(activeTab==='context'){
        return <section className="pc-grid">
          <Card className="pc-card">
            <h2>Контекст рабочего пространства</h2>
            <div className="pc-form">
              <label>
                Агентство
                <select
                  value={agency?.id??''}
                  disabled={loading}
                  onChange={event=>void switchAgency(event.target.value)}
                >
                  {currentWorkspace.agencies.map(item=>(
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Клиент
                <select
                  value={currentWorkspace.activeClientId??''}
                  disabled={loading}
                  onChange={event=>void switchClient(event.target.value||null)}
                >
                  <option value="">Уровень агентства</option>
                  {currentWorkspace.clients.map(item=>(
                    <option key={item.id} value={item.id}>{item.company}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="pc-footer-note">
              Контекст сохраняется в профиле пользователя и восстанавливается после следующего входа.
            </p>
          </Card>

          <Card className="pc-card">
            <h2>Доступный контекст</h2>
            <dl className="pc-kv">
              <dt>Агентств</dt><dd>{currentWorkspace.agencies.length}</dd>
              <dt>Клиентов</dt><dd>{currentWorkspace.clients.length}</dd>
              <dt>Роль</dt><dd>{agency?.role??'—'}</dd>
              <dt>Permissions</dt>
              <dd>
                {agency?.permissions.includes('*')
                  ?'Полный доступ'
                  :agency?.permissions.length??0}
              </dd>
              <dt>Режим</dt><dd>{currentWorkspace.mode}</dd>
            </dl>
          </Card>
        </section>;
      }

      if(activeTab==='preferences'){
        return <section className="pc-grid">
          <Card className="pc-card">
            <h2>Workspace Preferences</h2>
            <div className="pc-form">
              <label>
                Язык
                <select
                  value={language}
                  onChange={event=>setPreferenceLanguage(event.target.value)}
                >
                  <option value="ru">Русский</option>
                  <option value="kk">Қазақша</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                Часовой пояс
                <select
                  value={timezone}
                  onChange={event=>setTimezone(event.target.value)}
                >
                  {!timezoneOptions.includes(timezone)&&(
                    <option value={timezone}>{timezone}</option>
                  )}
                  {timezoneOptions.map(item=>(
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Тема
                <select
                  value={theme}
                  onChange={event=>setTheme(event.target.value as Theme)}
                >
                  <option value="system">Системная</option>
                  <option value="light">Светлая</option>
                  <option value="dark">Тёмная</option>
                </select>
              </label>
              <div className="pc-actions">
                <button
                  className="pc-button"
                  disabled={!dirty||busy}
                  onClick={resetPreferences}
                >
                  Сбросить
                </button>
                <button
                  className="pc-button pc-button--primary"
                  disabled={!dirty||busy}
                  onClick={()=>void savePreferences()}
                >
                  {busy?'Сохранение…':'Сохранить настройки'}
                </button>
              </div>
            </div>
          </Card>

          <Card className="pc-card">
            <h2>Предпросмотр</h2>
            <dl className="pc-kv">
              <dt>Язык</dt><dd>{language}</dd>
              <dt>Часовой пояс</dt><dd>{timezone}</dd>
              <dt>Тема</dt><dd>{theme}</dd>
              <dt>Состояние</dt><dd>{dirty?'Есть изменения':'Синхронизировано'}</dd>
            </dl>
            <p>
              Настройки применяются к текущему пользователю и не изменяют параметры других участников агентства.
            </p>
          </Card>
        </section>;
      }

      if(activeTab==='modules'){
        return <section className="pc-grid">
          <Card className="pc-card pc-card--wide">
            <div className="pc-toolbar">
              <div>
                <h2>Доступные модули</h2>
                <p>
                  Рассчитано по роли, permissions, поверхности продукта и тарифным entitlements.
                </p>
              </div>
              <div className="pc-actions">
                <input
                  aria-label="Поиск модулей"
                  placeholder="Поиск модулей"
                  value={moduleQuery}
                  onChange={event=>setModuleQuery(event.target.value)}
                />
                <select
                  className="pc-button"
                  value={moduleDomain}
                  onChange={event=>setModuleDomain(event.target.value)}
                >
                  <option value="all">Все разделы</option>
                  {moduleDomains.map(domain=>(
                    <option key={domain.id} value={domain.id}>{domain.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredModules.length?(
              <div className="pc-tiles">
                {filteredModules.map(({domain,module})=>(
                  <Link
                    className="pc-tile"
                    key={module.id}
                    to={getModuleHref(module,fallbackClientId) as never}
                  >
                    <strong>{module.name}</strong>
                    <span>{domain.name} · {module.surface}</span>
                  </Link>
                ))}
              </div>
            ):(
              <PlatformEmptyState
                title="Модули не найдены"
                description="Измените поисковый запрос или выбранный раздел."
              />
            )}
          </Card>
        </section>;
      }

      return <section className="pc-grid">
        <Card className="pc-card pc-card--wide">
          <div className="pc-toolbar">
            <div>
              <h2>Недавние элементы</h2>
              <p>История переходов по рабочим объектам и модулям.</p>
            </div>
            <select
              className="pc-button"
              value={recentType}
              onChange={event=>setRecentType(event.target.value)}
            >
              <option value="all">Все типы</option>
              {recentTypes.map(type=>(
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {filteredRecent.length?(
            <div className="pc-tiles">
              {filteredRecent.map(item=>(
                <Link className="pc-tile" key={item.id} to={item.route as never}>
                  <strong>{item.title}</strong>
                  <span>
                    {item.itemType} · {new Date(item.visitedAt).toLocaleString('ru-RU')}
                  </span>
                </Link>
              ))}
            </div>
          ):(
            <PlatformEmptyState
              title="Недавних элементов пока нет"
              description="Они появятся после переходов по клиентам, дашбордам, отчётам и другим рабочим модулям."
            />
          )}
        </Card>

        <Card className="pc-card pc-card--wide">
          <h2>Управление сессией</h2>
          <p>
            {session
              ?`Текущая сессия истекает ${expiresAt?.toLocaleString('ru-RU')??'по политике Auth'}.`
              :'Демо-режим.'}
          </p>
          <div className="pc-actions">
            <button
              className="pc-button"
              onClick={()=>void signOut('local')}
            >
              Выйти на этом устройстве
            </button>
            <button
              className="pc-button pc-button--danger"
              onClick={()=>{
                if(window.confirm('Выйти на всех устройствах?')){
                  void signOut('global');
                }
              }}
            >
              Выйти на всех устройствах
            </button>
          </div>
        </Card>
      </section>;
    }}
  </PlatformCoreLayout>;
}
