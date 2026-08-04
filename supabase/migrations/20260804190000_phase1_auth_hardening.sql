begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

drop function if exists public.is_agency_member(uuid);
drop function if exists public.is_agency_admin(uuid);
drop function if exists public.can_access_client(uuid);

create or replace function private.is_agency_member(target_agency_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.agency_memberships m where m.agency_id=target_agency_id and m.user_id=(select auth.uid()) and m.status='active'); $$;
create or replace function private.is_agency_admin(target_agency_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.agency_memberships m where m.agency_id=target_agency_id and m.user_id=(select auth.uid()) and m.status='active' and m.role='admin'); $$;
create or replace function private.can_access_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.clients c where c.id=target_client_id and (private.is_agency_member(c.agency_id) or exists(select 1 from public.client_users cu where cu.client_id=c.id and cu.user_id=(select auth.uid())))); $$;
revoke all on function private.is_agency_member(uuid),private.is_agency_admin(uuid),private.can_access_client(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_agency_member(uuid),private.is_agency_admin(uuid),private.can_access_client(uuid) to authenticated;

drop policy if exists agencies_select_member on public.agencies;
drop policy if exists agencies_update_admin on public.agencies;
drop policy if exists memberships_select_related on public.agency_memberships;
drop policy if exists memberships_manage_admin on public.agency_memberships;
drop policy if exists clients_select_access on public.clients;
drop policy if exists clients_insert_member on public.clients;
drop policy if exists clients_update_member on public.clients;
drop policy if exists clients_delete_admin on public.clients;
drop policy if exists client_users_select_related on public.client_users;
drop policy if exists client_users_manage_admin on public.client_users;
drop policy if exists activity_select_member on public.activity_log;
drop policy if exists activity_insert_member on public.activity_log;

create policy agencies_select_member on public.agencies for select to authenticated using(private.is_agency_member(id));
create policy agencies_update_admin on public.agencies for update to authenticated using(private.is_agency_admin(id)) with check(private.is_agency_admin(id));
create policy memberships_select_related on public.agency_memberships for select to authenticated using(user_id=(select auth.uid()) or private.is_agency_admin(agency_id));
create policy memberships_insert_admin on public.agency_memberships for insert to authenticated with check(private.is_agency_admin(agency_id));
create policy memberships_update_admin on public.agency_memberships for update to authenticated using(private.is_agency_admin(agency_id)) with check(private.is_agency_admin(agency_id));
create policy memberships_delete_admin on public.agency_memberships for delete to authenticated using(private.is_agency_admin(agency_id));
create policy clients_select_access on public.clients for select to authenticated using(private.can_access_client(id));
create policy clients_insert_member on public.clients for insert to authenticated with check(private.is_agency_member(agency_id));
create policy clients_update_member on public.clients for update to authenticated using(private.is_agency_member(agency_id)) with check(private.is_agency_member(agency_id));
create policy clients_delete_admin on public.clients for delete to authenticated using(private.is_agency_admin(agency_id));
create policy client_users_select_related on public.client_users for select to authenticated using(user_id=(select auth.uid()) or private.can_access_client(client_id));
create policy client_users_insert_admin on public.client_users for insert to authenticated with check(exists(select 1 from public.clients c where c.id=client_id and private.is_agency_admin(c.agency_id)));
create policy client_users_update_admin on public.client_users for update to authenticated using(exists(select 1 from public.clients c where c.id=client_id and private.is_agency_admin(c.agency_id))) with check(exists(select 1 from public.clients c where c.id=client_id and private.is_agency_admin(c.agency_id)));
create policy client_users_delete_admin on public.client_users for delete to authenticated using(exists(select 1 from public.clients c where c.id=client_id and private.is_agency_admin(c.agency_id)));
create policy activity_select_member on public.activity_log for select to authenticated using(private.is_agency_member(agency_id));
create policy activity_insert_member on public.activity_log for insert to authenticated with check(private.is_agency_member(agency_id) and user_id=(select auth.uid()));

create index if not exists agency_memberships_user_idx on public.agency_memberships(user_id);
create index if not exists client_users_user_idx on public.client_users(user_id);
create index if not exists activity_log_agency_created_idx on public.activity_log(agency_id,created_at desc);
create index if not exists activity_log_client_created_idx on public.activity_log(client_id,created_at desc) where client_id is not null;
create index if not exists activity_log_user_created_idx on public.activity_log(user_id,created_at desc) where user_id is not null;

create or replace function public.workspace_bootstrap(target_agency_id uuid default null)
returns jsonb language sql stable security invoker set search_path=public
as $$
with me as(
  select (select auth.uid()) id,coalesce(auth.jwt()->>'email','') email,coalesce(p.name,split_part(coalesce(auth.jwt()->>'email',''),'@',1)) name,p.avatar_url
  from(select 1) seed left join public.user_profiles p on p.user_id=(select auth.uid())
),my_agencies as(
  select a.id,a.name,a.slug,m.role,m.permissions,a.branding from public.agencies a join public.agency_memberships m on m.agency_id=a.id
  where m.user_id=(select auth.uid()) and m.status='active' order by a.created_at
),active_agency as(
  select * from my_agencies order by case when id=target_agency_id then 0 else 1 end,id limit 1
),my_clients as(
  select c.* from public.clients c where private.can_access_client(c.id) and c.agency_id=(select id from active_agency) order by c.created_at desc
)
select jsonb_build_object(
  'currentUser',(select jsonb_build_object('id',id,'email',email,'name',name,'avatarUrl',avatar_url) from me),
  'agencies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding)) from my_agencies),'[]'::jsonb),
  'activeAgency',(select jsonb_build_object('id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding) from active_agency),
  'clients',coalesce((select jsonb_agg(jsonb_build_object('id',id,'company',company,'url',url,'status',status,'createdAt',created_at,'logoUrl',logo_url,'brandColor',brand_color,'connectedSources',connected_sources_count)) from my_clients),'[]'::jsonb)
);
$$;
revoke all on function public.workspace_bootstrap(uuid) from public,anon;
grant execute on function public.workspace_bootstrap(uuid) to authenticated;
commit;
