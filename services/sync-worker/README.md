# Meta Sync Worker — fetch stage

Node.js 22 service that retrieves Meta Ads account metadata, campaigns, ad sets, ads and daily ad-level insights, then converts them into the unified IMDS marketing data contract.

## Current scope

This first implementation performs the provider side of synchronization:

1. receives an ad account and date range;
2. resolves a Meta token from Integration Service, or from env in local development;
3. follows cursor pagination;
4. retries transient Meta errors and rate limits;
5. fetches account, campaigns, ad sets, ads and daily insights;
6. normalizes impressions, reach, clicks, link clicks, spend, video views and leads;
7. prints the normalized JSON snapshot to stdout.

The next stage will persist this snapshot into `marketing_ad_accounts`, `marketing_campaigns`, `marketing_adsets`, `marketing_ads` and `marketing_daily_metrics`.

## Run

```bash
cp .env.example .env
set -a; . ./.env; set +a
npm run check
npm test
npm start > snapshot.json
```

Never expose Meta tokens or the Supabase service-role key to the frontend. Production tokens must be returned by the centralized Integration Service and held only in worker memory.
