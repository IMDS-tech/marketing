import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {Db} from './db.js';

type Permission='integrations.read'|'integrations.manage';

@Injectable()
export class IntegrationsService{
  constructor(private readonly db:Db){}

  private async requirePermission(userId:string,agencyId:string,permission:Permission,clientId?:string){
    const result=await this.db.query(
      `select 1
       from public.agency_memberships membership
       where membership.user_id=$1
         and membership.agency_id=$2
         and membership.status='active'
         and (membership.role='admin' or '*'=any(membership.permissions) or $3=any(membership.permissions))
         and ($4::uuid is null or exists(
           select 1 from public.clients client
           where client.id=$4 and client.agency_id=membership.agency_id
         ))`,
      [userId,agencyId,permission,clientId||null],
    );
    if(!result.rowCount)throw new ForbiddenException('INTEGRATION_ACCESS_DENIED');
  }

  async workspace(userId:string,agencyId:string,clientId?:string){
    await this.requirePermission(userId,agencyId,'integrations.read',clientId);
    const values=[agencyId,clientId||null];
    const [integrations,sources,accounts,jobs,runs]=await Promise.all([
      this.db.query<any>(
        `select id,slug,name,category,auth_type,lifecycle,is_beta,is_new,is_popular,metadata
         from public.integrations order by sort_order,name`,
      ),
      this.db.query<any>(
        `select source.id,source.client_id,source.integration_id,source.account_id,source.label,
                source.external_identifier,source.status,source.last_sync_at,source.next_sync_at,
                source.last_success_at,source.last_error_at,source.paused_at,source.sync_depth_days,
                source.sync_error,source.settings
         from public.data_sources source
         where source.agency_id=$1 and ($2::uuid is null or source.client_id=$2)
         order by source.created_at desc`,values),
      this.db.query<any>(
        `select account.id,account.integration_id,account.label,account.external_account_id,
                account.status,account.expires_at,account.metadata,
                count(source.id)::int as attachment_count
         from public.data_source_accounts account
         left join public.data_sources source on source.account_id=account.id and source.agency_id=account.agency_id
         where account.agency_id=$1
         group by account.id
         order by account.created_at desc`,[agencyId]),
      this.db.query<any>(
        `select job.id,job.data_source_id,job.period_from,job.period_to,job.state,job.attempts,
                job.max_attempts,job.priority,job.run_after,job.last_error,job.created_at
         from public.sync_jobs job
         join public.data_sources source on source.id=job.data_source_id and source.agency_id=job.agency_id
         where job.agency_id=$1 and ($2::uuid is null or source.client_id=$2)
         order by job.created_at desc limit 200`,values),
      this.db.query<any>(
        `select run.id,run.data_source_id,run.state,run.started_at,run.finished_at,
                run.rows_fetched,run.rows_written,run.error,run.metadata
         from public.sync_runs run
         join public.data_sources source on source.id=run.data_source_id and source.agency_id=run.agency_id
         where run.agency_id=$1 and ($2::uuid is null or source.client_id=$2)
         order by run.started_at desc limit 200`,values),
    ]);
    return {integrations:integrations.rows,sources:sources.rows,accounts:accounts.rows,jobs:jobs.rows,runs:runs.rows};
  }

