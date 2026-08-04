begin;

do $$ begin create type public.integration_auth_type as enum ('oauth2','api_key','basic','file'); exception when duplicate_object then null; end $$;
do $$ begin create type public.integration_lifecycle as enum ('stable','beta','planned'); exception when duplicate_object then null; end $$;
do $$ begin create type public.data_source_status as enum ('connected','syncing','error','expired','disconnected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sync_job_state as enum ('queued','running','succeeded','failed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.metric_data_type as enum ('int','float','currency','percent','duration'); exception when duplicate_object then null; end $$;
do $$ begin create type public.metric_aggregation as enum ('sum','avg','weighted','last','derived'); exception when duplicate_object then null; end $$;

alter table public.clients add constraint clients_id_agency_unique unique (id,agency_id);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null,
  category text not null check (category in ('analytics','paid_ads','seo','social','ecommerce','email','call_tracking','local','database')),
  icon text,
  auth_type public.integration_auth_type not null,
  is_beta boolean not null default false,
  is_new boolean not null default false,
  is_popular boolean not null default false,
  lifecycle public.integration_lifecycle not null default 'planned',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.data_source_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete restrict,
  label text not null,
  credential_handle text not null,
  external_account_id text,
  status public.data_source_status not null default 'connected',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,agency_id),
  unique (agency_id,integration_id,external_account_id)
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  integration_id uuid not null references public.integrations(id) on delete restrict,
  account_id uuid,
  label text not null,
  external_identifier text not null,
  status public.data_source_status not null default 'connected',
  last_sync_at timestamptz,
  sync_error jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,agency_id),
  unique (client_id,integration_id,external_identifier),
  foreign key (client_id,agency_id) references public.clients(id,agency_id) on delete cascade,
  foreign key (account_id,agency_id) references public.data_source_accounts(id,agency_id) on delete restrict
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  data_source_id uuid not null,
  period_from date not null,
  period_to date not null,
  state public.sync_job_state not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 25),
  priority smallint not null default 100,
  payload jsonb not null default '{}'::jsonb,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_to >= period_from),
  foreign key (data_source_id,agency_id) references public.data_sources(id,agency_id) on delete cascade
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  sync_job_id uuid not null references public.sync_jobs(id) on delete cascade,
  data_source_id uuid not null,
  state public.sync_job_state not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_fetched integer not null default 0 check (rows_fetched >= 0),
  rows_written integer not null default 0 check (rows_written >= 0),
  error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (data_source_id,agency_id) references public.data_sources(id,agency_id) on delete cascade
);

create table public.metric_dictionary (
  metric_key text primary key check (metric_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  description text,
  data_type public.metric_data_type not null,
  aggregation public.metric_aggregation not null,
  format text not null,
  is_derived boolean not null default false,
  formula text,
  dependencies text[] not null default '{}',
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_derived and formula is not null) or (not is_derived and formula is null))
);

create table public.provider_metric_mappings (
  integration_id uuid not null references public.integrations(id) on delete cascade,
  provider_key text not null,
  metric_key text not null references public.metric_dictionary(metric_key) on delete restrict,
  transform jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (integration_id,provider_key)
);

create table public.marketing_daily_metrics (
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,
  entity_type text not null check (entity_type in ('account','campaign','adgroup','ad','keyword','page','country','device','age','gender')),
  entity_id text not null,
  entity_name text,
  metric_date date not null,
  metric_key text not null references public.metric_dictionary(metric_key) on delete restrict,
  value numeric not null,
  dimensions jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  primary key (agency_id,client_id,data_source_id,integration_slug,entity_type,entity_id,metric_date,metric_key),
  foreign key (client_id,agency_id) references public.clients(id,agency_id) on delete cascade,
  foreign key (data_source_id,agency_id) references public.data_sources(id,agency_id) on delete cascade
);

create index data_source_accounts_agency_idx on public.data_source_accounts(agency_id,integration_id);
create index data_source_accounts_created_by_idx on public.data_source_accounts(created_by);
create index data_source_accounts_integration_idx on public.data_source_accounts(integration_id);
create index data_sources_client_idx on public.data_sources(client_id,status);
create index data_sources_agency_idx on public.data_sources(agency_id,integration_id);
create index data_sources_account_agency_idx on public.data_sources(account_id,agency_id);
create index data_sources_client_agency_idx on public.data_sources(client_id,agency_id);
create index data_sources_created_by_idx on public.data_sources(created_by);
create index data_sources_integration_idx on public.data_sources(integration_id);
create index sync_jobs_queue_idx on public.sync_jobs(state,run_after,priority,created_at);
create index sync_jobs_source_idx on public.sync_jobs(data_source_id,created_at desc);
create index sync_jobs_source_agency_idx on public.sync_jobs(data_source_id,agency_id);
create index sync_runs_source_idx on public.sync_runs(data_source_id,started_at desc);
create index sync_runs_source_agency_idx on public.sync_runs(data_source_id,agency_id);
create index sync_runs_job_idx on public.sync_runs(sync_job_id);
create index metrics_client_date_idx on public.marketing_daily_metrics(client_id,metric_date desc,metric_key);
create index metrics_source_date_idx on public.marketing_daily_metrics(data_source_id,metric_date desc);
create index metrics_client_agency_idx on public.marketing_daily_metrics(client_id,agency_id);
create index metrics_source_agency_idx on public.marketing_daily_metrics(data_source_id,agency_id);
create index metrics_metric_key_idx on public.marketing_daily_metrics(metric_key);
create index metrics_dimensions_gin_idx on public.marketing_daily_metrics using gin(dimensions);
create index provider_metric_mappings_metric_idx on public.provider_metric_mappings(metric_key);

