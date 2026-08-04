begin;

alter table public.sync_jobs add column if not exists dedupe_key text;
create unique index if not exists sync_jobs_dedupe_key_unique on public.sync_jobs(dedupe_key) where dedupe_key is not null;

create or replace function public.enqueue_marketing_resync_jobs(target_date date default current_date)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare inserted_count integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role required' using errcode='42501';
  end if;

  insert into public.sync_jobs(agency_id,data_source_id,period_from,period_to,state,priority,payload,dedupe_key)
  select ds.agency_id,ds.id,target_date-29,target_date,'queued',50,
    jsonb_build_object('kind','rolling_resync','scheduled_for',target_date),
    'rolling:'||ds.id::text||':'||target_date::text
  from public.data_sources ds
  where ds.status in ('connected','error')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_marketing_resync_jobs(date) from public,anon,authenticated;
grant execute on function public.enqueue_marketing_resync_jobs(date) to service_role;

commit;
