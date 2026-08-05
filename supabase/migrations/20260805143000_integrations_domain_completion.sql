begin;

alter table public.data_sources
  add column if not exists sync_depth_days integer not null default 30 check (sync_depth_days between 1 and 3650),
  add column if not exists next_sync_at timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_error_at timestamptz,
  add column if not exists paused_at timestamptz;

update public.data_sources
set last_success_at = coalesce(last_success_at,last_sync_at),
    last_error_at = case when sync_error is not null then coalesce(last_error_at,updated_at) else last_error_at end,
    next_sync_at = case when status='connected' and next_sync_at is null then now()+interval '1 day' else next_sync_at end;

create index if not exists data_sources_agency_next_sync_idx
  on public.data_sources(agency_id,next_sync_at)
  where status='connected' and next_sync_at is not null;
create index if not exists data_sources_health_idx
  on public.data_sources(agency_id,status,last_success_at desc);

create table if not exists public.integration_schema_entities (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  entity_key text not null check (entity_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(trim(label)) between 1 and 120),
  description text not null default '' check (length(description) <= 1000),
  supports_date_range boolean not null default true,
  supported_date_range jsonb not null default '{}'::jsonb,
  attribution_windows integer[] not null default '{}',
  rate_limits jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id,entity_key),
  unique (id,integration_id),
  check (jsonb_typeof(supported_date_range)='object'),
  check (jsonb_typeof(rate_limits)='object'),
  check (jsonb_typeof(metadata)='object')
);

create table if not exists public.integration_schema_fields (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations(id) on delete cascade,
  entity_id uuid not null,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]*$'),
  kind text not null check (kind in ('dimension','metric')),
  label text not null check (length(trim(label)) between 1 and 120),
  description text not null default '' check (length(description) <= 1000),
  data_type text not null check (data_type in ('string','boolean','date','datetime','integer','float','currency','percent','duration','json')),
  aggregation text check (aggregation is null or aggregation in ('sum','avg','weighted','last','count','derived')),
  filter_operators text[] not null default '{}',
  supports_breakdown boolean not null default false,
  provider_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id,entity_id,kind,field_key),
  foreign key (entity_id,integration_id) references public.integration_schema_entities(id,integration_id) on delete cascade,
  check (jsonb_typeof(metadata)='object')
);

create table if not exists public.integration_provider_errors (
  integration_id uuid not null references public.integrations(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 120),
  category text not null check (category in ('auth','rate_limit','validation','provider','transient','permanent')),
  message text not null,
  retryable boolean not null default false,
  remediation text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (integration_id,code),
  check (jsonb_typeof(metadata)='object')
);

create index if not exists integration_schema_entities_integration_idx on public.integration_schema_entities(integration_id,entity_key);
create index if not exists integration_schema_fields_entity_idx on public.integration_schema_fields(entity_id,kind,field_key);
create index if not exists integration_schema_fields_integration_kind_idx on public.integration_schema_fields(integration_id,kind);
create index if not exists integration_provider_errors_category_idx on public.integration_provider_errors(integration_id,category);

alter table public.integration_schema_entities enable row level security;
alter table public.integration_schema_fields enable row level security;
alter table public.integration_provider_errors enable row level security;

revoke all on public.integration_schema_entities,public.integration_schema_fields,public.integration_provider_errors from anon,authenticated;
grant select on public.integration_schema_entities,public.integration_schema_fields,public.integration_provider_errors to authenticated;
grant select,insert,update,delete on public.integration_schema_entities,public.integration_schema_fields,public.integration_provider_errors to service_role;

drop policy if exists integration_schema_entities_read on public.integration_schema_entities;
create policy integration_schema_entities_read on public.integration_schema_entities for select to authenticated using (true);
drop policy if exists integration_schema_fields_read on public.integration_schema_fields;
create policy integration_schema_fields_read on public.integration_schema_fields for select to authenticated using (true);
drop policy if exists integration_provider_errors_read on public.integration_provider_errors;
create policy integration_provider_errors_read on public.integration_provider_errors for select to authenticated using (true);

