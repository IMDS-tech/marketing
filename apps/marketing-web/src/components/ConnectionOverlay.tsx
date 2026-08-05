import {useEffect,useState} from 'react';
import {connectorCatalog,type ConnectorAuthType,type ConnectorLifecycle} from '@imds/integrations';
import {getSupabaseBrowserClient} from '@imds/auth';
import {ConnectDataSourceModal} from './ConnectDataSourceModal';

type Integration={id?:string;slug:string;name:string;authType:ConnectorAuthType;lifecycle:ConnectorLifecycle};

export function ConnectionOverlay(){
  const[integration,setIntegration]=useState<Integration|null>(null);
  useEffect(()=>{
    const click=async(event:MouseEvent)=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('.connector-button');
      if(!button||button.disabled||button.textContent?.trim()!=='Connect')return;
      event.preventDefault();
      const name=button.closest<HTMLElement>('.connector-card')?.querySelector('h3')?.textContent?.trim();
      const local=connectorCatalog.find(item=>item.name===name);
      if(!local)return;
      let id:string|undefined;
      try{const{data}=await getSupabaseBrowserClient().from('integrations').select('id').eq('slug',local.slug).single();id=data?.id}catch{}
      setIntegration({id,slug:local.slug,name:local.name,authType:local.authType,lifecycle:local.lifecycle});
    };
    document.addEventListener('click',click);
    return()=>document.removeEventListener('click',click);
  },[]);
  return integration?<ConnectDataSourceModal integration={integration} onClose={()=>setIntegration(null)} onConnected={()=>window.location.reload()}/>:null;
}
