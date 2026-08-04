# Unified Ads Data Contract

## Нормализованная дневная метрика

```ts
type AdsDailyMetric = {
  tenant_id: string;
  platform: 'meta' | 'tiktok';
  report_date: string;

  account_id: string;
  campaign_id: string;
  adset_id?: string | null;
  ad_id?: string | null;

  currency: string;
  timezone: string;

  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  spend: number;
  video_views: number;

  platform_leads: number;
  crm_leads: number;
  target_leads: number;
  arrived: number;
  sales: number;
  revenue: number;

  source_updated_at?: string | null;
  synced_at: string;
};
```

## Dimensions

### Account

- `external_account_id`
- `account_name`
- `currency`
- `timezone`
- `status`
- `integration_id`

### Campaign

- `external_campaign_id`
- `account_id`
- `campaign_name`
- `objective`
- `effective_status`
- `start_time`
- `stop_time`

### Ad set / Ad group

- `external_adset_id`
- `campaign_id`
- `adset_name`
- `effective_status`
- `optimization_goal`
- `billing_event`

### Ad

- `external_ad_id`
- `adset_id`
- `ad_name`
- `effective_status`
- `creative_id`

## Mapping текущих JSX-полей

| JSX field | Contract field |
|---|---|
| `report_date` | `report_date` |
| `account_id` | external account key |
| `account_name` | account dimension |
| `campaign_id` | external campaign key |
| `campaign_name` | campaign dimension |
| `effective_status` / `status` | campaign status |
| `adset_id` | external adset key |
| `adset_name` | adset dimension |
| `impressions` | `impressions` |
| `clicks` | `clicks` |
| `link_clicks` | `link_clicks` |
| `spend` | `spend` |
| `video_views` | `video_views` |
| `leads` | `platform_leads` initially; CRM source must be explicit |
| `target_leads` | `target_leads` |
| `arrived` | `arrived` |
| `sales` | `sales` |
| `revenue` | `revenue` |

## Important rule for leads

Поле `leads` нельзя навсегда оставлять неоднозначным. В новой схеме разделяем:

- `platform_leads`: лиды, заявленные рекламной платформой;
- `crm_leads`: реальные созданные лиды CRM;
- `target_leads`: квалифицированные лиды.

Это предотвращает смешивание attribution Meta/TikTok с фактической CRM-воронкой.

## Money and currencies

`spend` и `revenue` хранятся как `numeric(20, 6)` в валюте аккаунта. Для объединённых отчётов потребуется отдельная таблица FX rates и вычисляемая reporting currency. До внедрения FX нельзя безусловно суммировать аккаунты с разными валютами.

## Idempotency key

```text
(tenant_id, platform, account_id, campaign_id, adset_id, ad_id, report_date)
```

Для nullable IDs в базе используются surrogate dimension IDs, поэтому уникальный ключ факта остаётся стабильным.
