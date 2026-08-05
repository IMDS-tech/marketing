import {useEffect,useMemo,useState} from 'react';
import {integrationApi} from '../integration-api';
import {useAuth} from '../app/AuthProvider';

type Integration={id?:string;slug:string;name:string};
type Account={id:string;name?:string;currency?:string};
const serviceOrigin=(()=>{try{return new URL(import.meta.env.VITE_INTEGRATION_SERVICE_URL||'http://invalid').origin}catch{return ''}})();

export function ConnectDataSourceModal({integration,onClose,onConnected}:{integration:Integration;onClose:()=>void;onConnected:()=>void}){
  const{workspace}=useAuth();
  const[handle,setHandle]=useState('');
  const[accounts,setAccounts]=useState<Account[]>([]);
  const[selected,setSelected]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  const agency=workspace?.activeAgency;
  const client=useMemo(()=>workspace?.clients.find(item=>item.id===workspace.activeClientId)??null,[workspace]);

  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==serviceOrigin||event.data?.type!=='imds-oauth-complete')return;
      setHandle(event.data.handle);
      void integrationApi.accounts(event.data.handle).then(setAccounts).catch(value=>setError(value instanceof Error?value.message:'Не удалось загрузить аккаунты'));
    };
    window.addEventListener('message',receive);
    return()=>window.removeEventListener('message',receive);
  },[]);

  async function connect(){
    if(!agency||!client||!integration.id)return;
    setBusy(true);setError('');
    try{
      const result=await integrationApi.start(integration.slug,{agencyId:agency.id,clientId:client.id,returnOrigin:window.location.origin});
      const popup=window.open(result.authorizationUrl,'imds-oauth','popup,width=620,height=760');
      if(!popup)throw new Error('Разрешите popup для подключения интеграции');
    }catch(value){setError(value instanceof Error?value.message:'Connection failed')}finally{setBusy(false)}
  }

  async function attach(){
    if(!agency||!client||!integration.id||!handle||!selected)return;
    setBusy(true);setError('');
    try{
      const account=accounts.find(item=>item.id===selected)!;
      await integrationApi.attach({handle,agencyId:agency.id,clientId:client.id,integrationId:integration.id,externalIdentifier:selected,label:account.name||selected});
      await Promise.resolve(onConnected());
      onClose();
    }catch(value){setError(value instanceof Error?value.message:'Attach failed')}finally{setBusy(false)}
  }

  return <div className="connect-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><div className="connect-modal" role="dialog" aria-modal="true" aria-labelledby="connect-title"><button className="connect-close" onClick={onClose} aria-label="Закрыть">×</button><h2 id="connect-title">Подключить {integration.name}</h2><p>{client?`Клиент: ${client.company}`:'Выберите активного клиента в переключателе слева.'}</p>{!handle?<button className="primary" disabled={busy||!client||!integration.id} onClick={connect}>{busy?'Открываем…':'Войти через OAuth'}</button>:accounts.length?<><label>Выберите аккаунт<select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Выберите…</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name||account.id}</option>)}</select></label><button className="primary" disabled={busy||!selected} onClick={attach}>{busy?'Подключаем…':'Подключить аккаунт'}</button></>:<p>Авторизация завершена, но провайдер не вернул доступных аккаунтов.</p>}{error&&<div className="form-error">{error}</div>}<style>{`.connect-backdrop{position:fixed;inset:0;background:#11182766;display:grid;place-items:center;z-index:100}.connect-modal{position:relative;width:min(520px,calc(100vw - 32px));background:#fff;border-radius:12px;padding:24px;box-shadow:0 24px 70px #11182740}.connect-close{position:absolute;right:14px;top:10px;border:0;background:none;font-size:24px}.connect-modal label{display:grid;gap:8px;margin:18px 0}.connect-modal select{padding:10px;border:1px solid #d1d5db;border-radius:7px}.connect-modal .primary{background:#0072ee;color:#fff;border:0;border-radius:7px;padding:10px 14px}`}</style></div></div>;
}
