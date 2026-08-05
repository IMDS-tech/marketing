begin;

alter table public.clients
  add column if not exists industry text,
  add column if not exists currency text not null default 'KZT',
  add column if not exists group_id uuid,
  add column if not exists account_manager_id uuid references auth.users(id) on delete set null,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists goals text not null default '',
  add column if not exists notes text not null default '',
  add column if not exists analytics_settings jsonb not null default '{}'::jsonb,
  add column if not exists attribution_settings jsonb not null default '{}'::jsonb,
  add column if not exists tracking_settings jsonb not null default '{}'::jsonb,
  add column if not exists retention_days integer not null default 730 check(retention_days between 30 and 3650),
  add column if not exists agency_markup numeric(7,2) not null default 0 check(agency_markup between 0 and 10000),
  add column if not exists tags text[] not null default '{}';

create table if not exists public.client_groups(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 100),
  description text not null default '',
  color text not null default '#64748B' check(color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agency_id,name),
  unique(id,agency_id)
);

do $$ begin
  alter table public.clients add constraint clients_group_agency_fk foreign key(group_id,agency_id) references public.client_groups(id,agency_id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.client_users
  add column if not exists role text not null default 'viewer' check(role in ('owner','manager','editor','viewer')),
  add column if not exists status text not null default 'active' check(status in ('invited','active','suspended')),
  add column if not exists invited_email text,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists clients_agency_status_company_idx on public.clients(agency_id,status,company);
create index if not exists clients_group_idx on public.clients(group_id) where group_id is not null;
create index if not exists clients_manager_idx on public.clients(account_manager_id) where account_manager_id is not null;
create index if not exists client_groups_agency_name_idx on public.client_groups(agency_id,name);
create index if not exists client_users_status_idx on public.client_users(client_id,status);

alter table public.client_groups enable row level security;
revoke all on public.client_groups from anon;
grant select,insert,update,delete on public.client_groups to authenticated;

drop policy if exists client_groups_read on public.client_groups;
create policy client_groups_read on public.client_groups for select to authenticated
using(private.has_agency_permission(agency_id,'clients.read'));
drop policy if exists client_groups_manage on public.client_groups;
create policy client_groups_manage on public.client_groups for all to authenticated
using(private.has_agency_permission(agency_id,'clients.manage'))
with check(private.has_agency_permission(agency_id,'clients.manage'));

drop policy if exists clients_insert_member on public.clients;
drop policy if exists clients_update_member on public.clients;
drop policy if exists clients_delete_admin on public.clients;
create policy clients_insert_manage on public.clients for insert to authenticated
with check(private.has_agency_permission(agency_id,'clients.manage'));
create policy clients_update_manage on public.clients for update to authenticated
using(private.has_agency_permission(agency_id,'clients.manage') and private.can_access_client(id))
with check(private.has_agency_permission(agency_id,'clients.manage'));
create policy clients_delete_manage on public.clients for delete to authenticated
using(private.has_agency_permission(agency_id,'clients.manage'));

drop policy if exists client_users_manage_admin on public.client_users;
create policy client_users_manage on public.client_users for all to authenticated
using(exists(select 1 from public.clients c where c.id=client_id and private.has_agency_permission(c.agency_id,'client_users.manage')))
with check(exists(select 1 from public.clients c where c.id=client_id and private.has_agency_permission(c.agency_id,'client_users.manage')));

drop trigger if exists client_groups_touch on public.client_groups;
create trigger client_groups_touch before update on public.client_groups for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function private.platform_core_touch_updated_at();
drop trigger if exists client_users_touch on public.client_users;
create trigger client_users_touch before update on public.client_users for each row execute function private.platform_core_touch_updated_at();

commit;
