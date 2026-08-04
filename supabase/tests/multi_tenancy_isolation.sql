begin;

do $$
declare
  admin_a uuid:=gen_random_uuid();
  admin_b uuid:=gen_random_uuid();
  client_user uuid:=gen_random_uuid();
  agency_a uuid:=gen_random_uuid();
  agency_b uuid:=gen_random_uuid();
  client_a uuid:=gen_random_uuid();
  client_a2 uuid:=gen_random_uuid();
  client_b uuid:=gen_random_uuid();
begin
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at,is_anonymous)
  values
    (admin_a,'authenticated','authenticated','mt-admin-a@example.invalid','',now(),now(),false),
    (admin_b,'authenticated','authenticated','mt-admin-b@example.invalid','',now(),now(),false),
    (client_user,'authenticated','authenticated','mt-client@example.invalid','',now(),now(),false);

  insert into public.agencies(id,name,slug)
  values(agency_a,'Tenant A','tenant-a-'||left(replace(agency_a::text,'-',''),8)),
        (agency_b,'Tenant B','tenant-b-'||left(replace(agency_b::text,'-',''),8));

  insert into public.agency_memberships(agency_id,user_id,role,permissions,status)
  values
    (agency_a,admin_a,'admin','{}','active'),
    (agency_b,admin_b,'admin','{}','active'),
    (agency_a,client_user,'client','{}','active');

  insert into public.clients(id,agency_id,company)
  values(client_a,agency_a,'Client A'),(client_a2,agency_a,'Client A2'),(client_b,agency_b,'Client B');

  insert into public.client_users(client_id,user_id,permissions)
  values(client_a,client_user,array['client.read','client.storage.write']);

  perform set_config('request.jwt.claim.sub',client_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  if not private.can_access_client(client_a) then
    raise exception 'assigned client must be accessible';
  end if;
  if private.can_access_client(client_a2) then
    raise exception 'client role leaked to another client in the same agency';
  end if;
  if private.can_access_client(client_b) then
    raise exception 'cross-agency client leak detected';
  end if;
  if private.has_agency_scope(agency_a) then
    raise exception 'client role received agency-wide scope';
  end if;
  if not private.can_read_tenant_storage(agency_a||'/clients/'||client_a||'/reports/report.pdf') then
    raise exception 'assigned client storage should be readable';
  end if;
  if private.can_read_tenant_storage(agency_a||'/clients/'||client_a2||'/reports/report.pdf') then
    raise exception 'unassigned client storage leaked';
  end if;
  if private.can_read_tenant_storage(agency_b||'/clients/'||client_b||'/reports/report.pdf') then
    raise exception 'cross-agency storage leaked';
  end if;
  if private.tenant_storage_path_is_valid('../secret.txt') then
    raise exception 'unsafe storage traversal path accepted';
  end if;

  perform set_config('request.jwt.claim.sub',admin_a::text,true);
  if not private.has_agency_scope(agency_a) then
    raise exception 'agency admin should have agency scope';
  end if;
  if not private.can_access_client(client_a2) then
    raise exception 'agency admin should access all own-agency clients';
  end if;
  if private.can_access_client(client_b) then
    raise exception 'agency admin leaked into another agency';
  end if;
end;
$$;

select
  has_table_privilege('anon','storage.objects','select') = false as anon_storage_select_revoked,
  has_function_privilege('anon','public.workspace_bootstrap(uuid)','execute') = false as anon_workspace_rpc_revoked,
  (select relforcerowsecurity from pg_class where oid='public.clients'::regclass) as clients_force_rls,
  exists(select 1 from storage.buckets where id='tenant-assets' and public=false) as private_tenant_bucket,
  (select count(*)=4 from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'tenant_assets_%') as storage_policy_set_complete;

rollback;
