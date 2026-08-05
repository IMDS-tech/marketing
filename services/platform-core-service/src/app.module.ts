import {BadRequestException,Body,Controller,Get,Headers,Module,Post,Query} from '@nestjs/common';
import {z} from 'zod';
import {Db} from './db.js';
import {AccessService,verifyUserJwt} from './security.js';

const uuid=z.string().uuid();
const parse=<T>(schema:z.ZodType<T>,value:unknown):T=>{const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.flatten());return result.data};
const auditSchema=z.object({agencyId:uuid,clientId:uuid.nullable().optional(),eventType:z.string().trim().min(1).max(80),action:z.string().trim().min(1).max(120),entityType:z.string().trim().min(1).max(80),entityId:z.string().trim().max(160).nullable().optional(),metadata:z.record(z.string(),z.unknown()).default({})});

@Controller('health')
class HealthController{@Get()health(){return{ok:true,service:'platform-core-service',modules:['tenants','users','memberships','permissions','branding','entitlements','billing','audit']}}}

@Controller('v1/platform')
class PlatformController{
  constructor(private readonly db:Db,private readonly access:AccessService){}

  @Get('tenants')
  async tenants(@Headers('authorization')authorization:string){
    const user=await verifyUserJwt(authorization);const result=await this.db.query(`select a.id,a.name,a.slug,a.plan,a.trial_ends_at,a.branding,m.role::text,m.permissions,m.status from public.agency_memberships m join public.agencies a on a.id=m.agency_id where m.user_id=$1 and m.status='active' order by a.name`,[user.userId]);return{items:result.rows};
  }

  @Get('workspace')
  async workspace(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string){
    const user=await verifyUserJwt(authorization);parse(uuid,agencyId);const membership=await this.access.membership(user.userId,agencyId);
    const [agency,clients,plan,override,flags,profile]=await Promise.all([
      this.db.query(`select id,name,slug,phone,website,language,timezone,plan,trial_ends_at,branding,created_at,updated_at from public.agencies where id=$1`,[agencyId]),
      this.db.query(`select c.id,c.company,c.url,c.timezone,c.country,c.language,c.status,c.logo_url,c.brand_color,c.updated_at from public.clients c where c.agency_id=$1 and c.status<>'archived' and (exists(select 1 from public.agency_memberships m where m.agency_id=$1 and m.user_id=$2 and m.status='active' and (m.role='admin' or '*'=any(m.permissions) or 'clients.read'=any(m.permissions))) or exists(select 1 from public.client_users cu where cu.client_id=c.id and cu.user_id=$2 and cu.status='active')) order by c.company`,[agencyId,user.userId]),
      this.db.query(`select pe.entitlements,pe.limits from public.agencies a left join public.plan_entitlements pe on pe.plan=a.plan where a.id=$1`,[agencyId]),
      this.db.query(`select entitlements,limits from public.agency_entitlement_overrides where agency_id=$1`,[agencyId]),
      this.db.query(`select f.key,coalesce(af.enabled,f.default_enabled) enabled,coalesce(af.config,f.metadata) config from public.feature_flags f left join public.agency_feature_flags af on af.flag_key=f.key and af.agency_id=$1 order by f.key`,[agencyId]),
      this.db.query(`select p.user_id,p.name,p.avatar_url,p.locale,u.email from public.user_profiles p left join auth.users u on u.id=p.user_id where p.user_id=$1`,[user.userId]),
    ]);
    if(!agency.rows[0])throw new BadRequestException('AGENCY_NOT_FOUND');
    const base=plan.rows[0]??{entitlements:{},limits:{}};const custom=override.rows[0]??{entitlements:{},limits:{}};
    return {currentUser:profile.rows[0]??{user_id:user.userId,email:user.email},agency:agency.rows[0],membership,clients:clients.rows,permissions:membership.permissions,entitlements:{entitlements:{...(base.entitlements??{}),...(custom.entitlements??{})},limits:{...(base.limits??{}),...(custom.limits??{})}},featureFlags:Object.fromEntries(flags.rows.map((row:any)=>[row.key,{enabled:row.enabled,config:row.config}]))};
  }

