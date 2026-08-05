import{useMemo,useState,type FormEvent}from'react';
import{useMutation,useQuery,useQueryClient}from'@tanstack/react-query';
import{Archive,FilePlus2,Folder,RefreshCw,Search}from'lucide-react';
import{Badge,Button,Card}from'@imds/ui';
import{canAccess,permissions}from'@imds/permissions';
import{useAuth}from'../../app/AuthProvider';
import{useI18n}from'../../i18n/I18nProvider';
import{archiveReport,createReport,listReportFolders,listReports,type ReportStatus}from'../../report-api';
import{ForbiddenPage}from'../ForbiddenPage';
import'./report-directory.css';

const statuses:ReportStatus[]=['draft','scheduled','sent','failed','archived'];
const statusLabel:Record<ReportStatus,string>={draft:'Черновик',scheduled:'Запланирован',sent:'Отправлен',failed:'Ошибка',archived:'Архив'};
const statusTone:Record<ReportStatus,'neutral'|'info'|'success'|'danger'|'warning'>={draft:'neutral',scheduled:'info',sent:'success',failed:'danger',archived:'warning'};

export function ReportDirectoryPage(){
 const{workspace,session}=useAuth();const{locale}=useI18n();const queryClient=useQueryClient();
 const[search,setSearch]=useState('');const[status,setStatus]=useState<ReportStatus|''>('');const[clientId,setClientId]=useState('');const[folderId,setFolderId]=useState('');const[showCreate,setShowCreate]=useState(false);const[name,setName]=useState('');const[description,setDescription]=useState('');const[newClientId,setNewClientId]=useState('');
 if(!workspace)return <Card className="loading-card">Загрузка отчётов…</Card>;
 const agency=workspace.activeAgency;if(!agency||!canAccess(agency,permissions.reportsRead))return <ForbiddenPage/>;
 const canManage=canAccess(agency,permissions.reportsManage);const filters={search:search||undefined,status:status||undefined,clientId:clientId||undefined,folderId:folderId||undefined};
 const reportsQuery=useQuery({queryKey:['reports',agency.id,filters],queryFn:()=>listReports(agency.id,filters,session,workspace.mode)});
 const foldersQuery=useQuery({queryKey:['report-folders',agency.id],queryFn:()=>listReportFolders(agency.id,session,workspace.mode)});
 const createMutation=useMutation({mutationFn:()=>createReport({agencyId:agency.id,clientId:newClientId||null,name,description,status:'draft'},session,workspace.mode),onSuccess:async()=>{setName('');setDescription('');setNewClientId('');setShowCreate(false);await queryClient.invalidateQueries({queryKey:['reports',agency.id]})}});
 const archiveMutation=useMutation({mutationFn:(id:string)=>archiveReport(id,agency.id,session,workspace.mode),onSuccess:()=>queryClient.invalidateQueries({queryKey:['reports',agency.id]})});
 const reports=reportsQuery.data??[];const summary=useMemo(()=>Object.fromEntries(statuses.map(item=>[item,reports.filter(report=>report.status===item).length]))as Record<ReportStatus,number>,[reports]);
 const submit=(event:FormEvent)=>{event.preventDefault();if(name.trim())createMutation.mutate()};
 return <>
  <section className="page-heading"><div><h2>Отчёты</h2><p>Создание, планирование и контроль клиентских отчётов в одном каталоге.</p></div><div className="heading-actions"><Button variant="secondary" onClick={()=>void reportsQuery.refetch()}><RefreshCw size={16}/> Обновить</Button>{canManage&&<Button onClick={()=>setShowCreate(value=>!value)}><FilePlus2 size={16}/> Новый отчёт</Button>}</div></section>
  <section className="stats-grid report-stats"><Card><span>Всего</span><strong>{reports.length}</strong><small>По текущим фильтрам</small></Card><Card><span>Запланировано</span><strong>{summary.scheduled}</strong><small>Ожидают следующего запуска</small></Card><Card><span>Требуют внимания</span><strong>{summary.failed}</strong><small>Последняя генерация завершилась ошибкой</small></Card></section>
  {showCreate&&<Card className="report-create-card"><form onSubmit={submit}><div><h3>Новый отчёт</h3><p>Создаётся как черновик. Расписание и получатели подключаются следующим модулем.</p></div><label>Название<input autoFocus value={name} maxLength={160} onChange={event=>setName(event.target.value)} required/></label><label>Клиент<select value={newClientId} onChange={event=>setNewClientId(event.target.value)}><option value="">Агентский отчёт</option>{workspace.clients.map(client=><option key={client.id} value={client.id}>{client.company}</option>)}</select></label><label className="report-description">Описание<textarea value={description} maxLength={2000} onChange={event=>setDescription(event.target.value)}/></label><div className="report-form-actions"><Button type="button" variant="secondary" onClick={()=>setShowCreate(false)}>Отмена</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending?'Создание…':'Создать'}</Button></div>{createMutation.error&&<p className="report-error">{createMutation.error.message}</p>}</form></Card>}
  <Card className="report-directory-card">
   <div className="report-toolbar"><div className="report-search"><Search size={17}/><input aria-label="Поиск отчётов" placeholder="Поиск по названию и описанию" value={search} onChange={event=>setSearch(event.target.value)}/></div><select aria-label="Статус" value={status} onChange={event=>setStatus(event.target.value as ReportStatus|'')}><option value="">Все статусы</option>{statuses.map(item=><option key={item} value={item}>{statusLabel[item]}</option>)}</select><select aria-label="Клиент" value={clientId} onChange={event=>setClientId(event.target.value)}><option value="">Все клиенты</option>{workspace.clients.map(client=><option key={client.id} value={client.id}>{client.company}</option>)}</select><select aria-label="Папка" value={folderId} onChange={event=>setFolderId(event.target.value)}><option value="">Все папки</option>{(foldersQuery.data??[]).map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>
   {reportsQuery.isLoading?<div className="report-state">Загрузка каталога…</div>:reportsQuery.error?<div className="report-state report-error">Не удалось загрузить отчёты: {reportsQuery.error.message}</div>:reports.length===0?<div className="report-state"><Folder size={32}/><h3>Отчёты не найдены</h3><p>Измените фильтры или создайте первый отчёт.</p></div>:<div className="table-wrap"><table><thead><tr><th>Отчёт</th><th>Клиент</th><th>Папка</th><th>Статус</th><th>Следующий запуск</th><th>Обновлён</th><th/></tr></thead><tbody>{reports.map(report=><tr key={report.id}><td><div className="report-name"><strong>{report.name}</strong><span>{report.description||'Без описания'}</span></div></td><td>{report.clientName??workspace.clients.find(item=>item.id===report.clientId)?.company??'Агентство'}</td><td>{report.folderName??'—'}</td><td><Badge tone={statusTone[report.status]}>{statusLabel[report.status]}</Badge></td><td>{report.nextRunAt?new Date(report.nextRunAt).toLocaleString(locale):'—'}</td><td>{new Date(report.updatedAt).toLocaleDateString(locale)}</td><td>{canManage&&report.status!=='archived'&&<button className="report-icon-button" title="Архивировать" onClick={()=>archiveMutation.mutate(report.id)}><Archive size={17}/></button>}</td></tr>)}</tbody></table></div>}
  </Card>
 </>;
}
