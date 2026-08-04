begin;

insert into public.permission_registry(key,module,description,risk_level)
values ('tenant.read','multi-tenancy','Read the current tenant context and tenant-scoped resources','standard')
on conflict(key) do update set module=excluded.module,description=excluded.description,risk_level=excluded.risk_level,updated_at=now();

create or replace function private.has_agency_scope(target_agency_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.agency_memberships m
    where m.agency_id=target_agency_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and m.role in ('admin','staff')
  );
$$;

create or replace function private.has_agency_permission(target_agency_id uuid,required_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.agency_memberships m
    where m.agency_id=target_agency_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and (
        m.role='admin'
        or (m.role='staff' and ('*'=any(m.permissions) or required_permission=any(m.permissions)))
      )
  );
$$;

create or replace function private.has_client_permission(target_client_id uuid,required_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.clients c
    join public.client_users cu on cu.client_id=c.id and cu.user_id=(select auth.uid())
    join public.agency_memberships m on m.agency_id=c.agency_id and m.user_id=cu.user_id and m.status='active'
    where c.id=target_client_id
      and ('*'=any(cu.permissions) or required_permission=any(cu.permissions))
  );
$$;

create or replace function private.can_access_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.clients c
    join public.agency_memberships m
      on m.agency_id=c.agency_id
     and m.user_id=(select auth.uid())
     and m.status='active'
    where c.id=target_client_id
      and (
        m.role in ('admin','staff')
        or exists(
          select 1 from public.client_users cu
          where cu.client_id=c.id and cu.user_id=m.user_id
        )
      )
  );
$$;

revoke all on function private.has_agency_scope(uuid) from public,anon;
revoke all on function private.has_agency_permission(uuid,text) from public,anon;
revoke all on function private.has_client_permission(uuid,text) from public,anon;
revoke all on function private.can_access_client(uuid) from public,anon;
grant usage on schema private to authenticated,service_role;
grant execute on function private.has_agency_scope(uuid),private.has_agency_permission(uuid,text),private.has_client_permission(uuid,text),private.can_access_client(uuid) to authenticated,service_role;

drop policy if exists clients_insert_member on public.clients;
drop policy if exists clients_update_member on public.clients;
drop policy if exists clients_delete_admin on public.clients;
drop policy if exists clients_insert_authorized on public.clients;
drop policy if exists clients_update_authorized on public.clients;
drop policy if exists clients_delete_authorized on public.clients;
create policy clients_insert_authorized on public.clients for insert to authenticated
with check(private.has_agency_permission(agency_id,'clients.manage'));
create policy clients_update_authorized on public.clients for update to authenticated
using(private.has_agency_permission(agency_id,'clients.manage'))
with check(private.has_agency_permission(agency_id,'clients.manage'));
create policy clients_delete_authorized on public.clients for delete to authenticated
using(private.has_agency_permission(agency_id,'clients.manage'));

drop policy if exists activity_select_member on public.activity_log;
drop policy if exists activity_insert_member on public.activity_log;
drop policy if exists activity_select_tenant on public.activity_log;
drop policy if exists activity_insert_tenant on public.activity_log;
create policy activity_select_tenant on public.activity_log for select to authenticated
using(private.has_agency_scope(agency_id) or (client_id is not null and private.can_access_client(client_id)));
create policy activity_insert_tenant on public.activity_log for insert to authenticated
with check(user_id=(select auth.uid()) and (private.has_agency_scope(agency_id) or (client_id is not null and private.can_access_client(client_id))));

drop policy if exists data_source_accounts_read on public.data_source_accounts;
create policy data_source_accounts_read on public.data_source_accounts for select to authenticated
using(private.has_agency_scope(agency_id));

drop policy if exists sync_jobs_read on public.sync_jobs;
create policy sync_jobs_read on public.sync_jobs for select to authenticated
using(exists(select 1 from public.data_sources ds where ds.id=sync_jobs.data_source_id and ds.agency_id=sync_jobs.agency_id and private.can_access_client(ds.client_id)));

drop policy if exists sync_runs_read on public.sync_runs;
create policy sync_runs_read on public.sync_runs for select to authenticated
using(exists(select 1 from public.data_sources ds where ds.id=sync_runs.data_source_id and ds.agency_id=sync_runs.agency_id and private.can_access_client(ds.client_id)));

