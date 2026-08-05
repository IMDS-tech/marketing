import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {Db} from './db.js';
import {encryptJson} from './security.js';

type ManualConnectionInput={
  agencyId:string;
  clientId:string;
  integrationId:string;
  externalIdentifier:string;
  label:string;
  credentials:Record<string,unknown>;
};

type SyncInput={periodFrom?:string;periodTo?:string};
type ConnectionAction='pause'|'resume'|'disconnect';

function required(value:unknown,label:string){
  const text=String(value??'').trim();
  if(!text)throw new BadRequestException(`${label} is required`);
  return text;
}

function isoDate(value:unknown,label:string){
  const text=required(value,label);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(Date.parse(`${text}T00:00:00Z`)))throw new BadRequestException(`${label} must be YYYY-MM-DD`);
  return text;
}

function defaultPeriod(){
  const to=new Date();
  const from=new Date(to);
  from.setUTCDate(from.getUTCDate()-29);
  return {periodFrom:from.toISOString().slice(0,10),periodTo:to.toISOString().slice(0,10)};
}

@Injectable()
export class ConnectionsService{
  constructor(private readonly db:Db){}

  private async assertAccess(userId:string,agencyId:string,clientId?:string){
    const result=await this.db.query(
      `select 1
       from public.agency_memberships membership
       where membership.user_id=$1
         and membership.agency_id=$2
         and membership.status='active'
         and (membership.role='admin' or '*'=any(membership.permissions) or 'integrations.manage'=any(membership.permissions))
         and ($3::uuid is null or exists(
           select 1 from public.clients client
           where client.id=$3 and client.agency_id=membership.agency_id
         ))`,
      [userId,agencyId,clientId||null],
    );
    if(!result.rowCount)throw new ForbiddenException('No integration permission');
  }

  private async sourceForUser(userId:string,dataSourceId:string){
    const result=await this.db.query<any>(
      `select source.*,integration.slug,integration.auth_type,account.credential_handle
       from public.data_sources source
       join public.integrations integration on integration.id=source.integration_id
       left join public.data_source_accounts account on account.id=source.account_id and account.agency_id=source.agency_id
       where source.id=$1`,
      [dataSourceId],
    );
    const source=result.rows[0];
    if(!source)throw new NotFoundException('Data source not found');
    await this.assertAccess(userId,source.agency_id,source.client_id);
    return source;
  }

