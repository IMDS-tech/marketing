begin;
create index if not exists dashboards_client_agency_idx on public.dashboards(client_id,agency_id);
create index if not exists dashboard_sections_dashboard_agency_idx on public.dashboard_sections(dashboard_id,agency_id);
create index if not exists widgets_section_agency_idx on public.widgets(section_id,agency_id);

drop policy if exists dashboard_sections_write on public.dashboard_sections;
drop policy if exists dashboard_sections_insert on public.dashboard_sections;
drop policy if exists dashboard_sections_update on public.dashboard_sections;
drop policy if exists dashboard_sections_delete on public.dashboard_sections;
drop policy if exists widgets_write on public.widgets;
drop policy if exists widgets_insert on public.widgets;
drop policy if exists widgets_update on public.widgets;
drop policy if exists widgets_delete on public.widgets;

create policy dashboard_sections_insert on public.dashboard_sections for insert to authenticated with check(private.has_agency_permission(agency_id,'reports.manage'));
create policy dashboard_sections_update on public.dashboard_sections for update to authenticated using(private.has_agency_permission(agency_id,'reports.manage')) with check(private.has_agency_permission(agency_id,'reports.manage'));
create policy dashboard_sections_delete on public.dashboard_sections for delete to authenticated using(private.has_agency_permission(agency_id,'reports.manage'));
create policy widgets_insert on public.widgets for insert to authenticated with check(private.has_agency_permission(agency_id,'reports.manage'));
create policy widgets_update on public.widgets for update to authenticated using(private.has_agency_permission(agency_id,'reports.manage')) with check(private.has_agency_permission(agency_id,'reports.manage'));
create policy widgets_delete on public.widgets for delete to authenticated using(private.has_agency_permission(agency_id,'reports.manage'));
commit;
