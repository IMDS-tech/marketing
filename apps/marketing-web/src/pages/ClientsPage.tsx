import {FormEvent,useMemo,useState} from 'react';
import {Badge,Button,Card} from '@imds/ui';
import {getSupabaseBrowserClient} from '@imds/auth';
import {canAccess,permissions} from '@imds/permissions';
import {useAuth} from '../app/AuthProvider';
import {useI18n} from '../i18n/I18nProvider';
import {ForbiddenPage} from './ForbiddenPage';

const copy={
  en:{emptyTitle:'No clients yet',emptyText:'Create the first client to connect advertising accounts, dashboards and reports.',company:'Company name',website:'Website',country:'Country',timezone:'Timezone',language:'Language',color:'Brand color',cancel:'Cancel',create:'Create client',creating:'Creating…',required:'Company name is required.',failed:'Could not create the client. Please try again.'},
  ru:{emptyTitle:'Клиентов пока нет',emptyText:'Создайте первого клиента, чтобы подключить рекламные аккаунты, дашборды и отчёты.',company:'Название компании',website:'Сайт',country:'Страна',timezone:'Часовой пояс',language:'Язык',color:'Цвет бренда',cancel:'Отмена',create:'Создать клиента',creating:'Создание…',required:'Укажите название компании.',failed:'Не удалось создать клиента. Попробуйте ещё раз.'},
  kk:{emptyTitle:'Клиенттер әзірге жоқ',emptyText:'Жарнама аккаунттарын, дашбордтар мен есептерді қосу үшін алғашқы клиентті жасаңыз.',company:'Компания атауы',website:'Сайт',country:'Ел',timezone:'Уақыт белдеуі',language:'Тіл',color:'Бренд түсі',cancel:'Бас тарту',create:'Клиент жасау',creating:'Жасалуда…',required:'Компания атауын енгізіңіз.',failed:'Клиентті жасау мүмкін болмады. Қайта көріңіз.'},
} as const;

