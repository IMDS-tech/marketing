# Local development runbook

## Prerequisites

Git, Node.js 22, Corepack and a Docker-compatible runtime. The Supabase CLI is pinned to `2.109.1` through `pnpm dlx`; no global install is required.

## First start

```bash
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install
pnpm supabase:start
pnpm supabase:reset
pnpm bootstrap:local
pnpm dev:all
```

Bootstrap creates or reuses a local admin, demo agency, admin membership and demo client. It writes ignored service `.env` files and `.local/bootstrap.json`.

Default local credentials:

```text
admin@imds.local
ImdsLocal123!
```

Remote bootstrap is blocked unless `ALLOW_REMOTE_BOOTSTRAP=true`; never enable it for production.

## Verification

```bash
pnpm healthcheck:all
pnpm test:e2e
pnpm validate
pnpm test:rls
```

## Selected services

```bash
DEV_SERVICES=web,platform,clients pnpm dev:all
```

Keys: `web`, `platform`, `clients`, `integrations`, `reports`, `notifications`, `ai`, `search`, `sync`.

## Docker mode

Start and bootstrap Supabase, then run:

```bash
docker compose -f docker-compose.dev.yml up --build
```

The compose stack reaches host Supabase through `host.docker.internal` and reads server-only values from ignored service env files.

## Reset

```bash
pnpm supabase:reset
pnpm bootstrap:local
```

A reset recreates the database and applies every timestamped migration. Bootstrap is idempotent.