do $$
begin
  if not exists(select 1 from pg_constraint where conname='activity_log_client_agency_fkey') then
    alter table public.activity_log add constraint activity_log_client_agency_fkey
      foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete set null(client_id);
  end if;
  if not exists(select 1 from pg_constraint where conname='user_preferences_client_agency_fkey') then
    alter table public.user_preferences add constraint user_preferences_client_agency_fkey
      foreign key(active_client_id,active_agency_id) references public.clients(id,agency_id) on delete set null(active_client_id);
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_recent_items_client_agency_fkey') then
    alter table public.workspace_recent_items add constraint workspace_recent_items_client_agency_fkey
      foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete set null(client_id);
  end if;
  if not exists(select 1 from pg_constraint where conname='oauth_states_client_agency_fkey') then
    alter table private.oauth_states add constraint oauth_states_client_agency_fkey
      foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete cascade;
  end if;
  if not exists(select 1 from pg_constraint where conname='sync_jobs_id_agency_source_key') then
    alter table public.sync_jobs add constraint sync_jobs_id_agency_source_key unique(id,agency_id,data_source_id);
  end if;
  if not exists(select 1 from pg_constraint where conname='sync_runs_job_agency_source_fkey') then
    alter table public.sync_runs add constraint sync_runs_job_agency_source_fkey
      foreign key(sync_job_id,agency_id,data_source_id) references public.sync_jobs(id,agency_id,data_source_id) on delete cascade;
  end if;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tenant-assets','tenant-assets',false,52428800,null)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

