begin;

create table if not exists public.report_folders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, name)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  folder_id uuid references public.report_folders(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '' check (length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft','scheduled','sent','failed','archived')),
  schedule jsonb not null default '{}'::jsonb,
  recipients jsonb not null default '[]'::jsonb,
  last_generated_at timestamptz,
  next_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(schedule) = 'object'),
  check (jsonb_typeof(recipients) = 'array')
);

create index if not exists report_folders_agency_sort_idx on public.report_folders(agency_id, sort_order, name);
create index if not exists reports_agency_updated_idx on public.reports(agency_id, updated_at desc);
create index if not exists reports_client_updated_idx on public.reports(client_id, updated_at desc) where client_id is not null;
create index if not exists reports_status_updated_idx on public.reports(agency_id, status, updated_at desc);
create index if not exists reports_folder_updated_idx on public.reports(folder_id, updated_at desc) where folder_id is not null;

alter table public.report_folders enable row level security;
alter table public.reports enable row level security;

revoke all on public.report_folders, public.reports from anon;
grant select, insert, update, delete on public.report_folders, public.reports to authenticated;

drop policy if exists report_folders_select on public.report_folders;
create policy report_folders_select on public.report_folders
for select to authenticated
using (private.has_agency_permission(agency_id, 'reports.read'));

drop policy if exists report_folders_insert on public.report_folders;
create policy report_folders_insert on public.report_folders
for insert to authenticated
with check (
  private.has_agency_permission(agency_id, 'reports.manage')
  and created_by = (select auth.uid())
);

drop policy if exists report_folders_update on public.report_folders;
create policy report_folders_update on public.report_folders
for update to authenticated
using (private.has_agency_permission(agency_id, 'reports.manage'))
with check (private.has_agency_permission(agency_id, 'reports.manage'));

drop policy if exists report_folders_delete on public.report_folders;
create policy report_folders_delete on public.report_folders
for delete to authenticated
using (private.has_agency_permission(agency_id, 'reports.manage'));

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
for select to authenticated
using (
  private.has_agency_permission(agency_id, 'reports.read')
  and (client_id is null or private.can_access_client(client_id))
);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
for insert to authenticated
with check (
  private.has_agency_permission(agency_id, 'reports.manage')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (
    client_id is null
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.agency_id = agency_id
        and private.can_access_client(c.id)
    )
  )
  and (
    folder_id is null
    or exists (
      select 1 from public.report_folders f
      where f.id = folder_id and f.agency_id = agency_id
    )
  )
);

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports
for update to authenticated
using (
  private.has_agency_permission(agency_id, 'reports.manage')
  and (client_id is null or private.can_access_client(client_id))
)
with check (
  private.has_agency_permission(agency_id, 'reports.manage')
  and updated_by = (select auth.uid())
  and (
    client_id is null
    or exists (
      select 1 from public.clients c
      where c.id = client_id
        and c.agency_id = agency_id
        and private.can_access_client(c.id)
    )
  )
  and (
    folder_id is null
    or exists (
      select 1 from public.report_folders f
      where f.id = folder_id and f.agency_id = agency_id
    )
  )
);

drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports
for delete to authenticated
using (
  private.has_agency_permission(agency_id, 'reports.manage')
  and (client_id is null or private.can_access_client(client_id))
);

drop trigger if exists report_folders_touch on public.report_folders;
create trigger report_folders_touch
before update on public.report_folders
for each row execute function private.platform_core_touch_updated_at();

drop trigger if exists reports_touch on public.reports;
create trigger reports_touch
before update on public.reports
for each row execute function private.platform_core_touch_updated_at();

commit;
