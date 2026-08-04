begin;

create or replace function public.claim_marketing_sync_job(worker_id text)
returns setof public.sync_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare selected_id uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service_role required' using errcode='42501'; end if;
  select id into selected_id
  from public.sync_jobs
  where state='queued' and run_after <= now() and attempts < max_attempts
  order by priority asc, created_at asc
  for update skip locked
  limit 1;
  if selected_id is null then return; end if;
  return query update public.sync_jobs
    set state='running',attempts=attempts+1,locked_at=now(),locked_by=worker_id,updated_at=now()
    where id=selected_id returning *;
end;
$$;

create or replace function public.complete_marketing_sync_job(job_id uuid, fetched_rows integer, written_rows integer, run_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service_role required' using errcode='42501'; end if;
  insert into public.sync_runs(agency_id,sync_job_id,data_source_id,state,started_at,finished_at,rows_fetched,rows_written,metadata)
  select agency_id,id,data_source_id,'succeeded',coalesce(locked_at,created_at),now(),greatest(fetched_rows,0),greatest(written_rows,0),coalesce(run_metadata,'{}'::jsonb)
  from public.sync_jobs where id=job_id;
  update public.sync_jobs set state='succeeded',locked_at=null,locked_by=null,last_error=null,updated_at=now() where id=job_id and state='running';
  update public.data_sources ds set status='connected',last_sync_at=now(),sync_error=null,updated_at=now()
  from public.sync_jobs j where j.id=job_id and ds.id=j.data_source_id and ds.agency_id=j.agency_id;
end;
$$;

create or replace function public.fail_marketing_sync_job(job_id uuid, failure jsonb, retry_delay_seconds integer default 300)
returns void language plpgsql security definer set search_path=''
as $$
declare exhausted boolean;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service_role required' using errcode='42501'; end if;
  select attempts >= max_attempts into exhausted from public.sync_jobs where id=job_id for update;
  insert into public.sync_runs(agency_id,sync_job_id,data_source_id,state,started_at,finished_at,error)
  select agency_id,id,data_source_id,'failed',coalesce(locked_at,created_at),now(),coalesce(failure,'{}'::jsonb)
  from public.sync_jobs where id=job_id;
  update public.sync_jobs set state=case when exhausted then 'failed'::public.sync_job_state else 'queued'::public.sync_job_state end,
    run_after=case when exhausted then run_after else now()+make_interval(secs=>greatest(retry_delay_seconds,0)) end,
    locked_at=null,locked_by=null,last_error=coalesce(failure,'{}'::jsonb),updated_at=now() where id=job_id;
  update public.data_sources ds set status=case when exhausted then 'error'::public.data_source_status else ds.status end,
    sync_error=coalesce(failure,'{}'::jsonb),updated_at=now()
  from public.sync_jobs j where j.id=job_id and ds.id=j.data_source_id and ds.agency_id=j.agency_id;
end;
$$;

revoke all on function public.claim_marketing_sync_job(text),public.complete_marketing_sync_job(uuid,integer,integer,jsonb),public.fail_marketing_sync_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_marketing_sync_job(text),public.complete_marketing_sync_job(uuid,integer,integer,jsonb),public.fail_marketing_sync_job(uuid,jsonb,integer) to service_role;

commit;
