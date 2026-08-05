begin;

insert into public.permission_registry(key,module,description,risk_level) values
  ('backend.read','backend-services','Read backend service health and operational data','standard'),
  ('backend.manage','backend-services','Manage backend service configuration and operations','critical'),
  ('notifications.read','notification-worker','Read notification jobs and delivery history','standard'),
  ('notifications.manage','notification-worker','Create and manage notification delivery jobs','sensitive'),
  ('ai.use','ai-service','Execute tenant-scoped AI requests','sensitive'),
  ('ai.read','ai-service','Read AI templates and usage history','sensitive'),
  ('ai.manage','ai-service','Manage AI templates, providers and safety policy','critical'),
  ('search.read','search-indexer','Search tenant-scoped indexed entities','standard'),
  ('search.manage','search-indexer','Rebuild and manage tenant search indexes','sensitive')
on conflict(key) do update set module=excluded.module,description=excluded.description,risk_level=excluded.risk_level,updated_at=now();

create table public.notification_jobs(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check(channel in ('email','in_app','slack','telegram','webhook')),
  recipient text not null check(length(recipient) between 1 and 2000),
  template_key text not null check(template_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$'),
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'queued' check(state in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0 check(attempts>=0),
  max_attempts integer not null default 5 check(max_attempts between 1 and 25),
  priority smallint not null default 100,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  dedupe_key text,
  last_error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete cascade
);
create unique index notification_jobs_active_dedupe_idx on public.notification_jobs(dedupe_key) where dedupe_key is not null and state in ('queued','running');
create index notification_jobs_queue_idx on public.notification_jobs(state,run_after,priority,created_at);
create index notification_jobs_agency_idx on public.notification_jobs(agency_id,created_at desc);

create table public.notification_deliveries(
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  channel text not null,
  attempt integer not null check(attempt>0),
  status text not null check(status in ('succeeded','failed')),
  provider_message_id text,
  response jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  unique(job_id,attempt)
);
create index notification_deliveries_agency_idx on public.notification_deliveries(agency_id,created_at desc);

create table public.ai_prompt_templates(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  key text not null check(key ~ '^[a-z][a-z0-9-]{1,99}$'),
  name text not null,
  description text not null default '',
  system_prompt text not null,
  user_prompt_template text not null,
  model text,
  temperature numeric(3,2) not null default 0.20 check(temperature between 0 and 2),
  tools text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ai_prompt_templates_agency_key_idx on public.ai_prompt_templates(agency_id,key) where agency_id is not null;
create unique index ai_prompt_templates_global_key_idx on public.ai_prompt_templates(key) where agency_id is null;

create table public.ai_requests(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  template_id uuid references public.ai_prompt_templates(id) on delete set null,
  provider text not null,
  model text not null,
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled')),
  input text not null,
  context jsonb not null default '{}'::jsonb,
  output text,
  tools text[] not null default '{}',
  safety jsonb not null default '{}'::jsonb,
  prompt_tokens integer not null default 0 check(prompt_tokens>=0),
  completion_tokens integer not null default 0 check(completion_tokens>=0),
  total_tokens integer not null default 0 check(total_tokens>=0),
  idempotency_key text,
  error jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete cascade
);
create unique index ai_requests_idempotency_idx on public.ai_requests(agency_id,idempotency_key) where idempotency_key is not null;
create index ai_requests_agency_created_idx on public.ai_requests(agency_id,created_at desc);
create index ai_requests_user_created_idx on public.ai_requests(user_id,created_at desc);

create table public.search_documents(
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  entity_type text not null check(entity_type ~ '^[a-z][a-z0-9_-]{1,79}$'),
  entity_id text not null,
  title text not null,
  content text not null default '',
  url text,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig,coalesce(title,'')||' '||coalesce(content,''))) stored,
  indexed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agency_id,entity_type,entity_id),
  foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete cascade
);
create index search_documents_vector_idx on public.search_documents using gin(search_vector);
create index search_documents_agency_type_idx on public.search_documents(agency_id,entity_type,updated_at desc);
create index search_documents_client_idx on public.search_documents(client_id,updated_at desc);

