begin;

create or replace function public.workspace_bootstrap(target_agency_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with me as (
  select
    (select auth.uid()) as id,
    coalesce(auth.jwt()->>'email', '') as email,
    coalesce(p.name, split_part(coalesce(auth.jwt()->>'email', ''), '@', 1)) as name,
    p.avatar_url
  from (select 1) seed
  left join public.user_profiles p on p.user_id = (select auth.uid())
),
my_agencies as (
  select a.id, a.name, a.slug, a.created_at, m.role, m.permissions, a.branding
  from public.agencies a
  join public.agency_memberships m on m.agency_id = a.id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  order by a.created_at, a.id
),
active_agency as (
  select *
  from my_agencies
  order by case when id = target_agency_id then 0 else 1 end, created_at, id
  limit 1
),
my_clients as (
  select c.*
  from public.clients c
  where c.agency_id = (select id from active_agency)
    and private.can_access_client(c.id)
  order by c.created_at desc
)
select jsonb_build_object(
  'currentUser', (select jsonb_build_object(
    'id', id,
    'email', email,
    'name', name,
    'avatarUrl', avatar_url
  ) from me),
  'agencies', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'role', role,
    'permissions', permissions,
    'branding', branding
  ) order by created_at, id) from my_agencies), '[]'::jsonb),
  'activeAgency', (select jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'role', role,
    'permissions', permissions,
    'branding', branding
  ) from active_agency),
  'clients', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id,
    'company', company,
    'url', url,
    'status', status,
    'createdAt', created_at,
    'logoUrl', logo_url,
    'brandColor', brand_color,
    'connectedSources', connected_sources_count
  ) order by created_at desc) from my_clients), '[]'::jsonb)
);
$$;

revoke all on function public.workspace_bootstrap(uuid) from public, anon;
grant execute on function public.workspace_bootstrap(uuid) to authenticated;

alter table public.sync_runs add column if not exists attempt integer;

with numbered as (
  select id, row_number() over (partition by sync_job_id order by started_at, id)::integer as attempt_no
  from public.sync_runs
)
update public.sync_runs r
set attempt = n.attempt_no
from numbered n
where n.id = r.id
  and r.attempt is null;

alter table public.sync_runs alter column attempt set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sync_runs'::regclass
      and conname = 'sync_runs_attempt_check'
  ) then
    alter table public.sync_runs
      add constraint sync_runs_attempt_check check (attempt > 0);
  end if;
end;
$$;

create unique index if not exists sync_runs_job_attempt_unique
  on public.sync_runs(sync_job_id, attempt);

create or replace function public.claim_marketing_sync_job(worker_id text)
returns setof public.sync_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_id uuid;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if nullif(btrim(worker_id), '') is null then
    raise exception 'worker_id is required' using errcode = '22023';
  end if;

  select id into selected_id
  from public.sync_jobs
  where state = 'queued'
    and run_after <= now()
    and attempts < max_attempts
  order by priority asc, created_at asc
  for update skip locked
  limit 1;

  if selected_id is null then
    return;
  end if;

  return query
  update public.sync_jobs
  set state = 'running',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = worker_id,
      updated_at = now()
  where id = selected_id
  returning *;
end;
$$;

drop function if exists public.complete_marketing_sync_job(uuid, integer, integer, jsonb);
drop function if exists public.fail_marketing_sync_job(uuid, jsonb, integer);

create function public.complete_marketing_sync_job(
  job_id uuid,
  worker_id text,
  fetched_rows integer,
  written_rows integer,
  run_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_job public.sync_jobs%rowtype;
  affected integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if nullif(btrim(worker_id), '') is null then
    raise exception 'worker_id is required' using errcode = '22023';
  end if;

  select * into claimed_job
  from public.sync_jobs
  where id = job_id
  for update;

  if not found then
    raise exception 'sync job not found' using errcode = 'P0002';
  end if;
  if claimed_job.state <> 'running' or claimed_job.locked_by is distinct from worker_id then
    raise exception 'sync job lock is not owned by worker' using errcode = '55000';
  end if;

  insert into public.sync_runs(
    agency_id, sync_job_id, data_source_id, attempt, state,
    started_at, finished_at, rows_fetched, rows_written, metadata
  ) values (
    claimed_job.agency_id, claimed_job.id, claimed_job.data_source_id, claimed_job.attempts, 'succeeded',
    coalesce(claimed_job.locked_at, claimed_job.created_at), now(),
    greatest(coalesce(fetched_rows, 0), 0), greatest(coalesce(written_rows, 0), 0),
    coalesce(run_metadata, '{}'::jsonb)
  );

  update public.sync_jobs
  set state = 'succeeded',
      locked_at = null,
      locked_by = null,
      last_error = null,
      updated_at = now()
  where id = claimed_job.id
    and state = 'running'
    and locked_by = worker_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'sync job ownership changed while completing' using errcode = '40001';
  end if;

  update public.data_sources
  set status = 'connected',
      last_sync_at = now(),
      sync_error = null,
      updated_at = now()
  where id = claimed_job.data_source_id
    and agency_id = claimed_job.agency_id;
end;
$$;

create function public.fail_marketing_sync_job(
  job_id uuid,
  worker_id text,
  failure jsonb,
  retry_delay_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_job public.sync_jobs%rowtype;
  exhausted boolean;
  affected integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if nullif(btrim(worker_id), '') is null then
    raise exception 'worker_id is required' using errcode = '22023';
  end if;

  select * into claimed_job
  from public.sync_jobs
  where id = job_id
  for update;

  if not found then
    raise exception 'sync job not found' using errcode = 'P0002';
  end if;
  if claimed_job.state <> 'running' or claimed_job.locked_by is distinct from worker_id then
    raise exception 'sync job lock is not owned by worker' using errcode = '55000';
  end if;

  exhausted := claimed_job.attempts >= claimed_job.max_attempts;

  insert into public.sync_runs(
    agency_id, sync_job_id, data_source_id, attempt, state,
    started_at, finished_at, error
  ) values (
    claimed_job.agency_id, claimed_job.id, claimed_job.data_source_id, claimed_job.attempts, 'failed',
    coalesce(claimed_job.locked_at, claimed_job.created_at), now(), coalesce(failure, '{}'::jsonb)
  );

  update public.sync_jobs
  set state = case when exhausted then 'failed'::public.sync_job_state else 'queued'::public.sync_job_state end,
      run_after = case
        when exhausted then run_after
        else now() + make_interval(secs => greatest(coalesce(retry_delay_seconds, 0), 0))
      end,
      locked_at = null,
      locked_by = null,
      last_error = coalesce(failure, '{}'::jsonb),
      updated_at = now()
  where id = claimed_job.id
    and state = 'running'
    and locked_by = worker_id;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'sync job ownership changed while failing' using errcode = '40001';
  end if;

  update public.data_sources
  set status = case when exhausted then 'error'::public.data_source_status else status end,
      sync_error = coalesce(failure, '{}'::jsonb),
      updated_at = now()
  where id = claimed_job.data_source_id
    and agency_id = claimed_job.agency_id;
end;
$$;

revoke all on function public.claim_marketing_sync_job(text) from public, anon, authenticated;
revoke all on function public.complete_marketing_sync_job(uuid, text, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.fail_marketing_sync_job(uuid, text, jsonb, integer) from public, anon, authenticated;

grant execute on function public.claim_marketing_sync_job(text) to service_role;
grant execute on function public.complete_marketing_sync_job(uuid, text, integer, integer, jsonb) to service_role;
grant execute on function public.fail_marketing_sync_job(uuid, text, jsonb, integer) to service_role;

commit;
