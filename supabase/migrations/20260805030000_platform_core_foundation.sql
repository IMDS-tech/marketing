begin;

create table if not exists public.permission_registry (
  key text primary key,
  module text not null,
  description text not null default '',
  risk_level text not null default 'standard' check (risk_level in ('standard','sensitive','critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  plan text primary key,
  entitlements jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_entitlement_overrides (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  entitlements jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  description text not null default '',
  default_enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_feature_flags (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, flag_key)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_agency_id uuid references public.agencies(id) on delete set null,
  active_client_id uuid references public.clients(id) on delete set null,
  language text not null default 'ru',
  timezone text not null default 'Asia/Almaty',
  theme text not null default 'system' check (theme in ('system','light','dark')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  agency_id uuid references public.agencies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agency_feature_flags_flag_idx on public.agency_feature_flags(flag_key);
create index if not exists user_preferences_agency_idx on public.user_preferences(active_agency_id);
create index if not exists user_preferences_client_idx on public.user_preferences(active_client_id);
create index if not exists audit_logs_agency_created_idx on public.audit_logs(agency_id, created_at desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

create or replace function private.platform_core_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.platform_core_write_audit(
  target_agency_id uuid,
  target_event_type text,
  target_action text,
  target_entity_type text default null,
  target_entity_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id bigint;
begin
  insert into public.audit_logs(
    agency_id,user_id,event_type,action,entity_type,entity_id,metadata
  ) values (
    target_agency_id,
    (select auth.uid()),
    target_event_type,
    target_action,
    target_entity_type,
    target_entity_id,
    coalesce(target_metadata,'{}'::jsonb)
  ) returning id into audit_id;
  return audit_id;
end;
$$;

create or replace function private.effective_entitlements(target_agency_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'plan', a.plan,
      'trialEndsAt', a.trial_ends_at,
      'entitlements', coalesce(p.entitlements,'{}'::jsonb) || coalesce(o.entitlements,'{}'::jsonb),
      'limits', coalesce(p.limits,'{}'::jsonb) || coalesce(o.limits,'{}'::jsonb)
    )
    from public.agencies a
    left join public.plan_entitlements p on p.plan = a.plan
    left join public.agency_entitlement_overrides o on o.agency_id = a.id
    where a.id = target_agency_id
      and private.is_agency_member(a.id)
  ), '{}'::jsonb);
$$;

create or replace function private.effective_feature_flags(target_agency_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_agency_member(target_agency_id) then
    coalesce(jsonb_object_agg(
      f.key,
      jsonb_build_object(
        'enabled', case
          when af.enabled is not null then af.enabled
          when f.default_enabled then true
          when f.rollout_percentage > 0 then
            mod(
              hashtextextended(
                coalesce((select auth.uid())::text,'anonymous') || ':' || f.key,
                0
              ) & 9223372036854775807,
              100
            ) < f.rollout_percentage
          else false
        end,
        'config', coalesce(af.config,'{}'::jsonb),
        'description', f.description
      )
      order by f.key
    ), '{}'::jsonb)
  else '{}'::jsonb end
  from public.feature_flags f
  left join public.agency_feature_flags af
    on af.agency_id = target_agency_id and af.flag_key = f.key;
$$;

create or replace function public.record_audit_event(
  target_agency_id uuid,
  target_event_type text,
  target_action text,
  target_entity_type text default null,
  target_entity_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_agency_member(target_agency_id) then
    raise exception 'AGENCY_ACCESS_DENIED';
  end if;
  if length(trim(coalesce(target_event_type,''))) = 0 or length(trim(coalesce(target_action,''))) = 0 then
    raise exception 'AUDIT_EVENT_INVALID';
  end if;
  return private.platform_core_write_audit(
    target_agency_id,target_event_type,target_action,target_entity_type,target_entity_id,target_metadata
  );
end;
$$;

create or replace function public.set_workspace_context(
  target_agency_id uuid,
  target_client_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_agency_member(target_agency_id) then
    raise exception 'AGENCY_ACCESS_DENIED';
  end if;
  if target_client_id is not null and not exists(
    select 1 from public.clients c
    where c.id = target_client_id
      and c.agency_id = target_agency_id
      and private.can_access_client(c.id)
  ) then
    raise exception 'CLIENT_ACCESS_DENIED';
  end if;

  insert into public.user_preferences(user_id,active_agency_id,active_client_id)
  values ((select auth.uid()),target_agency_id,target_client_id)
  on conflict (user_id) do update
  set active_agency_id = excluded.active_agency_id,
      active_client_id = excluded.active_client_id,
      updated_at = now();

  perform private.platform_core_write_audit(
    target_agency_id,
    'workspace.context_changed',
    'switch',
    'client',
    target_client_id::text,
    jsonb_build_object('activeAgencyId',target_agency_id,'activeClientId',target_client_id)
  );

  return jsonb_build_object('activeAgencyId',target_agency_id,'activeClientId',target_client_id);
end;
$$;

create or replace function public.update_agency_branding(
  target_agency_id uuid,
  next_branding jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  primary_color text;
begin
  if not private.has_agency_permission(target_agency_id,'branding.manage') then
    raise exception 'PERMISSION_DENIED';
  end if;
  if jsonb_typeof(coalesce(next_branding,'{}'::jsonb)) <> 'object' then
    raise exception 'BRANDING_INVALID';
  end if;
  primary_color := next_branding->>'primaryColor';
  if primary_color is not null and primary_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'BRANDING_COLOR_INVALID';
  end if;

  update public.agencies
  set branding = branding || coalesce(next_branding,'{}'::jsonb),
      updated_at = now()
  where id = target_agency_id
  returning branding into result;

  perform private.platform_core_write_audit(
    target_agency_id,'branding.updated','update','agency',target_agency_id::text,
    jsonb_build_object('changedKeys',coalesce((select jsonb_agg(key) from jsonb_object_keys(coalesce(next_branding,'{}'::jsonb)) key),'[]'::jsonb))
  );
  return result;
end;
$$;

create or replace function public.set_agency_feature_flag(
  target_agency_id uuid,
  target_flag_key text,
  target_enabled boolean,
  target_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_agency_permission(target_agency_id,'features.manage') then
    raise exception 'PERMISSION_DENIED';
  end if;
  if not exists(select 1 from public.feature_flags f where f.key=target_flag_key) then
    raise exception 'FEATURE_FLAG_NOT_FOUND';
  end if;

  insert into public.agency_feature_flags(agency_id,flag_key,enabled,config,updated_by)
  values(target_agency_id,target_flag_key,target_enabled,coalesce(target_config,'{}'::jsonb),(select auth.uid()))
  on conflict(agency_id,flag_key) do update
  set enabled=excluded.enabled,
      config=excluded.config,
      updated_by=excluded.updated_by,
      updated_at=now();

  perform private.platform_core_write_audit(
    target_agency_id,'feature_flag.updated','update','feature_flag',target_flag_key,
    jsonb_build_object('enabled',target_enabled)
  );
  return private.effective_feature_flags(target_agency_id)->target_flag_key;
end;
$$;

insert into public.permission_registry(key,module,description,risk_level) values
('workspace.read','workspace','Read workspace bootstrap and tenant context','standard'),
('permissions.read','permissions','Read roles and effective permissions','sensitive'),
('permissions.manage','permissions','Manage memberships, roles and permission overrides','critical'),
('billing.read','entitlements','Read plan, limits and entitlements','sensitive'),
('billing.manage','entitlements','Manage plan and entitlement overrides','critical'),
('features.read','feature-flags','Read effective feature flags','standard'),
('features.manage','feature-flags','Manage agency feature-flag overrides','critical'),
('branding.read','branding','Read agency and client branding','standard'),
('branding.manage','branding','Update agency branding and white-label configuration','sensitive'),
('audit.read','audit','Read tenant audit events','critical'),
('clients.read','clients','Read clients assigned to the user','standard'),
('clients.manage','clients','Create and update agency clients','sensitive'),
('integrations.read','integrations','Read integrations and data-source health','standard'),
('integrations.manage','integrations','Connect, update and remove data sources','critical'),
('analytics.read','advertising-analytics','Read tenant-scoped marketing analytics','standard'),
('dashboards.read','dashboards','Read dashboards','standard'),
('dashboards.manage','dashboards','Create and update dashboards','sensitive'),
('reports.read','reports','Read reports and dashboards','standard'),
('reports.manage','reports','Create and update reports and dashboard layouts','sensitive')
on conflict(key) do update set
  module=excluded.module,
  description=excluded.description,
  risk_level=excluded.risk_level,
  updated_at=now();

insert into public.plan_entitlements(plan,entitlements,limits) values
('trial',
 '{"clients":true,"integrations":true,"dashboards":true,"reports":true,"ai":false,"clientPortal":false,"api":false}'::jsonb,
 '{"clients":3,"users":3,"integrationsPerClient":3,"reportsPerMonth":10,"storageGb":1,"syncFrequencyMinutes":1440,"dataRetentionDays":90,"aiRequestsPerMonth":0}'::jsonb),
('starter',
 '{"clients":true,"integrations":true,"dashboards":true,"reports":true,"ai":false,"clientPortal":false,"api":false}'::jsonb,
 '{"clients":10,"users":5,"integrationsPerClient":5,"reportsPerMonth":50,"storageGb":5,"syncFrequencyMinutes":360,"dataRetentionDays":365,"aiRequestsPerMonth":0}'::jsonb),
('growth',
 '{"clients":true,"integrations":true,"dashboards":true,"reports":true,"ai":true,"clientPortal":true,"api":true}'::jsonb,
 '{"clients":50,"users":20,"integrationsPerClient":15,"reportsPerMonth":500,"storageGb":50,"syncFrequencyMinutes":60,"dataRetentionDays":730,"aiRequestsPerMonth":2000}'::jsonb),
('scale',
 '{"clients":true,"integrations":true,"dashboards":true,"reports":true,"ai":true,"clientPortal":true,"api":true,"whiteLabel":true}'::jsonb,
 '{"clients":-1,"users":-1,"integrationsPerClient":-1,"reportsPerMonth":-1,"storageGb":500,"syncFrequencyMinutes":15,"dataRetentionDays":1825,"aiRequestsPerMonth":20000}'::jsonb)
on conflict(plan) do update set
  entitlements=excluded.entitlements,
  limits=excluded.limits,
  updated_at=now();

insert into public.feature_flags(key,description,default_enabled,rollout_percentage,metadata) values
('platform_core_v2','Expanded workspace context, entitlements, feature flags and audit.',true,100,'{"owner":"platform"}'::jsonb),
('client_portal','Client-facing portal application.',false,0,'{"owner":"portal"}'::jsonb),
('agency_ai','AgencyAI assistant and generated insights.',false,0,'{"owner":"ai"}'::jsonb),
('custom_metrics','Formula-based reusable metrics.',false,0,'{"owner":"analytics"}'::jsonb),
('report_scheduler','Scheduled report generation and delivery.',false,0,'{"owner":"reports"}'::jsonb),
('developer_api','API keys, webhooks, playground and MCP.',false,0,'{"owner":"developer-platform"}'::jsonb)
on conflict(key) do update set
  description=excluded.description,
  default_enabled=excluded.default_enabled,
  rollout_percentage=excluded.rollout_percentage,
  metadata=excluded.metadata,
  updated_at=now();

alter table public.permission_registry enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.agency_entitlement_overrides enable row level security;
alter table public.feature_flags enable row level security;
alter table public.agency_feature_flags enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.permission_registry from anon;
revoke all on public.plan_entitlements from anon;
revoke all on public.agency_entitlement_overrides from anon;
revoke all on public.feature_flags from anon;
revoke all on public.agency_feature_flags from anon;
revoke all on public.user_preferences from anon;
revoke all on public.audit_logs from anon;

revoke all on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.permission_registry,public.plan_entitlements,public.feature_flags to authenticated;
grant select,insert,update,delete on public.agency_entitlement_overrides,public.agency_feature_flags,public.user_preferences to authenticated;

drop policy if exists permission_registry_read on public.permission_registry;
create policy permission_registry_read on public.permission_registry
for select to authenticated using (true);

drop policy if exists plan_entitlements_read on public.plan_entitlements;
create policy plan_entitlements_read on public.plan_entitlements
for select to authenticated using (true);

drop policy if exists agency_entitlement_overrides_read on public.agency_entitlement_overrides;
create policy agency_entitlement_overrides_read on public.agency_entitlement_overrides
for select to authenticated using (private.is_agency_member(agency_id));
drop policy if exists agency_entitlement_overrides_insert on public.agency_entitlement_overrides;
create policy agency_entitlement_overrides_insert on public.agency_entitlement_overrides
for insert to authenticated with check (private.has_agency_permission(agency_id,'billing.manage'));
drop policy if exists agency_entitlement_overrides_update on public.agency_entitlement_overrides;
create policy agency_entitlement_overrides_update on public.agency_entitlement_overrides
for update to authenticated using (private.has_agency_permission(agency_id,'billing.manage'))
with check (private.has_agency_permission(agency_id,'billing.manage'));
drop policy if exists agency_entitlement_overrides_delete on public.agency_entitlement_overrides;
create policy agency_entitlement_overrides_delete on public.agency_entitlement_overrides
for delete to authenticated using (private.has_agency_permission(agency_id,'billing.manage'));

drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags
for select to authenticated using (true);

drop policy if exists agency_feature_flags_read on public.agency_feature_flags;
create policy agency_feature_flags_read on public.agency_feature_flags
for select to authenticated using (private.is_agency_member(agency_id));
drop policy if exists agency_feature_flags_insert on public.agency_feature_flags;
create policy agency_feature_flags_insert on public.agency_feature_flags
for insert to authenticated with check (private.has_agency_permission(agency_id,'features.manage'));
drop policy if exists agency_feature_flags_update on public.agency_feature_flags;
create policy agency_feature_flags_update on public.agency_feature_flags
for update to authenticated using (private.has_agency_permission(agency_id,'features.manage'))
with check (private.has_agency_permission(agency_id,'features.manage'));
drop policy if exists agency_feature_flags_delete on public.agency_feature_flags;
create policy agency_feature_flags_delete on public.agency_feature_flags
for delete to authenticated using (private.has_agency_permission(agency_id,'features.manage'));

drop policy if exists user_preferences_read on public.user_preferences;
create policy user_preferences_read on public.user_preferences
for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists user_preferences_insert on public.user_preferences;
create policy user_preferences_insert on public.user_preferences
for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists user_preferences_update on public.user_preferences;
create policy user_preferences_update on public.user_preferences
for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists user_preferences_delete on public.user_preferences;
create policy user_preferences_delete on public.user_preferences
for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
for select to authenticated using (
  agency_id is not null and private.has_agency_permission(agency_id,'audit.read')
);

drop trigger if exists permission_registry_touch on public.permission_registry;
create trigger permission_registry_touch before update on public.permission_registry
for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists plan_entitlements_touch on public.plan_entitlements;
create trigger plan_entitlements_touch before update on public.plan_entitlements
for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists agency_entitlement_overrides_touch on public.agency_entitlement_overrides;
create trigger agency_entitlement_overrides_touch before update on public.agency_entitlement_overrides
for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists feature_flags_touch on public.feature_flags;
create trigger feature_flags_touch before update on public.feature_flags
for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists agency_feature_flags_touch on public.agency_feature_flags;
create trigger agency_feature_flags_touch before update on public.agency_feature_flags
for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences
for each row execute function private.platform_core_touch_updated_at();

create or replace function public.workspace_bootstrap(target_agency_id uuid default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
with me as (
  select (select auth.uid()) as id,
         coalesce(auth.jwt()->>'email', '') as email,
         coalesce(p.name, split_part(coalesce(auth.jwt()->>'email', ''), '@', 1)) as name,
         p.avatar_url
  from (select 1) seed
  left join public.user_profiles p on p.user_id = (select auth.uid())
),
prefs as (
  select up.* from public.user_preferences up where up.user_id=(select auth.uid())
),
my_agencies as (
  select a.id,a.name,a.slug,a.created_at,a.plan,a.trial_ends_at,m.role,m.permissions,a.branding
  from public.agencies a
  join public.agency_memberships m on m.agency_id=a.id
  where m.user_id=(select auth.uid()) and m.status='active'
  order by a.created_at,a.id
),
active_agency as (
  select * from my_agencies
  order by case when id=coalesce(target_agency_id,(select active_agency_id from prefs)) then 0 else 1 end,
           created_at,id
  limit 1
),
my_clients as (
  select c.* from public.clients c
  where c.agency_id=(select id from active_agency)
    and private.can_access_client(c.id)
  order by c.created_at desc
),
active_client as (
  select c.id from my_clients c
  order by case when c.id=(select active_client_id from prefs) then 0 else 1 end,c.created_at desc,c.id
  limit 1
)
select jsonb_build_object(
  'currentUser',(select jsonb_build_object('id',id,'email',email,'name',name,'avatarUrl',avatar_url) from me),
  'agencies',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding,
    'plan',plan,'trialEndsAt',trial_ends_at
  ) order by created_at,id) from my_agencies),'[]'::jsonb),
  'activeAgency',(select jsonb_build_object(
    'id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding,
    'plan',plan,'trialEndsAt',trial_ends_at
  ) from active_agency),
  'clients',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'company',company,'url',url,'status',status,'createdAt',created_at,'logoUrl',logo_url,
    'brandColor',brand_color,'connectedSources',connected_sources_count
  ) order by created_at desc) from my_clients),'[]'::jsonb),
  'activeClientId',(select id from active_client),
  'entitlements',private.effective_entitlements((select id from active_agency)),
  'featureFlags',private.effective_feature_flags((select id from active_agency)),
  'preferences',coalesce((select jsonb_build_object(
    'language',language,'timezone',timezone,'theme',theme,'settings',settings
  ) from prefs),jsonb_build_object('language','ru','timezone','Asia/Almaty','theme','system','settings','{}'::jsonb))
);
$$;

revoke all on function public.record_audit_event(uuid,text,text,text,text,jsonb) from public;
revoke all on function public.set_workspace_context(uuid,uuid) from public;
revoke all on function public.update_agency_branding(uuid,jsonb) from public;
revoke all on function public.set_agency_feature_flag(uuid,text,boolean,jsonb) from public;
grant execute on function public.record_audit_event(uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.set_workspace_context(uuid,uuid) to authenticated;
grant execute on function public.update_agency_branding(uuid,jsonb) to authenticated;
grant execute on function public.set_agency_feature_flag(uuid,text,boolean,jsonb) to authenticated;

commit;
