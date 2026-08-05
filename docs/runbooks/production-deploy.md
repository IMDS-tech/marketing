# Production deployment runbook

## Deployment units

The platform consists of static frontend assets, eight backend/worker container images and Supabase/PostgreSQL migrations. Publishing only the frontend is not a complete deployment.

## Protected environment

Create a GitHub `production` environment with manual approval. Required secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Required variables:

- `PRODUCTION_WEB_URL`
- `VITE_SUPABASE_URL`
- URLs for Platform Core, Clients, Integrations, Reports, AI and Search.

Backend runtime secrets stay in the hosting platform secret manager and never use a `VITE_` prefix.

## Sequence

1. Merge only after application, clean-database and container CI are green.
2. The container workflow publishes immutable SHA-tagged images to GHCR.
3. Deploy those exact images to the selected runtime platform.
4. Confirm backend `/health` endpoints.
5. Run the production database/frontend workflow for the same SHA.
6. Apply migrations before frontend release.
7. Run public service smoke checks.
8. Enable schedulers only after APIs and schema are healthy.

## Migration safety

Confirm backup or PITR first. Use expand, backfill, contract for breaking changes. Never rewrite a migration already applied to production. Stop a release on migration failure and forward-fix.

## Rollback

Frontend and backend roll back to the previous commit/image SHA. Database rollback normally uses a forward fix; restore/PITR is reserved for destructive incidents. Services remain compatible with old and new schema during expand/contract rollout.