export function ClientsPage(){
  const{workspace,refresh}=useAuth();
  const{t,locale,language}=useI18n();
  const text=copy[language];
  const[open,setOpen]=useState(false);
  const[saving,setSaving]=useState(false);
  const[formError,setFormError]=useState('');
  const[company,setCompany]=useState('');
  const[url,setUrl]=useState('');
  const[country,setCountry]=useState('Kazakhstan');
  const[timezone,setTimezone]=useState('Asia/Almaty');
  const[clientLanguage,setClientLanguage]=useState(language);
  const[brandColor,setBrandColor]=useState('#0072EE');

  const canManage=useMemo(()=>workspace?canAccess(workspace.activeAgency,permissions.clientsManage):false,[workspace]);
  if(!workspace)return <Card className="loading-card">{t('common.loadingWorkspace')}</Card>;
  if(!canAccess(workspace.activeAgency,permissions.clientsRead))return <ForbiddenPage/>;
  const sources=workspace.clients.reduce((sum,client)=>sum+client.connectedSources,0);

  async function createClient(event:FormEvent){
    event.preventDefault();
    if(!company.trim()){setFormError(text.required);return}
    setSaving(true);setFormError('');
    try{
      const db=getSupabaseBrowserClient();
      const{error}=await db.from('clients').insert({agency_id:workspace!.activeAgency!.id,company:company.trim(),url:url.trim()||null,country:country.trim()||null,timezone,language:clientLanguage,brand_color:brandColor});
      if(error)throw error;
      setOpen(false);setCompany('');setUrl('');setCountry('Kazakhstan');setTimezone('Asia/Almaty');setClientLanguage(language);setBrandColor('#0072EE');
      await refresh();
    }catch(error){setFormError(error instanceof Error?error.message:text.failed)}finally{setSaving(false)}
  }

  return <>
    <section className="page-heading"><div><h2>{t('clients.title')}</h2><p>{t('clients.description')}</p></div><div className="heading-actions"><Button variant="secondary" onClick={()=>void refresh()}>{t('common.refresh')}</Button><Button variant="secondary">{t('common.addFilter')}</Button>{canManage&&<Button onClick={()=>setOpen(true)}>{t('common.addClient')}</Button>}</div></section>
    <section className="stats-grid"><Card><span>{t('clients.totalClients')}</span><strong>{workspace.clients.length}</strong><small>{t('clients.acrossWorkspaces',{count:workspace.agencies.length})}</small></Card><Card><span>{t('clients.connectedSources')}</span><strong>{sources}</strong><small>{t('clients.connectedSourceHint')}</small></Card><Card><span>{t('clients.workspaceMode')}</span><strong>{workspace.mode==='demo'?t('clients.demo'):t('clients.live')}</strong><small>{workspace.mode==='demo'?t('clients.configureSupabase'):t('clients.supabaseConnected')}</small></Card></section>
    {workspace.clients.length===0?<Card className="clients-empty"><div className="clients-empty__signal">+</div><h3>{text.emptyTitle}</h3><p>{text.emptyText}</p>{canManage&&<Button onClick={()=>setOpen(true)}>+ {t('common.addClient')}</Button>}</Card>:<Card className="table-card"><div className="table-toolbar"><div><h2>{t('clients.title')}</h2><span>{t('clients.showingRows',{shown:workspace.clients.length,total:workspace.clients.length})}</span></div><input aria-label={t('clients.search')} placeholder={t('clients.search')}/></div><div className="table-wrap"><table><thead><tr><th/><th>{t('clients.client')}</th><th>{t('clients.domain')}</th><th>{t('clients.status')}</th><th>{t('clients.dataSources')}</th><th>{t('clients.created')}</th><th/></tr></thead><tbody>{workspace.clients.map(client=><tr key={client.id}><td><input type="checkbox" aria-label={t('clients.selectClient',{name:client.company})}/></td><td><div className="client-cell"><div className="client-logo" style={{background:client.brandColor}}>{client.company.slice(0,2).toUpperCase()}</div><div><strong>{client.company}</strong><span>{client.id}</span></div></div></td><td>{client.url??'—'}</td><td><Badge tone={client.status==='active'?'success':'warning'}>{t(`clients.statuses.${client.status}`)}</Badge></td><td>{client.connectedSources}</td><td>{new Date(client.createdAt).toLocaleDateString(locale)}</td><td><button className="icon-button">⋯</button></td></tr>)}</tbody><tfoot><tr><td colSpan={4}>{t('clients.totals')}</td><td>{sources}</td><td colSpan={2}>{t('clients.clientsCount',{count:workspace.clients.length})}</td></tr></tfoot></table></div></Card>}
    {open&&<div className="client-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><form className="client-modal" onSubmit={createClient}><div className="client-modal__head"><div><span>CLIENT NODE</span><h3>{t('common.addClient')}</h3></div><button type="button" onClick={()=>setOpen(false)}>×</button></div><div className="client-form-grid"><label className="wide">{text.company}<input autoFocus value={company} onChange={event=>setCompany(event.target.value)} placeholder="Amanat Med"/></label><label className="wide">{text.website}<input value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://amanat-med.kz"/></label><label>{text.country}<input value={country} onChange={event=>setCountry(event.target.value)}/></label><label>{text.timezone}<select value={timezone} onChange={event=>setTimezone(event.target.value)}><option value="Asia/Almaty">Asia/Almaty</option><option value="Asia/Astana">Asia/Astana</option><option value="UTC">UTC</option></select></label><label>{text.language}<select value={clientLanguage} onChange={event=>setClientLanguage(event.target.value as 'en'|'ru'|'kk')}><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select></label><label>{text.color}<input type="color" value={brandColor} onChange={event=>setBrandColor(event.target.value)}/></label></div>{formError&&<div className="client-form-error">{formError}</div>}<div className="client-modal__actions"><Button type="button" variant="secondary" onClick={()=>setOpen(false)}>{text.cancel}</Button><Button disabled={saving}>{saving?text.creating:text.create}</Button></div></form></div>}
    <style>{`.clients-empty{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px;background:linear-gradient(135deg,#fff,#f7f9fc)}.clients-empty__signal{width:52px;height:52px;display:grid;place-items:center;border:1px solid var(--brand-color);color:var(--brand-color);font-size:28px;margin-bottom:18px;transform:rotate(45deg)}.clients-empty__signal::first-letter{transform:rotate(-45deg)}.clients-empty h3{font-size:22px;margin:0 0 8px}.clients-empty p{max-width:520px;color:#64748b;margin:0 0 20px;line-height:1.6}.client-modal-backdrop{position:fixed;inset:0;background:rgba(5,12,24,.62);display:grid;place-items:center;padding:24px;z-index:100}.client-modal{width:min(620px,100%);background:#fff;border:1px solid #cfd7e5;box-shadow:0 30px 90px rgba(4,12,28,.32);padding:24px}.client-modal__head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e5eaf1;padding-bottom:16px;margin-bottom:20px}.client-modal__head span{font-size:10px;letter-spacing:.16em;color:#64748b}.client-modal__head h3{font-size:24px;margin:5px 0 0}.client-modal__head button{border:0;background:transparent;font-size:26px}.client-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.client-form-grid label{font-size:12px;font-weight:700;color:#334155;display:flex;flex-direction:column;gap:7px}.client-form-grid .wide{grid-column:1/-1}.client-form-grid input,.client-form-grid select{height:42px;border:1px solid #cfd7e5;padding:0 12px;background:#fff}.client-form-grid input[type=color]{padding:4px}.client-form-error{margin-top:14px;padding:10px 12px;background:#fff1f2;color:#be123c;font-size:12px}.client-modal__actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}@media(max-width:720px){.client-form-grid{grid-template-columns:1fr}.client-form-grid .wide{grid-column:auto}}`}</style>
  </>;
}
