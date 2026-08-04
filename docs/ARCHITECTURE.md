# Архитектура Marketing Data Platform

## 1. Назначение

Платформа собирает рекламные данные Meta Ads и TikTok Ads, нормализует их в общий контракт, обогащает CRM-результатами и выдаёт frontend-дашбордам безопасные агрегаты.

## 2. Контуры

### Integration Service

Отдельный сервис отвечает за OAuth, подключение рекламных аккаунтов, refresh токенов и отзыв доступа. Marketing хранит только ссылку `integration_id`, platform, tenant и технический статус.

### Sync Dispatcher

Периодически создаёт задания синхронизации:

- incremental sync за последние 3 дня;
- daily reconciliation за последние 14 дней;
- ручной backfill диапазона;
- повтор неуспешных заданий.

### Sync Worker

Получает job, запрашивает временные credentials у Integration Service, вызывает provider adapter, нормализует ответы и делает idempotent upsert.

### Provider adapters

Единый интерфейс:

```ts
interface AdsProvider {
  listAccounts(context: ProviderContext): Promise<ExternalAccount[]>;
  syncDimensions(input: SyncInput): Promise<DimensionBatch>;
  syncDailyMetrics(input: SyncInput): Promise<MetricBatch>;
}
```

Реализации:

- `MetaAdsProvider`;
- `TikTokAdsProvider`.

### CRM Enrichment

Связывает рекламный лид с CRM и обновляет:

- `crm_leads`;
- `target_leads`;
- `arrived`;
- `sales`;
- `revenue`.

Связка выполняется по внешнему lead id, UTM, телефону, conversation id или внутреннему attribution key. Правило атрибуции должно быть версионируемым.

### Report API

Frontend не читает сырые таблицы напрямую. API проверяет пользователя, tenant, permissions, диапазон и допустимые фильтры, после чего возвращает агрегаты.

## 3. Поток данных

```text
OAuth user flow
  -> Integration Service
  -> integration record
  -> account discovery
  -> marketing_ad_accounts

Scheduled dispatcher
  -> marketing_sync_jobs
  -> Sync Worker
  -> Meta/TikTok API
  -> dimensions upsert
  -> daily metrics upsert
  -> sync log

CRM events
  -> enrichment worker
  -> attribution mapping
  -> daily metrics CRM columns

Frontend
  -> Report API
  -> tenant-scoped SQL/RPC
  -> KPI, trend, funnel, campaigns, adsets
```

## 4. Гранулярность

Основная строка факта:

```text
tenant + platform + account + campaign + adset + ad + report_date
```

`adset_id` и `ad_id` могут быть `null`, когда источник отдаёт только агрегат кампании. Однако желательно собирать минимально уровень adset, потому что оба текущих дашборда используют drill-down из кампании.

## 5. Производные метрики

Производные показатели не являются источником истины и вычисляются при чтении:

```text
CTR  = clicks / impressions
CPC  = spend / clicks
CPM  = spend / impressions * 1000
CPL  = spend / leads
CPA  = spend / sales
ROAS = revenue / spend
VTR  = video_views / impressions
```

## 6. Multi-tenancy

Каждая dimension, metric, job и integration reference содержит `tenant_id`. Уникальные ограничения всегда включают tenant. Report API извлекает tenant из проверенного workspace context, а не из произвольного frontend-параметра.

## 7. Разделение данных

- `public`/exposed: только безопасные security-invoker views или RPC для отчётов.
- `marketing_private`: integrations, jobs, provider payload references и служебные логи.
- Сырые API payloads по умолчанию не хранятся; при необходимости сохраняются в закрытом Storage с TTL.

## 8. Масштабирование

Первый MVP может работать через Supabase Cron + Edge Function dispatcher + worker. При росте объёма jobs переводятся в очередь. Provider adapters и database contract при этом не меняются.
