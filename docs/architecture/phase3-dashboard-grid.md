# Phase 3 dashboard grid

The dashboard vertical slice uses three tenant-scoped PostgreSQL entities: `dashboards`, `dashboard_sections`, and `widgets`.

- Every row carries `agency_id` and is protected by RLS.
- A dashboard belongs to exactly one client.
- Sections order widget groups.
- Widget layout is persisted as `x`, `y`, `w`, and `h` in a 12-column grid.
- Widget metric data is read from `marketing_daily_metrics` for the selected client and date range.
- The first save creates the dashboard and section when the user is viewing the fallback layout.
- Layout changes are optimistic in the browser and persisted explicitly with Save.

The first slice supports stat, line, and bar widgets. The schema already reserves the remaining widget types required by the product specification.
