-- Target schema for IMDS Marketing Data Platform.
-- Convert this file into a Supabase migration before applying.

create schema if not exists marketing_private;

create type public.marketing_platform as enum ('meta', 'tiktok');
create type public.marketing_sync_status as enum ('pending', 'running', 'succeeded', 'failed', 'cancelled');

create table public.marketing_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  platform public.marketing_platform not null,
  integration_id uuid not null,
  external_account_id text not null,
  account_name text not null,
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  status text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, platform, external_account_id)
);

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid not null references public.marketing_ad_accounts(id) on delete cascade,
  external_campaign_id text not null,
  campaign_name text not null,
  objective text,
  effective_status text,
  start_time timestamptz,
  stop_time timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, account_id, external_campaign_id)
);

create table public.marketing_adsets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  external_adset_id text not null,
  adset_name text not null,
  effective_status text,
  optimization_goal text,
  billing_event text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, campaign_id, external_adset_id)
);

create table public.marketing_ads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  adset_id uuid not null references public.marketing_adsets(id) on delete cascade,
  external_ad_id text not null,
  ad_name text not null,
  creative_id text,
  effective_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, adset_id, external_ad_id)
);

create table public.marketing_daily_metrics (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  platform public.marketing_platform not null,
  report_date date not null,
  account_id uuid not null references public.marketing_ad_accounts(id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  adset_id uuid references public.marketing_adsets(id) on delete cascade,
  ad_id uuid references public.marketing_ads(id) on delete cascade,
  currency text not null,
  timezone text not null,
  impressions bigint not null default 0 check (impressions >= 0),
  reach bigint not null default 0 check (reach >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  link_clicks bigint not null default 0 check (link_clicks >= 0),
  spend numeric(20, 6) not null default 0 check (spend >= 0),
  video_views bigint not null default 0 check (video_views >= 0),
  platform_leads bigint not null default 0 check (platform_leads >= 0),
  crm_leads bigint not null default 0 check (crm_leads >= 0),
  target_leads bigint not null default 0 check (target_leads >= 0),
  arrived bigint not null default 0 check (arrived >= 0),
  sales bigint not null default 0 check (sales >= 0),
  revenue numeric(20, 6) not null default 0 check (revenue >= 0),
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  source_hash text,
  unique nulls not distinct (tenant_id, platform, report_date, account_id, campaign_id, adset_id, ad_id)
);

create table marketing_private.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  platform public.marketing_platform not null,
  integration_id uuid not null,
  account_id uuid references public.marketing_ad_accounts(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  granularity text not null default 'adset',
  status public.marketing_sync_status not null default 'pending',
  attempt integer not null default 0,
  max_attempts integer not null default 5,
  priority integer not null default 100,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  check (date_to >= date_from)
);

create table marketing_private.sync_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references marketing_private.sync_jobs(id) on delete cascade,
  provider_request_id text,
  rows_received integer not null default 0,
  rows_upserted integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  error jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table marketing_private.crm_attribution (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  crm_lead_id uuid not null,
  platform public.marketing_platform,
  external_lead_id text,
  account_id uuid references public.marketing_ad_accounts(id),
  campaign_id uuid references public.marketing_campaigns(id),
  adset_id uuid references public.marketing_adsets(id),
  ad_id uuid references public.marketing_ads(id),
  attributed_date date not null,
  attribution_model text not null,
  attribution_version integer not null default 1,
  confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  unique (tenant_id, crm_lead_id, attribution_model, attribution_version)
);

create index marketing_metrics_tenant_date_idx
  on public.marketing_daily_metrics (tenant_id, report_date desc);
create index marketing_metrics_campaign_date_idx
  on public.marketing_daily_metrics (tenant_id, campaign_id, report_date desc);
create index marketing_metrics_adset_date_idx
  on public.marketing_daily_metrics (tenant_id, adset_id, report_date desc);
create index marketing_jobs_pick_idx
  on marketing_private.sync_jobs (status, run_after, priority, created_at)
  where status in ('pending', 'failed');

alter table public.marketing_ad_accounts enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_adsets enable row level security;
alter table public.marketing_ads enable row level security;
alter table public.marketing_daily_metrics enable row level security;

-- Policies intentionally omitted until Platform Core membership/permission source is confirmed.
-- Do not add a broad `to authenticated using (true)` policy.

create view public.marketing_campaign_daily
with (security_invoker = true)
as
select
  m.tenant_id,
  m.platform,
  m.report_date,
  a.external_account_id as account_id,
  a.account_name,
  c.external_campaign_id as campaign_id,
  c.campaign_name,
  c.effective_status,
  m.currency,
  sum(m.impressions) as impressions,
  sum(m.reach) as reach,
  sum(m.clicks) as clicks,
  sum(m.link_clicks) as link_clicks,
  sum(m.spend) as spend,
  sum(m.video_views) as video_views,
  sum(m.platform_leads) as leads,
  sum(m.crm_leads) as crm_leads,
  sum(m.target_leads) as target_leads,
  sum(m.arrived) as arrived,
  sum(m.sales) as sales,
  sum(m.revenue) as revenue
from public.marketing_daily_metrics m
join public.marketing_ad_accounts a on a.id = m.account_id
join public.marketing_campaigns c on c.id = m.campaign_id
group by
  m.tenant_id, m.platform, m.report_date,
  a.external_account_id, a.account_name,
  c.external_campaign_id, c.campaign_name, c.effective_status,
  m.currency;
