begin;
create extension if not exists pgcrypto;

do $$ begin create type public.agency_role as enum ('admin','staff','client'); exception when duplicate_object then null; end $$;
do $$ begin create type public.membership_status as enum ('invited','active','suspended'); exception when duplicate_object then null; end $$;
do $$ begin create type public.client_status as enum ('active','paused','archived'); exception when duplicate_object then null; end $$;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  phone text,
  website text,
  language text not null default 'ru',
  timezone text not null default 'Asia/Almaty',
  plan text not null default 'trial',
  trial_ends_at timestamptz,
  branding jsonb not null default '{"primaryColor":"#0072EE","logoUrl":null}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  locale text not null default 'ru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.agency_memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.agency_role not null,
  permissions text[] not null default '{}',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id,user_id)
);
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  company text not null,
  url text,
  timezone text not null default 'Asia/Almaty',
  country text,
  language text not null default 'ru',
  start_date date,
  logo_url text,
  brand_color text not null default '#0072EE' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  portal_subdomain text,
  status public.client_status not null default 'active',
  connected_sources_count integer not null default 0 check (connected_sources_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_agency_portal_subdomain_idx on public.clients(agency_id,portal_subdomain) where portal_subdomain is not null;
create index if not exists clients_agency_created_idx on public.clients(agency_id,created_at desc);
create table if not exists public.client_users (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permissions text[] not null default '{client.read}',
  created_at timestamptz not null default now(),
  primary key (client_id,user_id)
);
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean language sql stable security invoker set search_path=public
as $$ select exists(select 1 from public.agency_memberships m where m.agency_id=target_agency_id and m.user_id=(select auth.uid()) and m.status='active'); $$;
create or replace function public.is_agency_admin(target_agency_id uuid)
returns boolean language sql stable security invoker set search_path=public
as $$ select exists(select 1 from public.agency_memberships m where m.agency_id=target_agency_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='admin'); $$;
create or replace function public.can_access_client(target_client_id uuid)
returns boolean language sql stable security invoker set search_path=public
as $$ select exists(select 1 from public.clients c where c.id=target_client_id and (public.is_agency_member(c.agency_id) or exists(select 1 from public.client_users cu where cu.client_id=c.id and cu.user_id=(select auth.uid())))); $$;

alter table public.agencies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.agency_memberships enable row level security;
alter table public.clients enable row level security;
alter table public.client_users enable row level security;
alter table public.activity_log enable row level security;

create policy agencies_select_member on public.agencies for select to authenticated using (public.is_agency_member(id));
create policy agencies_update_admin on public.agencies for update to authenticated using (public.is_agency_admin(id)) with check (public.is_agency_admin(id));
create policy profiles_select_self on public.user_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy profiles_update_self on public.user_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy memberships_select_related on public.agency_memberships for select to authenticated using (user_id=(select auth.uid()) or public.is_agency_admin(agency_id));
create policy memberships_manage_admin on public.agency_memberships for all to authenticated using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));
create policy clients_select_access on public.clients for select to authenticated using (public.can_access_client(id));
create policy clients_insert_member on public.clients for insert to authenticated with check (public.is_agency_member(agency_id));
create policy clients_update_member on public.clients for update to authenticated using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));
create policy clients_delete_admin on public.clients for delete to authenticated using (public.is_agency_admin(agency_id));
create policy client_users_select_related on public.client_users for select to authenticated using (user_id=(select auth.uid()) or public.can_access_client(client_id));
create policy client_users_manage_admin on public.client_users for all to authenticated using (exists(select 1 from public.clients c where c.id=client_id and public.is_agency_admin(c.agency_id))) with check (exists(select 1 from public.clients c where c.id=client_id and public.is_agency_admin(c.agency_id)));
create policy activity_select_member on public.activity_log for select to authenticated using (public.is_agency_member(agency_id));
create policy activity_insert_member on public.activity_log for insert to authenticated with check (public.is_agency_member(agency_id) and user_id=(select auth.uid()));

grant usage on schema public to authenticated;
grant select,update on public.user_profiles to authenticated;
grant select,update on public.agencies to authenticated;
grant select,insert,update,delete on public.clients to authenticated;
grant select,insert,update,delete on public.agency_memberships to authenticated;
grant select,insert,update,delete on public.client_users to authenticated;
grant select,insert on public.activity_log to authenticated;

create or replace function public.workspace_bootstrap()
returns jsonb language sql stable security invoker set search_path=public
as $$
with me as (
  select u.id,u.email,coalesce(p.name,split_part(u.email,'@',1)) as name,p.avatar_url
  from auth.users u left join public.user_profiles p on p.user_id=u.id
  where u.id=(select auth.uid())
),
my_agencies as (
  select a.id,a.name,a.slug,m.role,m.permissions,a.branding
  from public.agencies a join public.agency_memberships m on m.agency_id=a.id
  where m.user_id=(select auth.uid()) and m.status='active'
  order by a.created_at
),
active_agency as (select * from my_agencies limit 1),
my_clients as (select c.* from public.clients c where public.can_access_client(c.id) order by c.created_at desc)
select jsonb_build_object(
  'currentUser',(select jsonb_build_object('id',id,'email',email,'name',name,'avatarUrl',avatar_url) from me),
  'agencies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding)) from my_agencies),'[]'::jsonb),
  'activeAgency',(select jsonb_build_object('id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding) from active_agency),
  'clients',coalesce((select jsonb_agg(jsonb_build_object('id',id,'company',company,'url',url,'status',status,'createdAt',created_at,'logoUrl',logo_url,'brandColor',brand_color,'connectedSources',connected_sources_count)) from my_clients),'[]'::jsonb)
);
$$;
revoke all on function public.workspace_bootstrap() from public,anon;
grant execute on function public.workspace_bootstrap() to authenticated;
commit;
