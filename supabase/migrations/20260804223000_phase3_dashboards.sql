begin;

create table public.dashboards(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  name text not null,
  is_smart boolean not null default false,
  position integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,agency_id),
  foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete cascade
);

create table public.dashboard_sections(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  dashboard_id uuid not null,
  title text not null default 'Section',
  position integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,agency_id),
  foreign key(dashboard_id,agency_id) references public.dashboards(id,agency_id) on delete cascade
);

create table public.widgets(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  section_id uuid not null,
  type text not null check(type in ('stat','line','bar','sparkline','table','pie','horizontal_bar','gauge','text','title','image','embed','custom_metric','kpi','view')),
  integration_slug text,
  metric_key text references public.metric_dictionary(metric_key) on delete restrict,
  dimension_key text,
  date_range_json jsonb not null default '{}'::jsonb,
  filters_json jsonb not null default '[]'::jsonb,
  settings_json jsonb not null default '{}'::jsonb,
  x integer not null default 0 check(x between 0 and 11),
  y integer not null default 0 check(y >= 0),
  w integer not null default 4 check(w between 1 and 12),
  h integer not null default 4 check(h between 1 and 30),
  color text,
  title text not null default 'Widget',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(section_id,agency_id) references public.dashboard_sections(id,agency_id) on delete cascade,
  check(x+w <= 12)
);

create index dashboards_client_position_idx on public.dashboards(client_id,position);
create index dashboards_created_by_idx on public.dashboards(created_by);
create index dashboard_sections_dashboard_position_idx on public.dashboard_sections(dashboard_id,position);
create index widgets_section_position_idx on public.widgets(section_id,y,x);
create index widgets_metric_idx on public.widgets(metric_key);

alter table public.dashboards enable row level security;
alter table public.dashboard_sections enable row level security;
alter table public.widgets enable row level security;

create policy dashboards_read on public.dashboards for select to authenticated using(private.can_access_client(client_id));
create policy dashboards_insert on public.dashboards for insert to authenticated with check(private.has_agency_permission(agency_id,'reports.manage') and private.can_access_client(client_id));
create policy dashboards_update on public.dashboards for update to authenticated using(private.has_agency_permission(agency_id,'reports.manage')) with check(private.has_agency_permission(agency_id,'reports.manage') and private.can_access_client(client_id));
create policy dashboards_delete on public.dashboards for delete to authenticated using(private.has_agency_permission(agency_id,'reports.manage'));

create policy dashboard_sections_read on public.dashboard_sections for select to authenticated using(exists(select 1 from public.dashboards d where d.id=dashboard_id and private.can_access_client(d.client_id)));
create policy dashboard_sections_write on public.dashboard_sections for all to authenticated using(private.has_agency_permission(agency_id,'reports.manage')) with check(private.has_agency_permission(agency_id,'reports.manage'));

create policy widgets_read on public.widgets for select to authenticated using(exists(select 1 from public.dashboard_sections s join public.dashboards d on d.id=s.dashboard_id where s.id=section_id and private.can_access_client(d.client_id)));
create policy widgets_write on public.widgets for all to authenticated using(private.has_agency_permission(agency_id,'reports.manage')) with check(private.has_agency_permission(agency_id,'reports.manage'));

revoke all on public.dashboards,public.dashboard_sections,public.widgets from anon,authenticated;
grant select,insert,update,delete on public.dashboards,public.dashboard_sections,public.widgets to authenticated;
grant select,insert,update,delete on public.dashboards,public.dashboard_sections,public.widgets to service_role;

commit;