  async schema(userId:string,agencyId:string,integrationId?:string){
    await this.requirePermission(userId,agencyId,'integrations.read');
    const integrations=await this.db.query<any>(
      `select i.id,i.slug,i.name,i.category,i.auth_type,i.lifecycle,i.metadata,
              coalesce(jsonb_agg(distinct jsonb_build_object(
                'id',entity.id,'key',entity.entity_key,'label',entity.label,'description',entity.description,
                'supportsDateRange',entity.supports_date_range,'supportedDateRange',entity.supported_date_range,
                'attributionWindows',entity.attribution_windows,'rateLimits',entity.rate_limits,'metadata',entity.metadata
              )) filter(where entity.id is not null),'[]'::jsonb) as entities
       from public.integrations i
       left join public.integration_schema_entities entity on entity.integration_id=i.id
       where ($1::uuid is null or i.id=$1)
       group by i.id order by i.sort_order,i.name`,[integrationId||null]);
    const ids=integrations.rows.map((row:any)=>row.id);
    if(integrationId&&!ids.length)throw new NotFoundException('INTEGRATION_NOT_FOUND');
    const [fields,errors]=ids.length?await Promise.all([
      this.db.query<any>(
        `select integration_id,entity_id,field_key,kind,label,description,data_type,aggregation,
                filter_operators,supports_breakdown,provider_key,metadata
         from public.integration_schema_fields where integration_id=any($1::uuid[])
         order by integration_id,entity_id,kind,field_key`,[ids]),
      this.db.query<any>(
        `select integration_id,code,category,message,retryable,remediation,metadata
         from public.integration_provider_errors where integration_id=any($1::uuid[])
         order by integration_id,category,code`,[ids]),
    ]):[{rows:[]},{rows:[]}];
    return integrations.rows.map((integration:any)=>({
      ...integration,
      fields:fields.rows.filter((field:any)=>field.integration_id===integration.id),
      errors:errors.rows.filter((error:any)=>error.integration_id===integration.id),
    }));
  }

  async updateSource(userId:string,dataSourceId:string,input:{syncDepthDays?:number;settings?:Record<string,unknown>}){
    const found=await this.db.query<any>(`select id,agency_id,client_id from public.data_sources where id=$1`,[dataSourceId]);
    const source=found.rows[0];
    if(!source)throw new NotFoundException('DATA_SOURCE_NOT_FOUND');
    await this.requirePermission(userId,source.agency_id,'integrations.manage',source.client_id);
    const depth=input.syncDepthDays===undefined?null:Number(input.syncDepthDays);
    if(depth!==null&&(!Number.isInteger(depth)||depth<1||depth>3650))throw new BadRequestException('syncDepthDays must be between 1 and 3650');
    if(input.settings!==undefined&&(typeof input.settings!=='object'||input.settings===null||Array.isArray(input.settings)))throw new BadRequestException('settings must be an object');
    const updated=await this.db.query<any>(
      `update public.data_sources
       set sync_depth_days=coalesce($2::int,sync_depth_days),
           settings=case when $3::jsonb is null then settings else settings||$3::jsonb end,
           updated_at=now()
       where id=$1
       returning id,sync_depth_days,settings,next_sync_at`,
      [dataSourceId,depth,input.settings===undefined?null:JSON.stringify(input.settings)],
    );
    return updated.rows[0];
  }

  async retryJob(userId:string,jobId:string){
    const found=await this.db.query<any>(
      `select job.id,job.agency_id,job.data_source_id,source.client_id,job.period_from,job.period_to,job.state
       from public.sync_jobs job join public.data_sources source on source.id=job.data_source_id
       where job.id=$1`,[jobId]);
    const job=found.rows[0];
    if(!job)throw new NotFoundException('SYNC_JOB_NOT_FOUND');
    await this.requirePermission(userId,job.agency_id,'integrations.manage',job.client_id);
    if(!['failed','cancelled'].includes(job.state))throw new BadRequestException('Only failed or cancelled jobs can be retried');
    const retry=await this.db.query<any>(
      `insert into public.sync_jobs(agency_id,data_source_id,period_from,period_to,state,priority,payload,run_after)
       values($1,$2,$3,$4,'queued',20,jsonb_build_object('trigger','retry','retryOf',$5,'requestedBy',$6),now())
       returning id,state,period_from,period_to,created_at`,
      [job.agency_id,job.data_source_id,job.period_from,job.period_to,job.id,userId],
    );
    await this.db.query(`update public.data_sources set status='syncing',sync_error=null,updated_at=now() where id=$1`,[job.data_source_id]);
    return retry.rows[0];
  }
}
