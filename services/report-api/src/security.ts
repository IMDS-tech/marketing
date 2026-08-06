import {ForbiddenException,Injectable,UnauthorizedException} from '@nestjs/common';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {Db} from './db.js';
import {config} from './config.js';

const jwks=createRemoteJWKSet(new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
export async function verifyUserJwt(authorization?:string){
  if(!authorization?.startsWith('Bearer '))throw new UnauthorizedException('AUTH_REQUIRED');
  const {payload}=await jwtVerify(authorization.slice(7),jwks,{issuer:`${config.SUPABASE_URL}/auth/v1`});
  if(!payload.sub)throw new UnauthorizedException('AUTH_INVALID');
  return {userId:payload.sub,email:String(payload.email??'')};
}

type ReportPermission='reports.read'|'reports.manage'|'analytics.read'|'dashboards.read'|'dashboards.manage';
@Injectable()
export class AccessService{
  constructor(private readonly db:Db){}
  async requirePermission(userId:string,agencyId:string,permission:ReportPermission){return this.requireAnyPermission(userId,agencyId,[permission])}
  async requireAnyPermission(userId:string,agencyId:string,required:readonly ReportPermission[]){
    const result=await this.db.query<{role:string;permissions:string[]}>(
      `select role::text,permissions from public.agency_memberships
       where agency_id=$1 and user_id=$2 and status='active' limit 1`,[agencyId,userId]);
    const membership=result.rows[0];
    if(!membership)throw new ForbiddenException('AGENCY_ACCESS_DENIED');
    if(membership.role==='admin'||membership.permissions.includes('*')||required.some(permission=>membership.permissions.includes(permission)))return;
    throw new ForbiddenException('PERMISSION_DENIED');
  }
}