  async manualAttach(userId:string,input:ManualConnectionInput){
    const agencyId=required(input.agencyId,'agencyId');
    const clientId=required(input.clientId,'clientId');
    const integrationId=required(input.integrationId,'integrationId');
    const externalIdentifier=required(input.externalIdentifier,'externalIdentifier');
    const label=required(input.label,'label');
    if(!input.credentials||typeof input.credentials!=='object'||Array.isArray(input.credentials)||!Object.keys(input.credentials).length){
      throw new BadRequestException('credentials are required');
    }
    await this.assertAccess(userId,agencyId,clientId);
    const integrationResult=await this.db.query<any>(
      `select id,slug,auth_type,lifecycle from public.integrations where id=$1`,
      [integrationId],
    );
    const integration=integrationResult.rows[0];
    if(!integration)throw new NotFoundException('Integration not found');
    if(integration.auth_type==='oauth2')throw new BadRequestException('OAuth integrations must use the OAuth flow');
    if(integration.lifecycle==='planned'||!new Set(['google-ads','ga4','search-console','meta-ads','tiktok-ads']).has(integration.slug))throw new BadRequestException('Integration adapter is not available yet');

    const handle=randomUUID();
    const encrypted=encryptJson({...input.credentials,provider:integration.slug});
    return this.db.transaction(async query=>{
      await query(
        `insert into private.integration_credentials(handle,agency_id,user_id,provider,ciphertext,iv,tag,key_version)
         values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [handle,agencyId,userId,integration.slug,encrypted.ciphertext,encrypted.iv,encrypted.tag,encrypted.keyVersion],
      );
      const account=await query<any>(
        `insert into public.data_source_accounts(agency_id,integration_id,label,credential_handle,external_account_id,status,created_by)
         values($1,$2,$3,$4,$5,'connected',$6)
         on conflict(agency_id,integration_id,external_account_id)
         do update set credential_handle=excluded.credential_handle,label=excluded.label,status='connected',updated_at=now()
         returning id`,
        [agencyId,integrationId,label,handle,externalIdentifier,userId],
      );
      const source=await query<any>(
        `insert into public.data_sources(agency_id,client_id,integration_id,account_id,label,external_identifier,status,created_by)
         values($1,$2,$3,$4,$5,$6,'connected',$7)
         on conflict(client_id,integration_id,external_identifier)
         do update set account_id=excluded.account_id,label=excluded.label,status='connected',sync_error=null,
           settings=coalesce(public.data_sources.settings,'{}'::jsonb)-'paused'-'disconnected',updated_at=now()
         returning id`,
        [agencyId,clientId,integrationId,account.rows[0].id,label,externalIdentifier,userId],
      );
      return {dataSourceId:source.rows[0].id,accountId:account.rows[0].id,handle};
    });
  }

  async enqueueSync(userId:string,dataSourceId:string,input:SyncInput={}){
    const source=await this.sourceForUser(userId,dataSourceId);
    if(source.settings?.paused)throw new BadRequestException('Data source is paused');
    if(source.status==='disconnected'||source.settings?.disconnected)throw new BadRequestException('Data source is disconnected');
    const defaults=defaultPeriod();
    const periodFrom=input.periodFrom?isoDate(input.periodFrom,'periodFrom'):defaults.periodFrom;
    const periodTo=input.periodTo?isoDate(input.periodTo,'periodTo'):defaults.periodTo;
    if(periodTo<periodFrom)throw new BadRequestException('periodTo must be on or after periodFrom');
    const job=await this.db.query<any>(
      `insert into public.sync_jobs(agency_id,data_source_id,period_from,period_to,state,priority,payload,run_after)
       values($1,$2,$3,$4,'queued',25,$5::jsonb,now())
       returning id,state,period_from,period_to,created_at`,
      [source.agency_id,source.id,periodFrom,periodTo,JSON.stringify({trigger:'manual',requestedBy:userId})],
    );
    await this.db.query(
      `update public.data_sources set status='syncing',sync_error=null,updated_at=now() where id=$1`,
      [source.id],
    );
    return job.rows[0];
  }

  async setStatus(userId:string,dataSourceId:string,action:ConnectionAction){
    const source=await this.sourceForUser(userId,dataSourceId);
    if(!['pause','resume','disconnect'].includes(action))throw new BadRequestException('Unsupported connection action');

    if(action==='pause'){
      return this.db.transaction(async query=>{
        await query(
          `update public.data_sources
           set status='disconnected',settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{paused}','true'::jsonb,true),updated_at=now()
           where id=$1`,
          [source.id],
        );
        await query(
          `update public.sync_jobs set state='cancelled',updated_at=now()
           where data_source_id=$1 and state='queued'`,
          [source.id],
        );
        return {status:'paused'};
      });
    }

    if(action==='resume'){
      await this.db.query(
        `update public.data_sources
         set status='connected',settings=(coalesce(settings,'{}'::jsonb)-'paused'-'disconnected'),sync_error=null,updated_at=now()
         where id=$1`,
        [source.id],
      );
      return {status:'connected'};
    }

    return this.db.transaction(async query=>{
      await query(
        `update public.data_sources
         set status='disconnected',settings=jsonb_set(coalesce(settings,'{}'::jsonb)-'paused','{disconnected}','true'::jsonb,true),updated_at=now()
         where id=$1`,
        [source.id],
      );
      await query(
        `update public.sync_jobs set state='cancelled',updated_at=now()
         where data_source_id=$1 and state='queued'`,
        [source.id],
      );
      if(source.account_id){
        const active=await query(
          `select 1 from public.data_sources
           where account_id=$1 and id<>$2 and status in ('connected','syncing','error') limit 1`,
          [source.account_id,source.id],
        );
        if(!active.rowCount){
          await query(`update public.data_source_accounts set status='disconnected',updated_at=now() where id=$1`,[source.account_id]);
          if(source.credential_handle)await query(`update private.integration_credentials set revoked_at=coalesce(revoked_at,now()),updated_at=now() where handle=$1`,[source.credential_handle]);
        }
      }
      return {status:'disconnected'};
    });
  }

  async remove(userId:string,dataSourceId:string){
    const source=await this.sourceForUser(userId,dataSourceId);
    return this.db.transaction(async query=>{
      await query(`delete from public.data_sources where id=$1`,[source.id]);
      if(source.account_id){
        const remaining=await query(`select 1 from public.data_sources where account_id=$1 limit 1`,[source.account_id]);
        if(!remaining.rowCount){
          if(source.credential_handle)await query(`update private.integration_credentials set revoked_at=coalesce(revoked_at,now()),updated_at=now() where handle=$1`,[source.credential_handle]);
          await query(`delete from public.data_source_accounts where id=$1`,[source.account_id]);
        }
      }
      return {deleted:true};
    });
  }

  async revokeAccount(userId:string,accountId:string){
    const result=await this.db.query<any>(
      `select account.id,account.agency_id,account.credential_handle
       from public.data_source_accounts account where account.id=$1`,
      [accountId],
    );
    const account=result.rows[0];
    if(!account)throw new NotFoundException('Agency connection not found');
    await this.assertAccess(userId,account.agency_id);
    return this.db.transaction(async query=>{
      await query(
        `update public.sync_jobs set state='cancelled',updated_at=now()
         where state='queued' and data_source_id in(select id from public.data_sources where account_id=$1)`,
        [account.id],
      );
      await query(
        `update public.data_sources
         set status='disconnected',settings=jsonb_set(coalesce(settings,'{}'::jsonb)-'paused','{disconnected}','true'::jsonb,true),updated_at=now()
         where account_id=$1`,
        [account.id],
      );
      await query(`update public.data_source_accounts set status='disconnected',updated_at=now() where id=$1`,[account.id]);
      await query(`update private.integration_credentials set revoked_at=coalesce(revoked_at,now()),updated_at=now() where handle=$1`,[account.credential_handle]);
      return {revoked:true};
    });
  }
}