create or replace function private.has_agency_permission(target_agency_id uuid, required_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.agency_memberships m
    where m.agency_id=target_agency_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and (m.role='admin' or '*'=any(m.permissions) or required_permission=any(m.permissions))
  );
$$;
revoke all on function private.has_agency_permission(uuid,text) from public;
grant execute on function private.has_agency_permission(uuid,text) to authenticated;

alter table public.integrations enable row level security;
alter table public.data_source_accounts enable row level security;
alter table public.data_sources enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.sync_runs enable row level security;
alter table public.metric_dictionary enable row level security;
alter table public.provider_metric_mappings enable row level security;
alter table public.marketing_daily_metrics enable row level security;

create policy integrations_read on public.integrations for select to authenticated using (true);
create policy data_source_accounts_read on public.data_source_accounts for select to authenticated using (private.is_agency_member(agency_id));
create policy data_source_accounts_insert on public.data_source_accounts for insert to authenticated with check (private.has_agency_permission(agency_id,'integrations.manage'));
create policy data_source_accounts_update on public.data_source_accounts for update to authenticated using (private.has_agency_permission(agency_id,'integrations.manage')) with check (private.has_agency_permission(agency_id,'integrations.manage'));
create policy data_source_accounts_delete on public.data_source_accounts for delete to authenticated using (private.has_agency_permission(agency_id,'integrations.manage'));
create policy data_sources_read on public.data_sources for select to authenticated using (private.can_access_client(client_id));
create policy data_sources_insert on public.data_sources for insert to authenticated with check (private.has_agency_permission(agency_id,'integrations.manage') and private.can_access_client(client_id));
create policy data_sources_update on public.data_sources for update to authenticated using (private.has_agency_permission(agency_id,'integrations.manage')) with check (private.has_agency_permission(agency_id,'integrations.manage') and private.can_access_client(client_id));
create policy data_sources_delete on public.data_sources for delete to authenticated using (private.has_agency_permission(agency_id,'integrations.manage'));
create policy sync_jobs_read on public.sync_jobs for select to authenticated using (private.is_agency_member(agency_id));
create policy sync_jobs_create on public.sync_jobs for insert to authenticated with check (private.has_agency_permission(agency_id,'integrations.manage'));
create policy sync_runs_read on public.sync_runs for select to authenticated using (private.is_agency_member(agency_id));
create policy metric_dictionary_read on public.metric_dictionary for select to authenticated using (true);
create policy provider_metric_mappings_read on public.provider_metric_mappings for select to authenticated using (true);
create policy marketing_daily_metrics_read on public.marketing_daily_metrics for select to authenticated using (private.can_access_client(client_id));

revoke all on public.integrations,public.data_source_accounts,public.data_sources,public.sync_jobs,public.sync_runs,public.metric_dictionary,public.provider_metric_mappings,public.marketing_daily_metrics from anon,authenticated;
grant select on public.integrations,public.metric_dictionary,public.provider_metric_mappings to authenticated;
grant select,insert,update,delete on public.data_source_accounts,public.data_sources to authenticated;
grant select,insert on public.sync_jobs to authenticated;
grant select on public.sync_runs,public.marketing_daily_metrics to authenticated;
grant select,insert,update,delete on public.integrations,public.data_source_accounts,public.data_sources,public.sync_jobs,public.sync_runs,public.metric_dictionary,public.provider_metric_mappings,public.marketing_daily_metrics to service_role;

create view public.marketing_ads with (security_invoker=true) as
select m.agency_id,m.client_id,m.data_source_id,m.metric_date as report_date,
  case m.integration_slug when 'meta-ads' then 'Meta' when 'tiktok-ads' then 'TikTok' when 'google-ads' then 'Google Ads' else m.integration_slug end as platform,
  m.dimensions->>'account_id' as account_id,m.dimensions->>'account_name' as account_name,
  m.dimensions->>'campaign_id' as campaign_id,coalesce(m.dimensions->>'campaign_name',m.entity_name) as campaign_name,
  m.dimensions->>'effective_status' as effective_status,m.dimensions->>'adset_id' as adset_id,m.dimensions->>'adset_name' as adset_name,
  sum(m.value) filter (where m.metric_key='impressions') as impressions,
  sum(m.value) filter (where m.metric_key='clicks') as clicks,
  sum(m.value) filter (where m.metric_key='spend') as spend,
  sum(m.value) filter (where m.metric_key='leads') as leads,
  sum(m.value) filter (where m.metric_key='conversions') as conversions,
  sum(m.value) filter (where m.metric_key='revenue') as revenue,
  sum(m.value) filter (where m.metric_key='video_views') as video_views,
  0::numeric as target_leads,0::numeric as arrived,0::numeric as sales
from public.marketing_daily_metrics m
where m.entity_type in ('campaign','adgroup','ad')
group by m.agency_id,m.client_id,m.data_source_id,m.metric_date,m.integration_slug,
  m.dimensions->>'account_id',m.dimensions->>'account_name',m.dimensions->>'campaign_id',
  coalesce(m.dimensions->>'campaign_name',m.entity_name),m.dimensions->>'effective_status',
  m.dimensions->>'adset_id',m.dimensions->>'adset_name';
revoke all on public.marketing_ads from anon,authenticated;
grant select on public.marketing_ads to authenticated,service_role;

commit;
