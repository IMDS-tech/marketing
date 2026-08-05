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

## Cloudflare Workers Builds

This repository is a pnpm monorepo. Configure the connected `marketing` Worker under **Settings → Build** with these exact values:

```text
Root directory: /
Build command: pnpm cloudflare:build
Deploy command: pnpm cloudflare:deploy
Non-production deploy command: pnpm exec wrangler versions upload
```

Add this build variable:

```text
SKIP_DEPENDENCY_INSTALL=true
```

The build script pins pnpm 10.14.0, installs the workspace with pnpm and creates `apps/marketing-web/dist` before Wrangler reads `assets.directory`. The repository also pins Node.js through `.node-version`.

Do not leave the Build command empty. Workers Builds performs its build and deploy as two separate steps. The default deploy command alone cannot create the Vite `dist` directory.

Required frontend build variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_PLATFORM_CORE_SERVICE_URL
VITE_CLIENTS_API_URL
VITE_INTEGRATION_SERVICE_URL
VITE_REPORT_API_URL
VITE_AI_SERVICE_URL
VITE_SEARCH_INDEXER_URL
```

The production frontend has no demo fallback. Missing Supabase configuration stops the application with a configuration error, and missing service URLs surface explicit API configuration errors instead of synthetic data.

After changing Build settings, trigger a new commit or use **Retry build**. A retry uses the currently saved Build settings. The expected sequence in the log is `pnpm cloudflare:build`, creation of `apps/marketing-web/dist/index.html`, then `pnpm cloudflare:deploy`.

Local verification:

```bash
pnpm install --no-frozen-lockfile --ignore-scripts
pnpm deploy:dry-run
```

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
