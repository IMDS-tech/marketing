export const permissions={clientsRead:'clients.read',clientsManage:'clients.manage',reportsRead:'reports.read',reportsManage:'reports.manage',integrationsManage:'integrations.manage',agencyManage:'agency.manage',dashboardsRead:'dashboards.read',dashboardsManage:'dashboards.manage'} as const;
export function can(granted:readonly string[],permission:string){return granted.includes('*')||granted.includes(permission)}
export function canAccess(agency:{role:'admin'|'staff'|'client';permissions:readonly string[]}|null|undefined,permission:string){return Boolean(agency&&(agency.role==='admin'||can(agency.permissions,permission)))}
export function canUseWorkspace(role:'admin'|'staff'|'client'){return role==='admin'||role==='staff'||role==='client'}