drop trigger if exists integration_schema_entities_touch on public.integration_schema_entities;
create trigger integration_schema_entities_touch before update on public.integration_schema_entities
for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists integration_schema_fields_touch on public.integration_schema_fields;
create trigger integration_schema_fields_touch before update on public.integration_schema_fields
for each row execute function private.platform_core_touch_updated_at();

with entity_seed(integration_slug,entity_key,label,description,supported_date_range,attribution_windows,rate_limits,metadata) as (
  values
  ('google-ads','campaign','Campaigns','Google Ads campaign performance','{"maxDays":3650,"minimumDate":"2000-01-01"}'::jsonb,array[1,7,30,90],'{"requestsPerMinute":15000}'::jsonb,'{"supportsSegments":true}'::jsonb),
  ('ga4','property','Properties','GA4 property traffic and conversion metrics','{"maxDays":3650,"minimumDate":"2015-08-14"}'::jsonb,array[1,7,30,90],'{"tokensPerHour":50000}'::jsonb,'{"supportsRealtime":true}'::jsonb),
  ('search-console','query','Search queries','Google Search Console query performance','{"maxDays":480,"minimumDate":"2018-01-01"}'::jsonb,'{}'::integer[],'{"rowsPerRequest":25000}'::jsonb,'{"freshnessDays":3}'::jsonb),
  ('meta-ads','campaign','Campaigns','Meta Ads campaign insights','{"maxDays":1095,"minimumDate":"2015-01-01"}'::jsonb,array[1,7,28],'{"adaptive":true}'::jsonb,'{"supportsActionBreakdowns":true}'::jsonb),
  ('tiktok-ads','campaign','Campaigns','TikTok Ads campaign reports','{"maxDays":1095,"minimumDate":"2018-01-01"}'::jsonb,array[1,7,28],'{"adaptive":true}'::jsonb,'{"supportsPlacementBreakdown":true}'::jsonb)
)
insert into public.integration_schema_entities(integration_id,entity_key,label,description,supported_date_range,attribution_windows,rate_limits,metadata)
select i.id,s.entity_key,s.label,s.description,s.supported_date_range,s.attribution_windows,s.rate_limits,s.metadata
from entity_seed s join public.integrations i on i.slug=s.integration_slug
on conflict(integration_id,entity_key) do update set
  label=excluded.label,description=excluded.description,supported_date_range=excluded.supported_date_range,
  attribution_windows=excluded.attribution_windows,rate_limits=excluded.rate_limits,metadata=excluded.metadata;

