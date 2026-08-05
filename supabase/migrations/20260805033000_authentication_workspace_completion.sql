begin;

create table if not exists public.workspace_recent_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  title text not null,
  route text not null,
  visited_at timestamptz not null default now(),
  unique (user_id, agency_id, item_type, item_id)
);
create index if not exists workspace_recent_items_user_visited_idx on public.workspace_recent_items(user_id,visited_at desc);
create index if not exists workspace_recent_items_agency_visited_idx on public.workspace_recent_items(agency_id,visited_at desc);
create index if not exists workspace_recent_items_client_idx on public.workspace_recent_items(client_id);
create index if not exists agency_entitlement_overrides_updated_by_idx on public.agency_entitlement_overrides(updated_by);
create index if not exists agency_feature_flags_updated_by_idx on public.agency_feature_flags(updated_by);

alter table public.workspace_recent_items enable row level security;
revoke all on public.workspace_recent_items from anon;
grant select,insert,update,delete on public.workspace_recent_items to authenticated;
create policy workspace_recent_items_select on public.workspace_recent_items for select to authenticated using (user_id=(select auth.uid()) and private.is_agency_member(agency_id));
create policy workspace_recent_items_insert on public.workspace_recent_items for insert to authenticated with check (user_id=(select auth.uid()) and private.is_agency_member(agency_id) and (client_id is null or private.can_access_client(client_id)));
create policy workspace_recent_items_update on public.workspace_recent_items for update to authenticated using (user_id=(select auth.uid()) and private.is_agency_member(agency_id)) with check (user_id=(select auth.uid()) and private.is_agency_member(agency_id) and (client_id is null or private.can_access_client(client_id)));
create policy workspace_recent_items_delete on public.workspace_recent_items for delete to authenticated using (user_id=(select auth.uid()) and private.is_agency_member(agency_id));

create or replace function public.list_my_auth_sessions()
returns jsonb language sql stable security definer set search_path='' as $$
select case when (select auth.uid()) is null then '[]'::jsonb else coalesce((
  select jsonb_agg(jsonb_build_object(
    'id',s.id,'createdAt',s.created_at,'updatedAt',s.updated_at,'refreshedAt',s.refreshed_at,
    'notAfter',s.not_after,'aal',coalesce(s.aal::text,'aal1'),'userAgent',s.user_agent,
    'ipAddress',case when s.ip is null then null else host(s.ip) end,
    'isCurrent',s.id::text=coalesce(auth.jwt()->>'session_id','')
  ) order by coalesce(s.refreshed_at at time zone 'UTC',s.updated_at,s.created_at) desc)
  from auth.sessions s where s.user_id=(select auth.uid())
),'[]'::jsonb) end;
$$;

