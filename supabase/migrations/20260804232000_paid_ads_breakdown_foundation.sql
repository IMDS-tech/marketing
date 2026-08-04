begin;

insert into public.metric_dictionary(
  metric_key,
  label,
  description,
  data_type,
  aggregation,
  format,
  is_derived,
  formula,
  dependencies,
  category
) values
  (
    'events',
    'Events',
    'Provider event occurrences',
    'float',
    'sum',
    'decimal',
    false,
    null,
    '{}',
    'conversion'
  ),
  (
    'conversion_rate',
    'Conversion Rate',
    'Conversions divided by clicks',
    'percent',
    'derived',
    'percent',
    true,
    'conversions / nullif(clicks, 0)',
    '{conversions,clicks}',
    'efficiency'
  ),
  (
    'cost_per_conversion',
    'Cost per Conversion',
    'Spend divided by conversions',
    'currency',
    'derived',
    'currency',
    true,
    'spend / nullif(conversions, 0)',
    '{spend,conversions}',
    'efficiency'
  )
on conflict (metric_key) do update set
  label = excluded.label,
  description = excluded.description,
  data_type = excluded.data_type,
  aggregation = excluded.aggregation,
  format = excluded.format,
  is_derived = excluded.is_derived,
  formula = excluded.formula,
  dependencies = excluded.dependencies,
  category = excluded.category,
  updated_at = now();

create table public.marketing_breakdown_daily (
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null references public.integrations(slug) on delete restrict,

  entity_type text not null check (
    entity_type in ('account', 'campaign', 'adgroup', 'ad')
  ),
  entity_id text not null,
  entity_name text,

  breakdown_type text not null check (
    breakdown_type in (
      'age',
      'gender',
      'country',
      'region',
      'device',
      'operating_system',
      'publisher_platform',
      'placement'
    )
  ),
  breakdown_value text not null,
  provider_breakdown_type text,
  provider_breakdown_value text,

  metric_date date not null,
  metric_key text not null references public.metric_dictionary(metric_key) on delete restrict,
  value numeric not null,

  attribution_setting text not null default 'account_default',
  report_family text not null default 'insights' check (
    report_family in ('basic', 'audience', 'insights', 'event')
  ),
  dimensions jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),

  primary key (
    agency_id,
    client_id,
    data_source_id,
    integration_slug,
    entity_type,
    entity_id,
    breakdown_type,
    breakdown_value,
    metric_date,
    metric_key,
    attribution_setting
  ),

  foreign key (client_id, agency_id)
    references public.clients(id, agency_id)
    on delete cascade,

  foreign key (data_source_id, agency_id)
    references public.data_sources(id, agency_id)
    on delete cascade
);

create index marketing_breakdown_client_query_idx
  on public.marketing_breakdown_daily (
    client_id,
    integration_slug,
    breakdown_type,
    metric_date desc,
    metric_key
  );

create index marketing_breakdown_source_query_idx
  on public.marketing_breakdown_daily (
    data_source_id,
    breakdown_type,
    metric_date desc
  );

create index marketing_breakdown_client_agency_idx
  on public.marketing_breakdown_daily (client_id, agency_id);

create index marketing_breakdown_source_agency_idx
  on public.marketing_breakdown_daily (data_source_id, agency_id);

create index marketing_breakdown_dimensions_gin_idx
  on public.marketing_breakdown_daily
  using gin (dimensions);

alter table public.marketing_breakdown_daily enable row level security;

create policy marketing_breakdown_daily_read
on public.marketing_breakdown_daily
for select
to authenticated
using (private.can_access_client(client_id));

revoke all on public.marketing_breakdown_daily from anon, authenticated;
grant select on public.marketing_breakdown_daily to authenticated;
grant select, insert, update, delete on public.marketing_breakdown_daily to service_role;

comment on table public.marketing_breakdown_daily is
  'Tenant-scoped aggregate paid ads facts split by canonical demographic, geography, device, platform or placement values.';

comment on column public.marketing_breakdown_daily.breakdown_value is
  'Canonical value used by IMDS queries and localization; provider raw values are retained separately.';

comment on column public.marketing_breakdown_daily.attribution_setting is
  'Provider attribution configuration used to produce the fact row; participates in the primary key to prevent mixed attribution totals.';

commit;
