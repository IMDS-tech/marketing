import {moduleDomains} from './catalog';
import type {ModuleDefinition} from './types';

const implementedRoutes:Record<string,(clientId:string)=>string>={
  authentication:()=>'/platform/authentication',
  workspace:()=>'/platform/workspace',
  'agency-profile':()=>'/settings/company',
  'users-teams':()=>'/settings/users',
  billing:()=>'/settings/billing',
  'agency-onboarding':()=>'/onboarding',
  'client-directory':()=> '/',
  'client-creation':()=>'/clients/new',
  'client-profile':clientId=>`/client/${clientId}/profile`,
  'client-users':clientId=>`/client/${clientId}/users`,
  'client-settings':clientId=>`/client/${clientId}/settings`,
  'client-groups':()=>'/clients/groups',
  'integration-catalog':()=>'/data',
  'connection-manager':()=>'/data/connections',
  'agency-connections':()=>'/data/agency-connections',
  'data-source-management':clientId=>`/client/${clientId}/data`,
  'integration-schema':()=>'/data/schema',
  'sync-health':()=>'/data/sync-health',
  'dashboard-directory':clientId=>`/client/${clientId}/dashboards`,
  campaigns:clientId=>`/client/${clientId}/ads/campaigns`,
  'funnel-analytics':clientId=>`/client/${clientId}/ads/funnel`,
  'report-directory':()=>'/reports',
  'rollup-dashboards':()=>'/rollups',
  'kpi-management':()=>'/kpis',
  'export-center':()=>'/exports',
  'platform-core-service':()=>'/backend/platform-core-service',
  'integration-service':()=>'/backend/integration-service',
  'report-api':()=>'/backend/report-api',
  'notification-worker':()=>'/backend/notification-worker',
  'ai-service':()=>'/backend/ai-service',
  'search-indexer':()=>'/backend/search-indexer',
};

export function getModuleHref(module:ModuleDefinition,clientId:string){return implementedRoutes[module.id]?.(clientId)??`/platform/module/${module.id}`}
export function getModuleById(moduleId:string|undefined){if(!moduleId)return undefined;for(const domain of moduleDomains){const module=domain.modules.find(item=>item.id===moduleId);if(module)return{domain,module}}return undefined}
export function isImplementedModule(moduleId:string){return moduleId in implementedRoutes}
