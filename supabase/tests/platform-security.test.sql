begin;
select plan(16);

select has_table('public', 'agencies', 'agencies table exists');
select has_table('public', 'agency_memberships', 'agency memberships table exists');
select has_table('public', 'clients', 'clients table exists');
select has_table('public', 'client_users', 'client users table exists');
select has_table('public', 'data_sources', 'data sources table exists');
select has_table('public', 'dashboards', 'dashboards table exists');
select has_table('public', 'reports', 'reports table exists');
select has_table('public', 'agency_teams', 'agency teams table exists');

select ok((select relrowsecurity from pg_class where oid='public.agencies'::regclass), 'agencies RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.agency_memberships'::regclass), 'agency memberships RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.clients'::regclass), 'clients RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.client_users'::regclass), 'client users RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.data_sources'::regclass), 'data sources RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.dashboards'::regclass), 'dashboards RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.reports'::regclass), 'reports RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.agency_teams'::regclass), 'agency teams RLS enabled');

select * from finish();
rollback;
