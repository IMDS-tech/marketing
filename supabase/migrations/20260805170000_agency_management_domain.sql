begin;

alter table public.agencies
  add column if not exists legal_name text,
  add column if not exists contact_email text,
  add column if not exists country text,
  add column if not exists currency text not null default 'KZT',
  add column if not exists address jsonb not null default '{}'::jsonb,
  add column if not exists registration_number text,
  add column if not exists tax_id text,
  add column if not exists working_hours jsonb not null default '{"timezone":"Asia/Almaty","weekdays":[1,2,3,4,5],"start":"09:00","end":"18:00"}'::jsonb,
  add column if not exists agency_markup numeric(8,2) not null default 0 check (agency_markup between 0 and 10000),
  add column if not exists default_settings jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.agencies
  drop constraint if exists agencies_address_object,
  add constraint agencies_address_object check (jsonb_typeof(address)='object'),
  drop constraint if exists agencies_working_hours_object,
  add constraint agencies_working_hours_object check (jsonb_typeof(working_hours)='object'),
  drop constraint if exists agencies_default_settings_object,
  add constraint agencies_default_settings_object check (jsonb_typeof(default_settings)='object');

create table if not exists public.agency_teams (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120), description text not null default '' check (length(description)<=2000),
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'), created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(agency_id,name), unique(id,agency_id)
);
create table if not exists public.agency_team_members (
  team_id uuid not null references public.agency_teams(id) on delete cascade, agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key(team_id,user_id),
  foreign key(team_id,agency_id) references public.agency_teams(id,agency_id) on delete cascade,
  foreign key(agency_id,user_id) references public.agency_memberships(agency_id,user_id) on delete cascade
);
create table if not exists public.agency_team_clients (
  team_id uuid not null references public.agency_teams(id) on delete cascade, agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade, created_at timestamptz not null default now(), primary key(team_id,client_id),
  foreign key(team_id,agency_id) references public.agency_teams(id,agency_id) on delete cascade
);
create table if not exists public.agency_subscriptions (
  agency_id uuid primary key references public.agencies(id) on delete cascade, plan text not null default 'trial' references public.plan_entitlements(plan),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','cancelled')), billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','yearly')),
  provider text not null default 'internal', provider_customer_id text, provider_subscription_id text, current_period_start timestamptz not null default now(), current_period_end timestamptz,
  cancel_at_period_end boolean not null default false, cancelled_at timestamptz, coupon_code text, payment_method jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (jsonb_typeof(payment_method)='object')
);
create table if not exists public.agency_invoices (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade, invoice_number text not null,
  status text not null default 'draft' check (status in ('draft','open','paid','void','uncollectible')), currency text not null default 'KZT',
  subtotal numeric(14,2) not null default 0 check (subtotal>=0), discount numeric(14,2) not null default 0 check (discount>=0), total numeric(14,2) not null default 0 check (total>=0),
  issued_at timestamptz not null default now(), due_at timestamptz, paid_at timestamptz, hosted_invoice_url text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(agency_id,invoice_number), check (jsonb_typeof(metadata)='object')
);
create table if not exists public.agency_onboarding_progress (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  steps jsonb not null default '{"welcome":true,"company":false,"branding":false,"firstClient":false,"firstIntegration":false,"firstDashboard":false,"firstReport":false}'::jsonb,
  current_step text not null default 'company', completed_at timestamptz, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (jsonb_typeof(steps)='object')
);
create index if not exists agency_teams_agency_name_idx on public.agency_teams(agency_id,name);
create index if not exists agency_team_members_agency_user_idx on public.agency_team_members(agency_id,user_id);
create index if not exists agency_team_clients_agency_client_idx on public.agency_team_clients(agency_id,client_id);
create index if not exists agency_invoices_agency_issued_idx on public.agency_invoices(agency_id,issued_at desc);
create index if not exists agency_subscriptions_status_idx on public.agency_subscriptions(status,current_period_end);
insert into public.agency_subscriptions(agency_id,plan,status,current_period_end)
select a.id,a.plan,case when a.plan='trial' then 'trialing' else 'active' end,coalesce(a.trial_ends_at,now()+interval '1 month') from public.agencies a
on conflict(agency_id) do update set plan=excluded.plan;
insert into public.agency_onboarding_progress(agency_id,steps,current_step)
select a.id,jsonb_build_object('welcome',true,'company',length(trim(a.name))>0 and a.contact_email is not null,'branding',coalesce(a.branding->>'primaryColor','')<>'',
'firstClient',exists(select 1 from public.clients c where c.agency_id=a.id and c.status<>'archived'),
'firstIntegration',exists(select 1 from public.data_sources d where d.agency_id=a.id and d.status<>'disconnected'),
'firstDashboard',exists(select 1 from public.dashboards d where d.agency_id=a.id),'firstReport',exists(select 1 from public.reports r where r.agency_id=a.id)),'company'
from public.agencies a on conflict(agency_id) do nothing;
alter table public.agency_teams enable row level security;alter table public.agency_team_members enable row level security;alter table public.agency_team_clients enable row level security;
alter table public.agency_subscriptions enable row level security;alter table public.agency_invoices enable row level security;alter table public.agency_onboarding_progress enable row level security;
revoke all on public.agency_teams,public.agency_team_members,public.agency_team_clients,public.agency_subscriptions,public.agency_invoices,public.agency_onboarding_progress from anon,authenticated;
grant select on public.agency_teams,public.agency_team_members,public.agency_team_clients,public.agency_subscriptions,public.agency_invoices,public.agency_onboarding_progress to authenticated;
grant select,insert,update,delete on public.agency_teams,public.agency_team_members,public.agency_team_clients,public.agency_subscriptions,public.agency_invoices,public.agency_onboarding_progress to service_role;
create policy agency_teams_read on public.agency_teams for select to authenticated using (private.is_agency_member(agency_id));
create policy agency_team_members_read on public.agency_team_members for select to authenticated using (private.is_agency_member(agency_id));
create policy agency_team_clients_read on public.agency_team_clients for select to authenticated using (private.is_agency_member(agency_id));
create policy agency_subscriptions_read on public.agency_subscriptions for select to authenticated using (private.has_agency_permission(agency_id,'billing.read'));
create policy agency_invoices_read on public.agency_invoices for select to authenticated using (private.has_agency_permission(agency_id,'billing.read'));
create policy agency_onboarding_read on public.agency_onboarding_progress for select to authenticated using (private.is_agency_member(agency_id));
create trigger agency_teams_touch before update on public.agency_teams for each row execute function private.platform_core_touch_updated_at();
create trigger agency_subscriptions_touch before update on public.agency_subscriptions for each row execute function private.platform_core_touch_updated_at();
create trigger agency_onboarding_touch before update on public.agency_onboarding_progress for each row execute function private.platform_core_touch_updated_at();
insert into public.permission_registry(key,module,description,risk_level) values
('agency.read','agency-management','Read agency company and operating settings','standard'),('agency.manage','agency-management','Update agency company, legal and default settings','critical'),
('users.read','agency-management','Read agency users, teams and assignments','sensitive'),('users.manage','agency-management','Invite, update and deactivate agency users and teams','critical'),
('billing.read','agency-management','Read subscription, limits, usage and invoices','sensitive'),('billing.manage','agency-management','Change, cancel or resume agency subscription','critical'),
('onboarding.read','agency-management','Read agency onboarding progress','standard'),('onboarding.manage','agency-management','Update agency onboarding checklist','sensitive')
on conflict(key) do update set module=excluded.module,description=excluded.description,risk_level=excluded.risk_level,updated_at=now();
commit;
