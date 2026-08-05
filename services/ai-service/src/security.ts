import {ForbiddenException,Injectable,UnauthorizedException} from '@nestjs/common';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {Db} from './db.js';
import {config} from './config.js';
const jwks=createRemoteJWKSet(new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
export async function verifyUserJwt(authorization?:string){
  if(!authorization?.startsWith('Bearer '))throw new UnauthorizedException('AUTH_REQUIRED');
  const {payload}=await jwtVerify(authorization.slice(7),jwks,{issuer:`${config.SUPABASE_URL}/auth/v1`});
  if(!payload.sub)throw new UnauthorizedException('AUTH_INVALID');
  return{userId:payload.sub,email:String(payload.email??'')};
}
@Injectable()
export class AccessService{
  constructor(private readonly db:Db){}
  async require(userId:string,agencyId:string,permission:'ai.use'|'ai.read'|'ai.manage'='ai.use'){
    const result=await this.db.query<{role:string;permissions:string[];plan_entitlements:Record<string,unknown>;override_entitlements:Record<string,unknown>}>(
      `select m.role::text,m.permissions,coalesce(p.entitlements,'{}'::jsonb) plan_entitlements,coalesce(o.entitlements,'{}'::jsonb) override_entitlements
       from public.agency_memberships m join public.agencies a on a.id=m.agency_id
       left join public.plan_entitlements p on p.plan=a.plan left join public.agency_entitlement_overrides o on o.agency_id=a.id
       where m.agency_id=$1 and m.user_id=$2 and m.status='active' limit 1`,[agencyId,userId]);
    const row=result.rows[0];
    if(!row)throw new ForbiddenException('AGENCY_ACCESS_DENIED');
    if(row.role!=='admin'&&!row.permissions.includes('*')&&!row.permissions.includes(permission))throw new ForbiddenException('PERMISSION_DENIED');
    const entitlements={...row.plan_entitlements,...row.override_entitlements};
    if(entitlements.ai!==true)throw new ForbiddenException('AI_ENTITLEMENT_REQUIRED');
  }
  async requireClient(userId:string,agencyId:string,clientId:string){
    const result=await this.db.query(`select 1 from public.clients c where c.id=$1 and c.agency_id=$2 and (exists(select 1 from public.agency_memberships m where m.agency_id=c.agency_id and m.user_id=$3 and m.status='active') or exists(select 1 from public.client_users cu where cu.client_id=c.id and cu.user_id=$3 and cu.status='active'))`,[clientId,agencyId,userId]);
    if(!result.rowCount)throw new ForbiddenException('CLIENT_ACCESS_DENIED');
  }
}
