# Phase 2 sync lifecycle

A connected data source moves through the following lifecycle:

1. OAuth is completed by the Integration Service.
2. The user selects a provider account.
3. The account is attached to a client and an initial 365-day backfill is split into 30-day jobs.
4. The sync worker processes the newest window first and writes idempotent daily metrics.
5. A service-role scheduler enqueues one rolling 30-day resync per connected source per UTC day.
6. Provider errors are retried with exponential backoff; exhausted jobs mark the source as errored.

`sync_jobs.dedupe_key` prevents duplicate initial and rolling jobs. Provider credentials remain in the private OAuth vault and are resolved by workers only through the internal Integration Service endpoint.
