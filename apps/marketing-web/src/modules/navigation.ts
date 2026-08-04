import {moduleDomains} from './catalog';
import type {ModuleDefinition} from './types';

const implementedRoutes:Record<string,(clientId:string)=>string>={
  authentication:()=>'/platform/authentication',
  workspace:()=>'/platform/workspace',
  'client-directory':()=>'/',
  'integration-catalog':()=>'/data',
  'dashboard-directory':clientId=>`/client/${clientId}/dashboards`,
  campaigns:clientId=>`/client/${clientId}/meta-ads/campaigns`,
  'report-directory':()=>'/reports',
  'rollup-dashboards':()=>'/rollups',
  'kpi-management':()=>'/kpis',
  'export-center':()=>'/exports',
};

export function getModuleHref(module:ModuleDefinition,clientId:string){
  return implementedRoutes[module.id]?.(clientId)??`/platform/module/${module.id}`;
}

export function getModuleById(moduleId:string|undefined){
  if(!moduleId)return undefined;
  for(const domain of moduleDomains){
    const module=domain.modules.find(item=>item.id===moduleId);
    if(module)return{domain,module};
  }
  return undefined;
}

export function isImplementedModule(moduleId:string){
  return moduleId in implementedRoutes;
}