with field_seed(integration_slug,entity_key,field_key,kind,label,data_type,aggregation,filter_operators,supports_breakdown,provider_key) as (
  values
  ('google-ads','campaign','campaign_id','dimension','Campaign ID','string',null,array['eq','in'],true,'campaign.id'),
  ('google-ads','campaign','campaign_name','dimension','Campaign','string',null,array['eq','contains','in'],true,'campaign.name'),
  ('google-ads','campaign','status','dimension','Status','string',null,array['eq','in'],true,'campaign.status'),
  ('google-ads','campaign','date','dimension','Date','date',null,array['between','gte','lte'],true,'segments.date'),
  ('google-ads','campaign','device','dimension','Device','string',null,array['eq','in'],true,'segments.device'),
  ('google-ads','campaign','impressions','metric','Impressions','integer','sum','{}',false,'metrics.impressions'),
  ('google-ads','campaign','clicks','metric','Clicks','integer','sum','{}',false,'metrics.clicks'),
  ('google-ads','campaign','spend','metric','Spend','currency','sum','{}',false,'metrics.cost_micros'),
  ('google-ads','campaign','conversions','metric','Conversions','float','sum','{}',false,'metrics.conversions'),
  ('google-ads','campaign','revenue','metric','Conversion value','currency','sum','{}',false,'metrics.conversions_value'),
  ('ga4','property','property_id','dimension','Property ID','string',null,array['eq','in'],true,'property'),
  ('ga4','property','date','dimension','Date','date',null,array['between','gte','lte'],true,'date'),
  ('ga4','property','campaign','dimension','Campaign','string',null,array['eq','contains','in'],true,'sessionCampaignName'),
  ('ga4','property','source','dimension','Source','string',null,array['eq','contains','in'],true,'sessionSource'),
  ('ga4','property','medium','dimension','Medium','string',null,array['eq','contains','in'],true,'sessionMedium'),
  ('ga4','property','sessions','metric','Sessions','integer','sum','{}',false,'sessions'),
  ('ga4','property','users','metric','Users','integer','sum','{}',false,'totalUsers'),
  ('ga4','property','conversions','metric','Conversions','float','sum','{}',false,'eventCount'),
  ('ga4','property','revenue','metric','Revenue','currency','sum','{}',false,'totalRevenue'),
  ('ga4','property','bounce_rate','metric','Bounce rate','percent','weighted','{}',false,'bounceRate'),
  ('search-console','query','site','dimension','Site','string',null,array['eq','in'],true,'siteUrl'),
  ('search-console','query','query','dimension','Query','string',null,array['eq','contains','in'],true,'query'),
  ('search-console','query','page','dimension','Page','string',null,array['eq','contains','in'],true,'page'),
  ('search-console','query','country','dimension','Country','string',null,array['eq','in'],true,'country'),
  ('search-console','query','device','dimension','Device','string',null,array['eq','in'],true,'device'),
  ('search-console','query','clicks','metric','Clicks','integer','sum','{}',false,'clicks'),
  ('search-console','query','impressions','metric','Impressions','integer','sum','{}',false,'impressions'),
  ('search-console','query','position','metric','Average position','float','weighted','{}',false,'position'),
  ('meta-ads','campaign','account_id','dimension','Account ID','string',null,array['eq','in'],true,'account_id'),
  ('meta-ads','campaign','campaign_id','dimension','Campaign ID','string',null,array['eq','in'],true,'campaign_id'),
  ('meta-ads','campaign','campaign_name','dimension','Campaign','string',null,array['eq','contains','in'],true,'campaign_name'),
  ('meta-ads','campaign','effective_status','dimension','Status','string',null,array['eq','in'],true,'effective_status'),
  ('meta-ads','campaign','date','dimension','Date','date',null,array['between','gte','lte'],true,'date_start'),
  ('meta-ads','campaign','impressions','metric','Impressions','integer','sum','{}',false,'impressions'),
  ('meta-ads','campaign','clicks','metric','Clicks','integer','sum','{}',false,'clicks'),
  ('meta-ads','campaign','spend','metric','Spend','currency','sum','{}',false,'spend'),
  ('meta-ads','campaign','leads','metric','Leads','float','sum','{}',false,'actions.lead'),
  ('meta-ads','campaign','revenue','metric','Purchase value','currency','sum','{}',false,'action_values.purchase'),
  ('tiktok-ads','campaign','advertiser_id','dimension','Advertiser ID','string',null,array['eq','in'],true,'advertiser_id'),
  ('tiktok-ads','campaign','campaign_id','dimension','Campaign ID','string',null,array['eq','in'],true,'campaign_id'),
  ('tiktok-ads','campaign','campaign_name','dimension','Campaign','string',null,array['eq','contains','in'],true,'campaign_name'),
  ('tiktok-ads','campaign','status','dimension','Status','string',null,array['eq','in'],true,'operation_status'),
  ('tiktok-ads','campaign','date','dimension','Date','date',null,array['between','gte','lte'],true,'stat_time_day'),
  ('tiktok-ads','campaign','impressions','metric','Impressions','integer','sum','{}',false,'impressions'),
  ('tiktok-ads','campaign','clicks','metric','Clicks','integer','sum','{}',false,'clicks'),
  ('tiktok-ads','campaign','spend','metric','Spend','currency','sum','{}',false,'spend'),
  ('tiktok-ads','campaign','conversions','metric','Conversions','float','sum','{}',false,'conversion'),
  ('tiktok-ads','campaign','video_views','metric','Video views','integer','sum','{}',false,'video_play_actions')
)
insert into public.integration_schema_fields(integration_id,entity_id,field_key,kind,label,data_type,aggregation,filter_operators,supports_breakdown,provider_key)
select i.id,e.id,s.field_key,s.kind,s.label,s.data_type,s.aggregation,s.filter_operators,s.supports_breakdown,s.provider_key
from field_seed s
join public.integrations i on i.slug=s.integration_slug
join public.integration_schema_entities e on e.integration_id=i.id and e.entity_key=s.entity_key
on conflict(integration_id,entity_id,kind,field_key) do update set
  label=excluded.label,data_type=excluded.data_type,aggregation=excluded.aggregation,
  filter_operators=excluded.filter_operators,supports_breakdown=excluded.supports_breakdown,provider_key=excluded.provider_key;

