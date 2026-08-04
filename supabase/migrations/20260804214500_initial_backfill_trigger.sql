begin;

create or replace function private.enqueue_initial_data_source_backfill()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  window_end date := current_date;
  window_start date;
  sequence_no integer := 0;
begin
  while window_end >= current_date - 364 loop
    window_start := greatest(current_date - 364, window_end - 29);
    insert into public.sync_jobs(
      agency_id,data_source_id,period_from,period_to,state,priority,payload,dedupe_key
    ) values (
      new.agency_id,new.id,window_start,window_end,'queued',
      case when sequence_no = 0 then 10 else 100 + sequence_no end,
      jsonb_build_object('kind','initial_backfill','sequence',sequence_no),
      'initial:'||new.id::text||':'||window_start::text||':'||window_end::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
    sequence_no := sequence_no + 1;
    window_end := window_start - 1;
  end loop;
  return new;
end;
$$;

revoke all on function private.enqueue_initial_data_source_backfill() from public,anon,authenticated;

drop trigger if exists data_sources_initial_backfill on public.data_sources;
create trigger data_sources_initial_backfill
after insert on public.data_sources
for each row execute function private.enqueue_initial_data_source_backfill();

commit;
