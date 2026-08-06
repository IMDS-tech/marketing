begin;

drop policy if exists dashboards_insert on public.dashboards;
drop policy if exists dashboards_update on public.dashboards;
drop policy if exists dashboards_delete on public.dashboards;
drop policy if exists dashboard_sections_insert on public.dashboard_sections;
drop policy if exists dashboard_sections_update on public.dashboard_sections;
drop policy if exists dashboard_sections_delete on public.dashboard_sections;
drop policy if exists widgets_insert on public.widgets;
drop policy if exists widgets_update on public.widgets;
drop policy if exists widgets_delete on public.widgets;

create policy dashboards_insert on public.dashboards for insert to authenticated
with check ((private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage')) and private.can_access_client(client_id));
create policy dashboards_update on public.dashboards for update to authenticated
using (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'))
with check ((private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage')) and private.can_access_client(client_id));
create policy dashboards_delete on public.dashboards for delete to authenticated
using (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'));

create policy dashboard_sections_insert on public.dashboard_sections for insert to authenticated
with check (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'));
create policy dashboard_sections_update on public.dashboard_sections for update to authenticated
using (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'))
with check (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'));
create policy dashboard_sections_delete on public.dashboard_sections for delete to authenticated
using (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'));

create policy widgets_insert on public.widgets for insert to authenticated
with check (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'));
create policy widgets_update on public.widgets for update to authenticated
using (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'))
with check (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'));
create policy widgets_delete on public.widgets for delete to authenticated
using (private.has_agency_permission(agency_id,'dashboards.manage') or private.has_agency_permission(agency_id,'reports.manage'));

commit;