with error_seed(integration_slug,code,category,message,retryable,remediation) as (
  values
  ('google-ads','AUTH_EXPIRED','auth','Google authorization expired',false,'Reconnect the Google account.'),
  ('google-ads','RATE_LIMIT','rate_limit','Google Ads request quota exceeded',true,'Retry after the provider backoff period.'),
  ('google-ads','INVALID_CUSTOMER','validation','Customer ID is unavailable to this credential',false,'Select an accessible Google Ads account.'),
  ('ga4','AUTH_EXPIRED','auth','Google authorization expired',false,'Reconnect the Google account.'),
  ('ga4','QUOTA_EXCEEDED','rate_limit','GA4 property quota exceeded',true,'Retry later or reduce the requested date range.'),
  ('ga4','PROPERTY_DENIED','validation','The credential cannot access this property',false,'Grant Viewer access and reconnect.'),
  ('search-console','AUTH_EXPIRED','auth','Google authorization expired',false,'Reconnect the Google account.'),
  ('search-console','SITE_DENIED','validation','The credential cannot access this site',false,'Verify site ownership or permissions.'),
  ('search-console','DATA_NOT_READY','transient','Search Console data is not available yet',true,'Retry after provider data freshness delay.'),
  ('meta-ads','TOKEN_EXPIRED','auth','Meta access token expired or was revoked',false,'Reconnect the Meta account.'),
  ('meta-ads','RATE_LIMIT','rate_limit','Meta API rate limit reached',true,'Retry using exponential backoff.'),
  ('meta-ads','ACCOUNT_DISABLED','permanent','Meta ad account is disabled',false,'Resolve the account status in Meta Business Manager.'),
  ('tiktok-ads','TOKEN_EXPIRED','auth','TikTok authorization expired',false,'Reconnect the TikTok account.'),
  ('tiktok-ads','RATE_LIMIT','rate_limit','TikTok API rate limit reached',true,'Retry using exponential backoff.'),
  ('tiktok-ads','ADVERTISER_DENIED','validation','The credential cannot access this advertiser',false,'Select an accessible advertiser account.')
)
insert into public.integration_provider_errors(integration_id,code,category,message,retryable,remediation)
select i.id,s.code,s.category,s.message,s.retryable,s.remediation
from error_seed s join public.integrations i on i.slug=s.integration_slug
on conflict(integration_id,code) do update set
  category=excluded.category,message=excluded.message,retryable=excluded.retryable,remediation=excluded.remediation;

update public.integrations i
set metadata=jsonb_set(coalesce(i.metadata,'{}'::jsonb),'{schemaVersion}','1'::jsonb,true)
where exists(select 1 from public.integration_schema_entities e where e.integration_id=i.id);

commit;