create or replace function private.tenant_storage_path_is_valid(object_name text)
returns boolean language sql immutable strict security invoker set search_path=''
as $$
  select length(object_name) between 1 and 1024
    and object_name !~ '[[:cntrl:]]'
    and object_name !~ E'\\\\'
    and object_name !~ '(^/|/$|//)'
    and object_name !~ '(^|/)(\.{1,2})(/|$)'
    and split_part(object_name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (
      (split_part(object_name,'/',2)='agency'
       and split_part(object_name,'/',3) in ('branding','reports','exports','uploads')
       and array_length(string_to_array(object_name,'/'),1)>=4)
      or
      (split_part(object_name,'/',2)='clients'
       and split_part(object_name,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and split_part(object_name,'/',4) in ('branding','reports','exports','uploads')
       and array_length(string_to_array(object_name,'/'),1)>=5)
    );
$$;

create or replace function private.tenant_storage_agency_id(object_name text)
returns uuid language sql immutable strict security invoker set search_path=''
as $$ select case when private.tenant_storage_path_is_valid(object_name) then split_part(object_name,'/',1)::uuid else null end; $$;

create or replace function private.tenant_storage_client_id(object_name text)
returns uuid language sql immutable strict security invoker set search_path=''
as $$ select case when private.tenant_storage_path_is_valid(object_name) and split_part(object_name,'/',2)='clients' then split_part(object_name,'/',3)::uuid else null end; $$;

create or replace function private.tenant_storage_category(object_name text)
returns text language sql immutable strict security invoker set search_path=''
as $$
  select case when not private.tenant_storage_path_is_valid(object_name) then null
    when split_part(object_name,'/',2)='agency' then split_part(object_name,'/',3)
    else split_part(object_name,'/',4) end;
$$;

create or replace function private.can_read_tenant_storage(object_name text)
returns boolean language sql stable security definer set search_path=''
as $$
  with path as(
    select private.tenant_storage_path_is_valid(object_name) valid,
      private.tenant_storage_agency_id(object_name) agency_id,
      private.tenant_storage_client_id(object_name) client_id,
      private.tenant_storage_category(object_name) category,
      split_part(object_name,'/',2) scope
  )
  select case
    when not valid then false
    when scope='agency' and category='branding' then private.is_agency_member(agency_id)
    when scope='agency' then private.has_agency_scope(agency_id)
    when scope='clients' then exists(select 1 from public.clients c where c.id=client_id and c.agency_id=agency_id and private.can_access_client(c.id))
    else false end from path;
$$;

create or replace function private.can_write_tenant_storage(object_name text)
returns boolean language sql stable security definer set search_path=''
as $$
  with path as(
    select private.tenant_storage_path_is_valid(object_name) valid,
      private.tenant_storage_agency_id(object_name) agency_id,
      private.tenant_storage_client_id(object_name) client_id,
      private.tenant_storage_category(object_name) category,
      split_part(object_name,'/',2) scope
  ),required as(
    select *,case category when 'branding' then 'branding.manage' when 'reports' then 'reports.manage' when 'exports' then 'reports.manage' else 'clients.manage' end permission from path
  )
  select case
    when not valid then false
    when scope='agency' then private.has_agency_permission(agency_id,permission)
    when scope='clients' then exists(
      select 1 from public.clients c
      where c.id=client_id and c.agency_id=agency_id and private.can_access_client(c.id)
        and (private.has_agency_permission(agency_id,permission) or private.has_client_permission(c.id,'client.storage.write'))
    )
    else false end from required;
$$;

revoke all on function private.tenant_storage_path_is_valid(text),private.tenant_storage_agency_id(text),private.tenant_storage_client_id(text),private.tenant_storage_category(text),private.can_read_tenant_storage(text),private.can_write_tenant_storage(text) from public,anon;
grant execute on function private.tenant_storage_path_is_valid(text),private.tenant_storage_agency_id(text),private.tenant_storage_client_id(text),private.tenant_storage_category(text),private.can_read_tenant_storage(text),private.can_write_tenant_storage(text) to authenticated,service_role;

drop policy if exists tenant_assets_select on storage.objects;
drop policy if exists tenant_assets_insert on storage.objects;
drop policy if exists tenant_assets_update on storage.objects;
drop policy if exists tenant_assets_delete on storage.objects;
create policy tenant_assets_select on storage.objects for select to authenticated
using(bucket_id='tenant-assets' and private.can_read_tenant_storage(name));
create policy tenant_assets_insert on storage.objects for insert to authenticated
with check(bucket_id='tenant-assets' and private.can_write_tenant_storage(name));
create policy tenant_assets_update on storage.objects for update to authenticated
using(bucket_id='tenant-assets' and private.can_write_tenant_storage(name))
with check(bucket_id='tenant-assets' and private.can_write_tenant_storage(name));
create policy tenant_assets_delete on storage.objects for delete to authenticated
using(bucket_id='tenant-assets' and private.can_write_tenant_storage(name));
grant select,insert,update,delete on storage.objects to authenticated;
revoke all on storage.objects from anon;

alter table public.agencies force row level security;
alter table public.user_profiles force row level security;
alter table public.agency_memberships force row level security;
alter table public.clients force row level security;
alter table public.client_users force row level security;
alter table public.activity_log force row level security;
alter table public.agency_entitlement_overrides force row level security;
alter table public.agency_feature_flags force row level security;
alter table public.user_preferences force row level security;
alter table public.audit_logs force row level security;
alter table public.workspace_recent_items force row level security;
alter table public.data_source_accounts force row level security;
alter table public.data_sources force row level security;
alter table public.sync_jobs force row level security;
alter table public.sync_runs force row level security;
alter table public.marketing_daily_metrics force row level security;
alter table public.dashboards force row level security;
alter table public.dashboard_sections force row level security;
alter table public.widgets force row level security;

revoke all on function private.effective_entitlements(uuid) from public,anon;
revoke all on function private.effective_feature_flags(uuid) from public,anon;
revoke all on function private.platform_core_write_audit(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function private.platform_core_touch_updated_at() from public,anon,authenticated;
grant execute on function private.effective_entitlements(uuid),private.effective_feature_flags(uuid) to authenticated,service_role;
grant execute on function private.platform_core_write_audit(uuid,text,text,text,text,jsonb) to service_role;

revoke all on function public.workspace_bootstrap(uuid),public.set_workspace_context(uuid,uuid),public.record_audit_event(uuid,text,text,text,text,jsonb),public.update_agency_branding(uuid,jsonb),public.set_agency_feature_flag(uuid,text,boolean,jsonb),public.update_workspace_preferences(text,text,text,jsonb),public.record_workspace_recent_item(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.workspace_bootstrap(uuid),public.set_workspace_context(uuid,uuid),public.record_audit_event(uuid,text,text,text,text,jsonb),public.update_agency_branding(uuid,jsonb),public.set_agency_feature_flag(uuid,text,boolean,jsonb),public.update_workspace_preferences(text,text,text,jsonb),public.record_workspace_recent_item(uuid,uuid,text,text,text,text) to authenticated,service_role;

commit;
