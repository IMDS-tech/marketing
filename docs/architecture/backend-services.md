# Backend Services

The Backend Services domain is split into six independently deployable, tenant-aware services. Every public request is authenticated with a Supabase JWT, resolved against agency membership, and restricted by explicit permissions. Internal worker endpoints use a separate service token.

## Service matrix

| Service | Port | Responsibilities |
| --- | ---: | --- |
| Platform Core Service | 4300 | Tenants, users, memberships, permissions, branding, plan entitlements, billing usage and audit events |
| Integration Service | 4200 | OAuth, manual credentials, encrypted credential vault, token refresh, account discovery, provider catalog and connection lifecycle |
| Report API | 4301 | Tenant-safe metrics, aggregation, dashboard data, reports, KPIs, roll-ups and analytical view metadata |
| Notification Worker | 4303 | Email, in-app, Slack, Telegram and signed webhooks with scheduling, idempotency and retry history |
| AI Service | 4304 | Entitlement-gated provider gateway, prompt templates, tenant RAG, allowlisted tools, safety policy and usage metering |
| Search Indexer | 4305 | Tenant-scoped full-text index, incremental indexing jobs, entity rebuilds and search API |

## Security boundaries

- Browser-facing services validate the Supabase JWT through the project JWKS endpoint.
- Agency access is resolved from active memberships. Admin, wildcard and explicit permission grants are supported.
- Client-scoped endpoints verify both agency ownership and user client access.
- OAuth and manual provider secrets remain encrypted in the private integration vault and are never returned to the browser.
- AI tools are a fixed allowlist. They cannot run arbitrary SQL, commands or external URLs.
- Notification and search ingestion endpoints require `INTERNAL_SERVICE_TOKEN`.
- New public tables have RLS enabled, explicit authenticated read policies and service-role-only writes.

## Queue guarantees

Notification delivery and search indexing use PostgreSQL queues with `FOR UPDATE SKIP LOCKED`, active-job deduplication, worker lock ownership, bounded exponential retries, terminal failure states and retained error payloads.

## Search coverage

The indexer maintains documents for clients, dashboards and reports through database triggers. Agency rebuild jobs also index campaign summaries and tenant storage files. Search results are always agency-scoped and apply client access checks.

## AI execution lifecycle

AI execution verifies permission and entitlement, resolves a tenant/global template, validates input and allowlisted tools, builds tenant-scoped context, calls the configured provider, redacts secret-like output and persists usage/safety/error data. Without a provider key the service reports itself unconfigured and never fabricates an answer.

## Operational checks

The workspace CI runs typecheck, tests and production builds for every service. Each service exposes `/health`; workers include their worker ID and capabilities.
