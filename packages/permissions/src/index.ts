export const permissions={clientsRead:'clients.read',clientsManage:'clients.manage',reportsRead:'reports.read',reportsManage:'reports.manage',integrationsManage:'integrations.manage',agencyManage:'agency.manage'} as const;
export function can(granted:readonly string[],permission:string){return granted.includes('*')||granted.includes(permission)}
export function canUseWorkspace(role:'admin'|'staff'|'client'){return role==='admin'||role==='staff'||role==='client'}
