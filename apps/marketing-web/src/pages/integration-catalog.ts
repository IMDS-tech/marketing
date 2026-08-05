import type {ConnectorCategory,ConnectorDefinition} from '@imds/integrations';

export type CatalogCategory='all'|ConnectorCategory;
export type ConnectorAvailability='available'|'planned'|'unsupported';

const supportedOAuthProviders=new Set(['google-ads','ga4','search-console','meta-ads','tiktok-ads']);

export function getConnectorAvailability(connector:ConnectorDefinition):ConnectorAvailability{
  if(connector.lifecycle==='planned')return'planned';
  if(connector.authType!=='oauth2'||!supportedOAuthProviders.has(connector.slug))return'unsupported';
  return'available';
}

export function filterConnectorCatalog<T extends ConnectorDefinition>(
  connectors:readonly T[],
  query:string,
  category:CatalogCategory,
  onlyAvailable:boolean,
):T[]{
  const normalized=query.trim().toLocaleLowerCase();
  return connectors.filter(connector=>{
    if(category!=='all'&&connector.category!==category)return false;
    if(onlyAvailable&&getConnectorAvailability(connector)!=='available')return false;
    if(!normalized)return true;
    return `${connector.name} ${connector.slug}`.toLocaleLowerCase().includes(normalized);
  });
}

export function formatLastSync(value:string|null,locale='ru-RU'){
  if(!value)return'Ещё не синхронизировалось';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return'Некорректная дата';
  return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(date);
}
