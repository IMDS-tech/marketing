# IMDS Marketing Sync Worker

Production-oriented queue worker for tenant-scoped marketing data collection.

## Implemented providers

- Meta Ads
- TikTok Ads
- Google Ads
- Google Analytics 4
- Google Search Console

## Processing lifecycle

1. Atomically claim the next eligible job through `claim_marketing_sync_job`.
2. Resolve the data source and retrieve credentials from Integration Service.
3. Fetch paginated provider data through the registered adapter.
4. Normalize provider output to `marketing_daily_metrics` rows.
5. Enforce tenant, provider, entity, date, metric, numeric and dimensions validation.
6. Remove duplicate fact keys inside the provider batch.
7. Reject the run when the data-quality acceptance threshold is unsafe.
8. Upsert accepted rows in bounded chunks using the canonical conflict key.
9. Persist quality counters and duration in `sync_runs.metadata`.
10. Classify failures as authentication, rate limit, transient, upstream or permanent.
11. Apply bounded exponential retry with deterministic jitter and provider `Retry-After` support.

## Commands

```bash
pnpm --filter @imds/marketing-sync-worker check
pnpm --filter @imds/marketing-sync-worker test
pnpm --filter @imds/marketing-sync-worker start
```

The worker requires server-only Supabase and Integration Service credentials. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `INTEGRATION_SERVICE_TOKEN` to the browser.
