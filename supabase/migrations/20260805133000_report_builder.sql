begin;

alter table public.reports
  add column if not exists revision integer not null default 1,
  add column if not exists settings jsonb not null default '{"pageSize":"A4","orientation":"portrait","showHeader":true,"showFooter":true}'::jsonb,
  add column if not exists branding jsonb not null default '{}'::jsonb;

alter table public.reports
  drop constraint if exists reports_settings_object,
  add constraint reports_settings_object check (jsonb_typeof(settings)='object'),
  drop constraint if exists reports_branding_object,
  add constraint reports_branding_object check (jsonb_typeof(branding)='object');

create table if not exists public.report_pages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null default 'Страница' check (length(trim(title)) between 1 and 120),
  position integer not null default 0 check (position >= 0),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, position),
  unique (id, agency_id)
);

create table if not exists public.report_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  type text not null check (type in ('section','text','image','widget','page_break')),
  title text not null default '' check (length(title) <= 160),
  position integer not null default 0 check (position >= 0),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (page_id, agency_id) references public.report_pages(id, agency_id) on delete cascade,
  unique (page_id, position)
);

create index if not exists report_pages_report_position_idx on public.report_pages(report_id, position);
create index if not exists report_pages_agency_idx on public.report_pages(agency_id, report_id);
create index if not exists report_blocks_page_position_idx on public.report_blocks(page_id, position);
create index if not exists report_blocks_agency_idx on public.report_blocks(agency_id, page_id);

alter table public.report_pages enable row level security;
alter table public.report_blocks enable row level security;

revoke all on public.report_pages, public.report_blocks from anon;
grant select, insert, update, delete on public.report_pages, public.report_blocks to authenticated;

drop policy if exists report_pages_select on public.report_pages;
create policy report_pages_select on public.report_pages for select to authenticated
using (exists(select 1 from public.reports r where r.id=report_id and r.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.read') and (r.client_id is null or private.can_access_client(r.client_id))));

drop policy if exists report_pages_insert on public.report_pages;
create policy report_pages_insert on public.report_pages for insert to authenticated
with check (exists(select 1 from public.reports r where r.id=report_id and r.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage') and (r.client_id is null or private.can_access_client(r.client_id))));

drop policy if exists report_pages_update on public.report_pages;
create policy report_pages_update on public.report_pages for update to authenticated
using (exists(select 1 from public.reports r where r.id=report_id and r.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage')))
with check (exists(select 1 from public.reports r where r.id=report_id and r.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage') and (r.client_id is null or private.can_access_client(r.client_id))));

drop policy if exists report_pages_delete on public.report_pages;
create policy report_pages_delete on public.report_pages for delete to authenticated
using (exists(select 1 from public.reports r where r.id=report_id and r.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage')));

drop policy if exists report_blocks_select on public.report_blocks;
create policy report_blocks_select on public.report_blocks for select to authenticated
using (exists(select 1 from public.report_pages p join public.reports r on r.id=p.report_id where p.id=page_id and p.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.read') and (r.client_id is null or private.can_access_client(r.client_id))));

drop policy if exists report_blocks_insert on public.report_blocks;
create policy report_blocks_insert on public.report_blocks for insert to authenticated
with check (exists(select 1 from public.report_pages p join public.reports r on r.id=p.report_id where p.id=page_id and p.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage') and (r.client_id is null or private.can_access_client(r.client_id))));

drop policy if exists report_blocks_update on public.report_blocks;
create policy report_blocks_update on public.report_blocks for update to authenticated
using (exists(select 1 from public.report_pages p join public.reports r on r.id=p.report_id where p.id=page_id and p.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage')))
with check (exists(select 1 from public.report_pages p join public.reports r on r.id=p.report_id where p.id=page_id and p.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage') and (r.client_id is null or private.can_access_client(r.client_id))));

drop policy if exists report_blocks_delete on public.report_blocks;
create policy report_blocks_delete on public.report_blocks for delete to authenticated
using (exists(select 1 from public.report_pages p join public.reports r on r.id=p.report_id where p.id=page_id and p.agency_id=agency_id and private.has_agency_permission(r.agency_id,'reports.manage')));

drop trigger if exists report_pages_touch on public.report_pages;
create trigger report_pages_touch before update on public.report_pages for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists report_blocks_touch on public.report_blocks;
create trigger report_blocks_touch before update on public.report_blocks for each row execute function private.platform_core_touch_updated_at();

commit;
