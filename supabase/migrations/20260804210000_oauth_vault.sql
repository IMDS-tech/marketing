begin;
create table private.oauth_states(id uuid primary key,state_hash text not null unique,provider text not null,agency_id uuid not null references public.agencies(id) on delete cascade,client_id uuid not null references public.clients(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,code_verifier text not null,redirect_uri text not null,return_origin text not null,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now());
create index oauth_states_expiry_idx on private.oauth_states(expires_at);
create table private.integration_credentials(handle uuid primary key,agency_id uuid not null references public.agencies(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,provider text not null,ciphertext text not null,iv text not null,tag text not null,key_version integer not null default 1,expires_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index integration_credentials_agency_provider_idx on private.integration_credentials(agency_id,provider) where revoked_at is null;
revoke all on private.oauth_states,private.integration_credentials from public,anon,authenticated;
grant select,insert,update,delete on private.oauth_states,private.integration_credentials to service_role;
commit;