create or replace function public.list_my_auth_activity(max_items integer default 50)
returns jsonb language sql stable security definer set search_path='' as $$
select case when (select auth.uid()) is null then '[]'::jsonb else coalesce((
  select jsonb_agg(event order by event_created_at desc) from (
    select e.created_at event_created_at,jsonb_build_object(
      'id',e.id,'action',coalesce(e.payload::jsonb->>'action',e.payload::jsonb->>'log_type','auth_event'),
      'createdAt',e.created_at,'ipAddress',nullif(e.ip_address,''),
      'userAgent',coalesce(e.payload::jsonb->>'user_agent',e.payload::jsonb#>>'{traits,user_agent}'),
      'provider',coalesce(e.payload::jsonb->>'provider',e.payload::jsonb#>>'{traits,provider}')
    ) event
    from auth.audit_log_entries e
    where coalesce(e.payload::jsonb->>'actor_id',e.payload::jsonb->>'user_id',e.payload::jsonb#>>'{traits,user_id}')=(select auth.uid())::text
    order by e.created_at desc limit greatest(1,least(coalesce(max_items,50),100))
  ) events
),'[]'::jsonb) end;
$$;

create or replace function public.update_workspace_preferences(target_language text default null,target_timezone text default null,target_theme text default null,target_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.user_preferences%rowtype; agency_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if target_language is not null and target_language not in ('en','ru','kk') then raise exception 'LANGUAGE_INVALID'; end if;
  if target_timezone is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=target_timezone) then raise exception 'TIMEZONE_INVALID'; end if;
  if target_theme is not null and target_theme not in ('system','light','dark') then raise exception 'THEME_INVALID'; end if;
  if target_settings is not null and jsonb_typeof(target_settings)<>'object' then raise exception 'SETTINGS_INVALID'; end if;
  insert into public.user_preferences(user_id,language,timezone,theme,settings)
  values((select auth.uid()),coalesce(target_language,'ru'),coalesce(target_timezone,'Asia/Almaty'),coalesce(target_theme,'system'),coalesce(target_settings,'{}'::jsonb))
  on conflict(user_id) do update set language=coalesce(target_language,public.user_preferences.language),timezone=coalesce(target_timezone,public.user_preferences.timezone),theme=coalesce(target_theme,public.user_preferences.theme),settings=case when target_settings is null then public.user_preferences.settings else public.user_preferences.settings||target_settings end,updated_at=now()
  returning * into result;
  agency_id:=result.active_agency_id;
  if agency_id is not null and private.is_agency_member(agency_id) then perform private.platform_core_write_audit(agency_id,'workspace.preferences_updated','update','user_preferences',(select auth.uid())::text,jsonb_build_object('language',result.language,'timezone',result.timezone,'theme',result.theme)); end if;
  return jsonb_build_object('language',result.language,'timezone',result.timezone,'theme',result.theme,'settings',result.settings);
end;
$$;

create or replace function public.record_workspace_recent_item(target_agency_id uuid,target_client_id uuid,target_item_type text,target_item_id text,target_title text,target_route text)
returns bigint language plpgsql security definer set search_path='' as $$
declare recent_id bigint;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_agency_member(target_agency_id) then raise exception 'AGENCY_ACCESS_DENIED'; end if;
  if target_client_id is not null and not exists(select 1 from public.clients c where c.id=target_client_id and c.agency_id=target_agency_id and private.can_access_client(c.id)) then raise exception 'CLIENT_ACCESS_DENIED'; end if;
  if length(trim(coalesce(target_item_type,'')))=0 or length(trim(coalesce(target_item_id,'')))=0 or length(trim(coalesce(target_title,'')))=0 or target_route is null or left(target_route,1)<>'/' then raise exception 'RECENT_ITEM_INVALID'; end if;
  insert into public.workspace_recent_items(user_id,agency_id,client_id,item_type,item_id,title,route,visited_at)
  values((select auth.uid()),target_agency_id,target_client_id,target_item_type,target_item_id,target_title,target_route,now())
  on conflict(user_id,agency_id,item_type,item_id) do update set client_id=excluded.client_id,title=excluded.title,route=excluded.route,visited_at=now()
  returning id into recent_id;
  return recent_id;
end;
$$;

create or replace function public.workspace_bootstrap(target_agency_id uuid default null)
returns jsonb language sql stable set search_path='' as $$
with me as (
  select (select auth.uid()) id,coalesce(auth.jwt()->>'email','') email,coalesce(p.name,split_part(coalesce(auth.jwt()->>'email',''),'@',1)) name,p.avatar_url
  from (select 1) seed left join public.user_profiles p on p.user_id=(select auth.uid())
),prefs as (select up.* from public.user_preferences up where up.user_id=(select auth.uid())),
my_agencies as (
  select a.id,a.name,a.slug,a.created_at,a.plan,a.trial_ends_at,m.role,m.permissions,a.branding
  from public.agencies a join public.agency_memberships m on m.agency_id=a.id
  where m.user_id=(select auth.uid()) and m.status='active' order by a.created_at,a.id
),active_agency as (
  select * from my_agencies order by case when id=coalesce(target_agency_id,(select active_agency_id from prefs)) then 0 else 1 end,created_at,id limit 1
),my_clients as (
  select c.* from public.clients c where c.agency_id=(select id from active_agency) and private.can_access_client(c.id) order by c.created_at desc
),active_client as (
  select c.id from my_clients c where not exists(select 1 from prefs) or c.id=(select active_client_id from prefs) order by c.created_at desc,c.id limit 1
),recent_items as (
  select r.* from public.workspace_recent_items r where r.user_id=(select auth.uid()) and r.agency_id=(select id from active_agency) order by r.visited_at desc limit 12
)
select jsonb_build_object(
  'currentUser',(select jsonb_build_object('id',id,'email',email,'name',name,'avatarUrl',avatar_url) from me),
  'agencies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding,'plan',plan,'trialEndsAt',trial_ends_at) order by created_at,id) from my_agencies),'[]'::jsonb),
  'activeAgency',(select jsonb_build_object('id',id,'name',name,'slug',slug,'role',role,'permissions',permissions,'branding',branding,'plan',plan,'trialEndsAt',trial_ends_at) from active_agency),
  'clients',coalesce((select jsonb_agg(jsonb_build_object('id',id,'company',company,'url',url,'status',status,'createdAt',created_at,'logoUrl',logo_url,'brandColor',brand_color,'connectedSources',connected_sources_count) order by created_at desc) from my_clients),'[]'::jsonb),
  'activeClientId',(select id from active_client),
  'productContext',jsonb_build_object('id','marketing','name','IMDS Marketing','surface','workspace','route','/'),
  'entitlements',private.effective_entitlements((select id from active_agency)),
  'featureFlags',private.effective_feature_flags((select id from active_agency)),
  'preferences',coalesce((select jsonb_build_object('language',language,'timezone',timezone,'theme',theme,'settings',settings) from prefs),jsonb_build_object('language','ru','timezone','Asia/Almaty','theme','system','settings','{}'::jsonb)),
  'recentItems',coalesce((select jsonb_agg(jsonb_build_object('id',id,'clientId',client_id,'itemType',item_type,'itemId',item_id,'title',title,'route',route,'visitedAt',visited_at) order by visited_at desc) from recent_items),'[]'::jsonb)
);
$$;

revoke all on function public.list_my_auth_sessions() from public,anon;
revoke all on function public.list_my_auth_activity(integer) from public,anon;
revoke all on function public.update_workspace_preferences(text,text,text,jsonb) from public,anon;
revoke all on function public.record_workspace_recent_item(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.list_my_auth_sessions() to authenticated;
grant execute on function public.list_my_auth_activity(integer) to authenticated;
grant execute on function public.update_workspace_preferences(text,text,text,jsonb) to authenticated;
grant execute on function public.record_workspace_recent_item(uuid,uuid,text,text,text,text) to authenticated;

commit;
