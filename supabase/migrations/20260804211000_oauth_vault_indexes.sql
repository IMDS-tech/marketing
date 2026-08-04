begin;
create index oauth_states_agency_idx on private.oauth_states(agency_id);
create index oauth_states_client_idx on private.oauth_states(client_id);
create index oauth_states_user_idx on private.oauth_states(user_id);
create index integration_credentials_user_idx on private.integration_credentials(user_id);
commit;
