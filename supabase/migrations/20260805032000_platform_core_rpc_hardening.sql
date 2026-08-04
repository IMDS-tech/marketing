begin;

revoke execute on function public.record_audit_event(uuid,text,text,text,text,jsonb) from public, anon;
revoke execute on function public.set_workspace_context(uuid,uuid) from public, anon;
revoke execute on function public.update_agency_branding(uuid,jsonb) from public, anon;
revoke execute on function public.set_agency_feature_flag(uuid,text,boolean,jsonb) from public, anon;

grant execute on function public.record_audit_event(uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.set_workspace_context(uuid,uuid) to authenticated;
grant execute on function public.update_agency_branding(uuid,jsonb) to authenticated;
grant execute on function public.set_agency_feature_flag(uuid,text,boolean,jsonb) to authenticated;

commit;
