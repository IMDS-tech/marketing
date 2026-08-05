import {Controller,ForbiddenException,Get,Headers,Query,UnauthorizedException} from '@nestjs/common';
import {Db} from './db.js';
import {providers} from './providers.js';
import {verifyUserJwt} from './security.js';

const capabilities:Record<string,string[]>={
  'google-ads':['oauth','token-refresh','account-discovery','campaign-sync'],
  ga4:['oauth','token-refresh','property-discovery','analytics-sync'],
  'search-console':['oauth','token-refresh','site-discovery','search-sync'],
  'meta-ads':['oauth','account-discovery','ad-sync'],
  'tiktok-ads':['oauth','account-discovery','campaign-sync'],
};

async function user(auth?:string){if(!auth?.startsWith('Bearer '))throw new UnauthorizedException('AUTH_REQUIRED');return verifyUserJwt(auth.slice(7))}

@Controller()
export class ServiceController{
  constructor(private readonly db:Db){}

  @Get('health')
  health(){return {ok:true,service:'integration-service',providers:Object.keys(providers),credentialStorage:'encrypted-private-vault'}}

  @Get('v1/providers')
  providerCatalog(){return {items:Object.keys(providers).map(slug=>({slug,authType:'oauth2',capabilities:capabilities[slug]??[]}))}}

  @Get('v1/service/status')
  async status(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string){
    const current=await user(authorization);
    const membership=await this.db.query<{role:string;permissions:string[]}>(`select role::text,permissions from public.agency_memberships where agency_id=$1 and user_id=$2 and status='active' limit 1`,[agencyId,current.userId]);
    const access=membership.rows[0];
    if(!access||access.role!=='admin'&&!access.permissions.includes('*')&&!access.permissions.includes('integrations.read'))throw new ForbiddenException('PERMISSION_DENIED');
    const result=await this.db.query(`select (select count(*)::int from public.data_source_accounts where agency_id=$1) accounts,(select count(*)::int from public.data_sources where agency_id=$1 and status<>'disconnected') sources,(select count(*)::int from public.sync_jobs where agency_id=$1 and state in ('queued','running')) active_jobs,(select count(*)::int from private.integration_credentials where agency_id=$1 and revoked_at is null) active_credentials`,[agencyId]);
    return {agencyId,...result.rows[0],providers:Object.keys(providers).length};
  }
}