  @Get('memberships')
  async memberships(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string){
    const user=await verifyUserJwt(authorization);parse(uuid,agencyId);await this.access.require(user.userId,agencyId,'users.read');const result=await this.db.query(`select m.id,m.user_id,m.role::text,m.permissions,m.status,m.created_at,m.updated_at,p.name,p.avatar_url,u.email from public.agency_memberships m left join public.user_profiles p on p.user_id=m.user_id left join auth.users u on u.id=m.user_id where m.agency_id=$1 order by p.name nulls last,u.email`,[agencyId]);return{items:result.rows};
  }

  @Get('branding')
  async branding(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string){
    const user=await verifyUserJwt(authorization);parse(uuid,agencyId);await this.access.membership(user.userId,agencyId);const result=await this.db.query(`select id,name,slug,branding from public.agencies where id=$1`,[agencyId]);return result.rows[0]??null;
  }

  @Get('billing')
  async billing(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string){
    const user=await verifyUserJwt(authorization);parse(uuid,agencyId);await this.access.require(user.userId,agencyId,'billing.read');const [plan,usage]=await Promise.all([this.db.query(`select a.plan,a.trial_ends_at,coalesce(p.entitlements,'{}'::jsonb)||coalesce(o.entitlements,'{}'::jsonb) entitlements,coalesce(p.limits,'{}'::jsonb)||coalesce(o.limits,'{}'::jsonb) limits from public.agencies a left join public.plan_entitlements p on p.plan=a.plan left join public.agency_entitlement_overrides o on o.agency_id=a.id where a.id=$1`,[agencyId]),this.db.query(`select (select count(*)::int from public.clients where agency_id=$1 and status<>'archived') clients,(select count(*)::int from public.agency_memberships where agency_id=$1 and status='active') users,(select count(*)::int from public.data_sources where agency_id=$1 and status<>'disconnected') integrations`,[agencyId])]);return{...(plan.rows[0]??{}),usage:usage.rows[0]??{}};
  }

  @Get('permissions')
  async permissions(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string){
    const user=await verifyUserJwt(authorization);parse(uuid,agencyId);const membership=await this.access.require(user.userId,agencyId,'permissions.read');
    const registry=await this.db.query(`select key,module,description,risk_level from public.permission_registry order by module,key`);
    return {role:membership.role,granted:membership.permissions,registry:registry.rows};
  }

  @Get('audit')
  async audit(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string,@Query('limit')limit='100'){
    const user=await verifyUserJwt(authorization);parse(uuid,agencyId);await this.access.require(user.userId,agencyId,'audit.read');const count=Math.min(500,Math.max(1,Number(limit)||100));
    const result=await this.db.query(`select id,agency_id,user_id,event_type,action,entity_type,entity_id,metadata,created_at from public.audit_logs where agency_id=$1 order by created_at desc limit $2`,[agencyId,count]);
    return {items:result.rows};
  }

  @Post('audit')
  async recordAudit(@Headers('authorization')authorization:string,@Body()body:unknown){
    const user=await verifyUserJwt(authorization);const input=parse(auditSchema,body);await this.access.membership(user.userId,input.agencyId);
    const result=await this.db.query(`insert into public.audit_logs(agency_id,user_id,event_type,action,entity_type,entity_id,metadata) values($1,$2,$3,$4,$5,$6,$7) returning id,created_at`,[input.agencyId,user.userId,input.eventType,input.action,input.entityType,input.entityId??null,input.metadata]);
    await this.db.query(`insert into public.activity_log(agency_id,client_id,user_id,action,metadata) values($1,$2,$3,$4,$5)`,[input.agencyId,input.clientId??null,user.userId,input.action,{eventType:input.eventType,entityType:input.entityType,entityId:input.entityId??null,...input.metadata}]);
    return {ok:true,...result.rows[0]};
  }
}

@Module({controllers:[HealthController,PlatformController],providers:[Db,AccessService]})
export class AppModule{}
