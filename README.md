# IMDS Marketing Data Platform

Единая архитектура получения, нормализации и выдачи рекламных данных из Meta Ads и TikTok Ads для продуктов IMDS / AMANAT MED.

## Цель первого этапа

Получать данные рекламных кабинетов на уровнях:

- рекламный кабинет;
- кампания;
- группа объявлений / ad set / ad group;
- объявление — опционально, когда понадобится анализ креативов.

Сохранять ежедневные показатели и обогащать их данными CRM:

- показы, охват, клики, расход, просмотры видео;
- платформенные лиды;
- CRM-лиды, целевые лиды, дошедшие пациенты, продажи и выручка;
- производные метрики CTR, CPC, CPM, CPL, CPA и ROAS.

## Архитектурный принцип

```text
Meta Marketing API ─┐
                    ├─> Provider adapters ─> Sync worker ─> Supabase/Postgres
TikTok Marketing API┘              │                 │
                                   │                 ├─ dimensions
Integration Service ─> credentials │                 ├─ daily metrics
                                                     ├─ CRM enrichment
Supabase Cron / dispatcher ─> jobs ┘                 └─ sync logs

Frontend dashboard ─> Report API ─> tenant-filtered reporting views
```

Marketing-сервис не должен владеть OAuth-токенами. Подключение аккаунтов и обновление токенов выполняет централизованный Integration Service. В Marketing хранится только `integration_id` и технический статус подключения.

## Структура

```text
docs/
  ARCHITECTURE.md       — компоненты и потоки данных
  DATA_CONTRACT.md      — единый контракт Meta/TikTok/CRM
  SYNC_STRATEGY.md      — расписание, backfill, retries, idempotency
  API_CONTRACT.md       — API для frontend-дашбордов
database/
  schema.sql            — целевая схема Postgres/Supabase
services/
  sync-worker/          — каркас сборщика и provider adapters
  report-api/           — каркас безопасного reporting API
```

## Безопасность

- Нельзя коммитить access tokens, refresh tokens, app secrets и service-role keys.
- Нельзя коммитить сырые production-выгрузки из рекламных кабинетов.
- Frontend не получает service-role key и не обращается к закрытым таблицам напрямую.
- Каждый запрос отчёта обязан содержать проверенный `tenant_id`.
- Все операции синхронизации идемпотентны и выполняют upsert по `(entity_id, report_date)`.

## Следующие шаги

1. Согласовать `tenant_id` и источник membership/permissions из Platform Core.
2. Подключить Marketing к централизованному Integration Service.
3. Создать миграцию из `database/schema.sql` через Supabase CLI.
4. Реализовать Meta adapter, затем TikTok adapter.
5. Подключить CRM enrichment.
6. Перевести JSX-дашборды с встроенных массивов на Report API.