create table public.search_index_jobs(
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  operation text not null default 'upsert' check(operation in ('upsert','delete','rebuild')),
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'queued' check(state in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0 check(attempts>=0),
  max_attempts integer not null default 5 check(max_attempts between 1 and 25),
  priority smallint not null default 100,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  dedupe_key text,
  last_error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key(client_id,agency_id) references public.clients(id,agency_id) on delete cascade
);
create unique index search_index_jobs_active_dedupe_idx on public.search_index_jobs(dedupe_key) where dedupe_key is not null and state in ('queued','running');
create index search_index_jobs_queue_idx on public.search_index_jobs(state,run_after,priority,created_at);
create index search_index_jobs_agency_idx on public.search_index_jobs(agency_id,created_at desc);

create or replace function public.claim_notification_job(worker_id text)
returns setof public.notification_jobs language plpgsql security definer set search_path=''
as $$
declare selected_id uuid;
begin
  select id into selected_id from public.notification_jobs
  where state='queued' and run_after<=now() and attempts<max_attempts
  order by priority,created_at for update skip locked limit 1;
  if selected_id is null then return; end if;
  return query update public.notification_jobs set state='running',attempts=attempts+1,locked_at=now(),locked_by=worker_id,updated_at=now()
    where id=selected_id returning *;
end;
$$;

create or replace function public.complete_notification_job(job_id uuid,worker_id text,provider_message_id text,response jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$
begin
  insert into public.notification_deliveries(agency_id,job_id,channel,attempt,status,provider_message_id,response)
  select agency_id,id,channel,attempts,'succeeded',provider_message_id,coalesce(response,'{}'::jsonb)
  from public.notification_jobs where id=job_id and state='running' and locked_by=worker_id;
  update public.notification_jobs set state='succeeded',locked_at=null,locked_by=null,last_error=null,finished_at=now(),updated_at=now()
  where id=job_id and state='running' and locked_by=worker_id;
end;
$$;

create or replace function public.fail_notification_job(job_id uuid,worker_id text,failure jsonb,retry_delay_seconds integer default 60)
returns void language plpgsql security definer set search_path=''
as $$
declare exhausted boolean;
begin
  select attempts>=max_attempts into exhausted from public.notification_jobs where id=job_id and state='running' and locked_by=worker_id for update;
  if exhausted is null then return; end if;
  insert into public.notification_deliveries(agency_id,job_id,channel,attempt,status,error)
  select agency_id,id,channel,attempts,'failed',coalesce(failure,'{}'::jsonb) from public.notification_jobs where id=job_id;
  update public.notification_jobs set state=case when exhausted then 'failed' else 'queued' end,
    run_after=case when exhausted then run_after else now()+make_interval(secs=>greatest(retry_delay_seconds,0)) end,
    locked_at=null,locked_by=null,last_error=coalesce(failure,'{}'::jsonb),finished_at=case when exhausted then now() else null end,updated_at=now()
  where id=job_id;
end;
$$;

revoke all on function public.claim_notification_job(text),public.complete_notification_job(uuid,text,text,jsonb),public.fail_notification_job(uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_job(text),public.complete_notification_job(uuid,text,text,jsonb),public.fail_notification_job(uuid,text,jsonb,integer) to service_role;

create or replace function private.queue_search_index_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare data jsonb;agency uuid;client uuid;entity text;identifier text;operation text;title text;content text;target_url text;
begin
  data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  agency=(data->>'agency_id')::uuid;identifier=data->>'id';operation=case when tg_op='DELETE' then 'delete' else 'upsert' end;
  if tg_table_name='clients' then entity='client';client=identifier::uuid;title=coalesce(data->>'company',identifier);content=concat_ws(' ',data->>'url',data->>'country',data->>'language',data->>'status');target_url='/client/'||identifier;
  elsif tg_table_name='dashboards' then entity='dashboard';client=nullif(data->>'client_id','')::uuid;title=coalesce(data->>'name',identifier);content=coalesce(data->>'settings','');target_url='/client/'||coalesce(data->>'client_id','')||'/dashboards/'||identifier;
  elsif tg_table_name='reports' then entity='report';client=nullif(data->>'client_id','')::uuid;title=coalesce(data->>'name',identifier);content=concat_ws(' ',data->>'description',data->>'status');target_url='/reports/'||identifier;
  else
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  insert into public.search_index_jobs(agency_id,client_id,entity_type,entity_id,operation,payload,dedupe_key)
  values(agency,client,entity,identifier,operation,jsonb_build_object('title',title,'content',content,'url',target_url,'metadata',data),operation||':'||agency::text||':'||entity||':'||identifier)
  on conflict(dedupe_key) where dedupe_key is not null and state in ('queued','running')
  do update set operation=excluded.operation,payload=excluded.payload,run_after=now(),updated_at=now();
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.queue_search_index_change() from public,anon,authenticated;

drop trigger if exists clients_search_index_trigger on public.clients;
create trigger clients_search_index_trigger after insert or update or delete on public.clients for each row execute function private.queue_search_index_change();
drop trigger if exists dashboards_search_index_trigger on public.dashboards;
create trigger dashboards_search_index_trigger after insert or update or delete on public.dashboards for each row execute function private.queue_search_index_change();
do $$ begin
  if to_regclass('public.reports') is not null then
    execute 'drop trigger if exists reports_search_index_trigger on public.reports';
    execute 'create trigger reports_search_index_trigger after insert or update or delete on public.reports for each row execute function private.queue_search_index_change()';
  end if;
end $$;

insert into public.ai_prompt_templates(agency_id,key,name,description,system_prompt,user_prompt_template,model,temperature,tools)
select null,'general-assistant','General Assistant','Tenant-scoped marketing assistant','You are a marketing analytics assistant. Be precise, concise and transparent about uncertainty.','Context:\n{{context}}\n\nUser request:\n{{input}}',null,0.20,array['search']
where not exists(select 1 from public.ai_prompt_templates where agency_id is null and key='general-assistant');
insert into public.ai_prompt_templates(agency_id,key,name,description,system_prompt,user_prompt_template,model,temperature,tools)
select null,'performance-insight','Performance Insight','Explains recent marketing performance','Analyze the supplied marketing metrics. Separate observations, likely causes and recommended checks. Do not claim causality without evidence.','Context:\n{{context}}\n\nAnalyze:\n{{input}}',null,0.15,array['search','metric-summary']
where not exists(select 1 from public.ai_prompt_templates where agency_id is null and key='performance-insight');

alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.ai_prompt_templates enable row level security;
alter table public.ai_requests enable row level security;
alter table public.search_documents enable row level security;
alter table public.search_index_jobs enable row level security;

drop policy if exists notification_jobs_read on public.notification_jobs;
create policy notification_jobs_read on public.notification_jobs for select to authenticated using(private.has_agency_permission(agency_id,'notifications.read'));
drop policy if exists notification_deliveries_read on public.notification_deliveries;
create policy notification_deliveries_read on public.notification_deliveries for select to authenticated using(private.has_agency_permission(agency_id,'notifications.read'));
drop policy if exists ai_prompt_templates_read on public.ai_prompt_templates;
create policy ai_prompt_templates_read on public.ai_prompt_templates for select to authenticated using(agency_id is null or private.is_agency_member(agency_id));
drop policy if exists ai_requests_read on public.ai_requests;
create policy ai_requests_read on public.ai_requests for select to authenticated using(private.is_agency_member(agency_id) and (user_id=(select auth.uid()) or private.has_agency_permission(agency_id,'ai.read')));
drop policy if exists search_documents_read on public.search_documents;
create policy search_documents_read on public.search_documents for select to authenticated using(private.is_agency_member(agency_id) and (client_id is null or private.can_access_client(client_id)));
drop policy if exists search_index_jobs_read on public.search_index_jobs;
create policy search_index_jobs_read on public.search_index_jobs for select to authenticated using(private.has_agency_permission(agency_id,'search.manage'));

revoke all on public.notification_jobs,public.notification_deliveries,public.ai_prompt_templates,public.ai_requests,public.search_documents,public.search_index_jobs from anon,authenticated;
grant select on public.notification_jobs,public.notification_deliveries,public.ai_prompt_templates,public.ai_requests,public.search_documents,public.search_index_jobs to authenticated;
grant select,insert,update,delete on public.notification_jobs,public.notification_deliveries,public.ai_prompt_templates,public.ai_requests,public.search_documents,public.search_index_jobs to service_role;
grant usage,select on sequence public.notification_deliveries_id_seq,public.search_documents_id_seq to service_role;

commit;
