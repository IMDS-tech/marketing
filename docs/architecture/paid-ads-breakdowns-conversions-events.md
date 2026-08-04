# Paid Ads Breakdowns, Custom Conversions and Events

## 1. Что показывают исследованные экраны

Исследованные экраны состоят из трех функциональных классов.

### 1.1 Demographics overview

Сводная страница интеграции:

- Gender donut;
- Country / Region map;
- Age donut;
- KPI cards: Clicks, Impressions, Average CPC, CTR;
- таблица Country / Region;
- account filter;
- общий date range.

### 1.2 Одна breakdown-страница

Отдельные страницы:

- Age;
- Gender;
- Country;
- Region;
- Device OS;
- Device / Platform при наличии provider capability.

Все они используют одинаковую структуру:

```text
Breakdown page
  header + account filter + date range
  metric distribution: clicks
  metric distribution: impressions
  metric distribution: spend
  conversions by breakdown
  conversion rate by breakdown
  breakdown table
```

Это должен быть один `BreakdownAnalyticsPage`, управляемый manifest, а не отдельный React component на каждый breakdown.

### 1.3 Conversion definitions and event reporting

Отдельные экраны:

- Custom Conversions;
- Custom Events.

Custom Conversions показывает каталог определений конверсий и агрегированные результаты:

- conversion name;
- event type;
- source type;
- last occurred;
- events;
- conversions;
- cost per conversion.

Custom Events показывает агрегированные provider events по campaign / event name:

- campaign;
- custom event;
- event count;
- attributed conversions;
- cost per conversion.

Эти экраны не являются raw event log. В продукте хранятся агрегированные provider results и определения событий, но не пользовательские персональные события.

## 2. Целевая навигация

```text
/client/:clientId/meta-ads
  /campaigns
  /adsets
  /ads
  /demographics
  /demographics/age
  /demographics/gender
  /demographics/country
  /demographics/region
  /demographics/device
  /demographics/os
  /custom-conversions
  /custom-events

/client/:clientId/tiktok-ads
  /campaigns
  /adgroups
  /ads
  /demographics
  /demographics/age
  /demographics/gender
  /demographics/country
  /demographics/os
  /custom-events
```

Маршрут показывается только тогда, когда provider capability сообщает, что соответствующий breakdown или event report доступен для данного account.

## 3. Общая архитектура

```text
React Frontend
  IntegrationWorkspace
    IntegrationNavigation
    AnalyticsToolbar
    DemographicsOverviewPage
    BreakdownAnalyticsPage
    CustomConversionsPage
    CustomEventsPage

Analytics Query Service
  Request validator
  Tenant / permission guard
  Capability resolver
  Query planner
  Metric aggregation
  Derived metric engine
  Result formatter
  Cache

Provider Reporting Layer
  MetaReportingAdapter
  TikTokReportingAdapter
  GoogleAdsReportingAdapter

Sync Pipeline
  Breakdown jobs
  Conversion definition jobs
  Event definition jobs
  Event metric jobs

PostgreSQL / Supabase
  marketing_daily_metrics
  marketing_breakdown_daily
  marketing_event_sources
  marketing_event_definitions
  marketing_conversion_definitions
  marketing_event_daily_metrics
  provider_reporting_capabilities
```

## 4. Почему нужен capability-driven подход

Provider API не разрешают произвольно комбинировать все dimensions, levels и metrics в одном запросе.

Поэтому frontend не должен отправлять provider dimension names напрямую. Он отправляет canonical intent:

```json
{
  "integration": "tiktok-ads",
  "level": "account",
  "breakdown": "operating_system",
  "metrics": [
    "spend",
    "clicks",
    "impressions",
    "conversions"
  ]
}
```

Backend затем:

1. проверяет capability;
2. выбирает provider report type;
3. разбивает запрос на совместимые provider calls;
4. нормализует значения;
5. объединяет результат;
6. рассчитывает CPC, CPM, CTR и conversion rate.

## 5. Provider capability contract

```ts
export type CanonicalBreakdown =
  | 'age'
  | 'gender'
  | 'country'
  | 'region'
  | 'device'
  | 'operating_system'
  | 'publisher_platform'
  | 'placement';

export type CanonicalEntityLevel =
  | 'account'
  | 'campaign'
  | 'adgroup'
  | 'ad';

export interface ReportingCapability {
  breakdown: CanonicalBreakdown;
  levels: CanonicalEntityLevel[];
  metrics: string[];
  reportFamily: 'basic' | 'audience' | 'insights' | 'event';
  supportsDailyTimeDimension: boolean;
  maxDateRangeDays?: number;
  incompatibleBreakdowns?: CanonicalBreakdown[];
  availability: 'available' | 'limited' | 'unsupported';
  notes?: string;
}

export interface ProviderReportingCapabilities {
  integration: 'meta-ads' | 'tiktok-ads' | 'google-ads';
  breakdowns: ReportingCapability[];
  customConversions: boolean;
  customEvents: boolean;
  eventSources: Array<'pixel' | 'dataset' | 'app' | 'offline' | 'crm'>;
}
```

Capabilities могут иметь два уровня:

- статический provider manifest;
- account-specific capability snapshot, полученный после подключения account.

## 6. Нормализация breakdown values

Provider возвращают разные значения. В базе должны храниться одновременно canonical и provider value.

```ts
interface NormalizedBreakdownValue {
  canonicalType: CanonicalBreakdown;
  canonicalValue: string;
  providerType: string;
  providerValue: string;
  labelKey?: string;
  sortOrder?: number;
  countryCode?: string;
  regionCode?: string;
}
```

Примеры:

```text
Provider value       Canonical value
ANDROID              android
IPHONE               ios_iphone
IPAD                 ios_ipad
UNKNOWN              unknown
AGE_25_34            25_34
25-34                25_34
FEMALE                female
MALE                  male
NONE                  unknown
KZ                    KZ
Kazakhstan            KZ
```

Нельзя использовать переводимый UI label как primary key.

## 7. Таблица marketing_breakdown_daily

```sql
create table public.marketing_breakdown_daily (
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,

  entity_type text not null check (
    entity_type in ('account','campaign','adgroup','ad')
  ),
  entity_id text not null,
  entity_name text,

  breakdown_type text not null check (
    breakdown_type in (
      'age',
      'gender',
      'country',
      'region',
      'device',
      'operating_system',
      'publisher_platform',
      'placement'
    )
  ),
  breakdown_value text not null,
  provider_breakdown_type text,
  provider_breakdown_value text,

  metric_date date not null,
  metric_key text not null references public.metric_dictionary(metric_key),
  value numeric not null,

  attribution_setting text,
  report_family text not null default 'insights',
  dimensions jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),

  primary key (
    agency_id,
    client_id,
    data_source_id,
    integration_slug,
    entity_type,
    entity_id,
    breakdown_type,
    breakdown_value,
    metric_date,
    metric_key,
    attribution_setting
  ),

  foreign key (client_id, agency_id)
    references public.clients(id, agency_id)
    on delete cascade,

  foreign key (data_source_id, agency_id)
    references public.data_sources(id, agency_id)
    on delete cascade
);
```

Индексы:

```sql
create index breakdown_client_query_idx
  on public.marketing_breakdown_daily (
    client_id,
    integration_slug,
    breakdown_type,
    metric_date desc,
    metric_key
  );

create index breakdown_source_query_idx
  on public.marketing_breakdown_daily (
    data_source_id,
    breakdown_type,
    metric_date desc
  );

create index breakdown_dimensions_gin_idx
  on public.marketing_breakdown_daily
  using gin (dimensions);
```

RLS:

```sql
create policy marketing_breakdown_daily_read
on public.marketing_breakdown_daily
for select to authenticated
using (private.can_access_client(client_id));
```

Frontend не получает write permission.

## 8. Derived metrics

Breakdown rows сохраняют только additive или provider-native metrics:

```text
spend
clicks
impressions
conversions
events
revenue
video_views
```

Derived metrics рассчитываются после aggregation:

```text
CPC = spend / clicks
CPM = spend * 1000 / impressions
CTR = clicks / impressions
Conversion Rate = conversions / clicks
Cost per Conversion = spend / conversions
ROAS = revenue / spend
```

Нельзя суммировать CPC, CPM, CTR или conversion rate между днями и breakdown rows.

В metric dictionary нужно добавить:

```sql
('events', 'Events', 'Provider event occurrences',
 'float', 'sum', 'decimal', false, null, '{}', 'conversion'),

('conversion_rate', 'Conversion Rate',
 'Conversions divided by clicks',
 'percent', 'derived', 'percent', true,
 'conversions / nullif(clicks, 0)',
 '{conversions,clicks}', 'efficiency'),

('cost_per_conversion', 'Cost per Conversion',
 'Spend divided by conversions',
 'currency', 'derived', 'currency', true,
 'spend / nullif(conversions, 0)',
 '{spend,conversions}', 'efficiency');
```

## 9. Event source model

Один account может иметь несколько источников событий:

- Meta Pixel;
- Meta Dataset;
- App SDK / app events;
- offline / CRM source;
- TikTok Pixel;
- TikTok Events API source;
- mobile measurement source.

```sql
create table public.marketing_event_sources (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,

  external_source_id text not null,
  source_type text not null check (
    source_type in ('pixel','dataset','app','offline','crm','unknown')
  ),
  name text not null,
  status text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),

  unique (data_source_id, external_source_id)
);
```

## 10. Event definitions

Custom Event — это canonical catalog entry, а не raw user event.

```sql
create table public.marketing_event_definitions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  event_source_id uuid references public.marketing_event_sources(id),
  integration_slug text not null,

  external_event_key text not null,
  name text not null,
  normalized_name text not null,
  event_type text,
  source_type text,
  is_standard boolean not null default false,
  is_active boolean not null default true,
  first_occurred_at timestamptz,
  last_occurred_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),

  unique (data_source_id, external_event_key)
);
```

Примеры event keys:

```text
Lead
Purchase
SubmitApplication
CompleteRegistration
griza.net_thx
custom:appointment_booked
```

## 11. Custom conversion definitions

Custom Conversion является правилом над event source и event data.

```sql
create table public.marketing_conversion_definitions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  event_source_id uuid references public.marketing_event_sources(id),
  integration_slug text not null,

  external_conversion_id text not null,
  name text not null,
  custom_event_type text,
  description text,
  rule_json jsonb,
  default_value numeric,
  currency text,
  is_archived boolean not null default false,
  first_fired_at timestamptz,
  last_fired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),

  unique (data_source_id, external_conversion_id)
);
```

`rule_json` нельзя использовать для самостоятельной обработки персональных событий в IMDS. Он хранится для отображения и provider synchronization.

## 12. Event and conversion daily facts

```sql
create table public.marketing_event_daily_metrics (
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,

  definition_type text not null check (
    definition_type in ('event','custom_conversion')
  ),
  definition_id uuid not null,

  entity_type text not null check (
    entity_type in ('account','campaign','adgroup','ad')
  ),
  entity_id text not null,
  entity_name text,

  metric_date date not null,
  metric_key text not null references public.metric_dictionary(metric_key),
  value numeric not null,

  attribution_setting text,
  dimensions jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),

  primary key (
    agency_id,
    client_id,
    data_source_id,
    integration_slug,
    definition_type,
    definition_id,
    entity_type,
    entity_id,
    metric_date,
    metric_key,
    attribution_setting
  )
);
```

Такой формат позволяет строить:

- event trend;
- conversions trend;
- event table by campaign;
- conversion table by definition;
- cost per conversion;
- first / last occurred;
- account, campaign, ad group и ad filters.

## 13. Provider adapters

```ts
interface PaidAdsReportingProvider {
  capabilities(context: ProviderContext): Promise<ProviderReportingCapabilities>;

  fetchBreakdown(input: ProviderContext & {
    level: CanonicalEntityLevel;
    breakdown: CanonicalBreakdown;
    dateFrom: string;
    dateTo: string;
    metrics: string[];
  }): Promise<NormalizedBreakdownFact[]>;

  listEventSources(
    input: ProviderContext
  ): Promise<NormalizedEventSource[]>;

  listEventDefinitions(
    input: ProviderContext
  ): Promise<NormalizedEventDefinition[]>;

  listCustomConversions(
    input: ProviderContext
  ): Promise<NormalizedConversionDefinition[]>;

  fetchEventMetrics(input: ProviderContext & {
    dateFrom: string;
    dateTo: string;
    level: CanonicalEntityLevel;
    eventDefinitionIds?: string[];
    conversionDefinitionIds?: string[];
  }): Promise<NormalizedEventMetricFact[]>;
}
```

## 14. Meta implementation

Meta reporting adapter должен иметь независимые запросы:

```text
meta.breakdown.age
meta.breakdown.gender
meta.breakdown.country
meta.breakdown.region
meta.breakdown.device_platform
meta.breakdown.publisher_platform
meta.breakdown.platform_position
meta.event_sources
meta.event_definitions
meta.custom_conversions
meta.event_metrics
meta.custom_conversion_metrics
```

Нельзя предполагать, что все breakdowns и action fields совместимы в одном request. Query planner использует capability matrix и при необходимости выполняет несколько запросов.

В Meta `actions` и `cost_per_action_type` должны нормализоваться по `action_type`. Неизвестные action types не отбрасываются: они регистрируются как event definitions и помечаются provider-specific.

Custom conversion definitions синхронизируются отдельно от Insights metrics.

Сохраняемые поля definition:

```text
external id
name
description
custom event type
data source / pixel
rule
first fired time
last fired time
archived status
default value
```

## 15. TikTok implementation

TikTok adapter должен разделять минимум три report families:

```text
Basic reporting
Audience / demographic reporting
Custom event reporting
```

Breakdown jobs:

```text
tiktok.breakdown.age
tiktok.breakdown.gender
tiktok.breakdown.country
tiktok.breakdown.operating_system
```

Event jobs:

```text
tiktok.event_sources
tiktok.event_definitions
tiktok.custom_event_metrics
```

Provider dimension names и совместимые combinations определяются adapter, а не frontend.

Если API account не предоставляет Age/Gender/OS breakdown, capability возвращает `limited` или `unsupported`, и UI показывает честный empty state вместо demo numbers.

## 16. Sync jobs

Новые job kinds:

```text
paid_ads.breakdown.age
paid_ads.breakdown.gender
paid_ads.breakdown.country
paid_ads.breakdown.region
paid_ads.breakdown.device
paid_ads.breakdown.operating_system
paid_ads.event_sources
paid_ads.event_definitions
paid_ads.conversion_definitions
paid_ads.event_metrics
paid_ads.conversion_metrics
```

Payload:

```json
{
  "level": "account",
  "dateFrom": "2026-07-01",
  "dateTo": "2026-07-31",
  "breakdown": "gender",
  "reportFamily": "audience",
  "attributionSetting": "account_default"
}
```

Initial backfill должен быть отдельным для each breakdown/report family. Ошибка demographic job не должна ломать campaign metric sync.

## 17. Analytics Query API

### 17.1 Breakdown query

```http
POST /v1/analytics/breakdowns/query
```

```json
{
  "clientId": "uuid",
  "dataSourceId": "uuid",
  "integration": "tiktok-ads",
  "level": "account",
  "breakdown": "operating_system",
  "dateRange": {
    "from": "2026-07-01",
    "to": "2026-07-31"
  },
  "metrics": [
    "spend",
    "clicks",
    "impressions",
    "conversions"
  ],
  "filters": {
    "campaignIds": [],
    "adGroupIds": [],
    "adIds": []
  }
}
```

Response:

```json
{
  "meta": {
    "currency": "USD",
    "timezone": "Asia/Almaty",
    "freshness": "2026-08-04T16:00:00Z",
    "attributionSetting": "account_default",
    "providerAvailability": "available"
  },
  "breakdown": {
    "type": "operating_system",
    "rows": [
      {
        "value": "android",
        "label": "Android",
        "metrics": {
          "spend": 106.17,
          "clicks": 169,
          "impressions": 69849,
          "conversions": 6,
          "cpc": 0.63,
          "cpm": 1.52,
          "ctr": 0.0024,
          "conversionRate": 0.0355
        }
      }
    ]
  },
  "totals": {},
  "availableFilters": {},
  "warnings": []
}
```

### 17.2 Custom conversions

```http
POST /v1/analytics/conversions/query
```

Response row:

```json
{
  "conversionId": "provider-id",
  "name": "Appointment confirmed",
  "eventType": "SubmitApplication",
  "sourceType": "pixel",
  "lastOccurredAt": "2026-08-02T18:26:00Z",
  "events": 177,
  "conversions": 16,
  "costPerConversion": 5200,
  "status": "active"
}
```

### 17.3 Custom events

```http
POST /v1/analytics/events/query
```

Response row:

```json
{
  "campaign": {
    "id": "campaign-id",
    "name": "Back pain leads"
  },
  "event": {
    "id": "event-definition-id",
    "name": "appointment_booked"
  },
  "metrics": {
    "events": 83,
    "conversions": 22,
    "costPerConversion": 4100
  }
}
```

## 18. Frontend manifests

```ts
export const BREAKDOWN_VIEWS: Record<string, BreakdownViewManifest> = {
  age: {
    breakdown: 'age',
    titleKey: 'breakdowns.age',
    charts: [
      { type: 'donut', metric: 'clicks' },
      { type: 'donut', metric: 'impressions' },
      { type: 'donut', metric: 'spend' },
      { type: 'bar', metric: 'conversions' },
      { type: 'bar', metric: 'conversion_rate' }
    ],
    tableMetrics: [
      'spend',
      'clicks',
      'impressions',
      'cpc',
      'cpm',
      'ctr',
      'conversions',
      'conversion_rate'
    ]
  },
  gender: {},
  country: {},
  region: {},
  operating_system: {}
};
```

Один manifest используется Meta и TikTok. Provider capabilities убирают неподдерживаемые widgets/metrics.

## 19. Frontend components

```text
components/analytics/
  AnalyticsToolbar.tsx
  AccountFilter.tsx
  EntityFilterBuilder.tsx
  DateRangeControl.tsx
  FreshnessIndicator.tsx
  ProviderWarning.tsx

components/breakdowns/
  BreakdownAnalyticsPage.tsx
  DemographicsOverviewPage.tsx
  MetricDistributionCard.tsx
  BreakdownBarCard.tsx
  GeoBreakdownMap.tsx
  BreakdownTable.tsx
  BreakdownLegend.tsx

components/events/
  CustomConversionsPage.tsx
  CustomEventsPage.tsx
  ConversionDefinitionTable.tsx
  EventMetricTable.tsx
  EventTrendCard.tsx
```

## 20. Geo visualization

`country` и `region` используют canonical ISO codes.

```text
country -> ISO 3166-1 alpha-2
region  -> provider region code + country code
```

Frontend map никогда не сопоставляет страну по локализованному названию.

Для Country / Region tabs endpoint получает:

```json
{
  "breakdown": "country"
}
```

или

```json
{
  "breakdown": "region",
  "filters": {
    "countryCodes": ["KZ"]
  }
}
```

Если данных только по одной стране, donut и table остаются валидными; UI не должен искусственно добавлять другие страны.

## 21. Empty states

На скриншотах Custom Events корректно показывает отсутствие данных. Это важный продуктовый паттерн.

Состояния должны различаться:

```text
not_connected
not_supported
permission_missing
sync_pending
no_data_for_range
provider_returned_empty
provider_error
attribution_mismatch
```

Пример response:

```json
{
  "state": "no_data_for_range",
  "messageKey": "events.empty.dateRange",
  "actions": [
    {
      "type": "change_date_range"
    }
  ]
}
```

Нельзя заменять отсутствие live данных demo-числами в production tenant.

## 22. Privacy and compliance

Demographic reporting хранит только агрегированные provider buckets.

Запрещено хранить:

- user ID;
- phone;
- email;
- IP address;
- cookie identifiers;
- click identifiers в открытом виде;
- raw Pixel/CAPI event payload;
- health information или diagnosis;
- признаки конкретного пациента.

Для Amanat Med особенно важно, чтобы demographics использовались только как агрегированная рекламная аналитика. Breakdown rows с малыми значениями должны поддерживать provider suppression (`<5`, unknown, withheld) без попытки восстановить скрытые значения.

## 23. Изменения относительно текущего release

В текущей схеме уже есть canonical metric dictionary и `marketing_daily_metrics`, но:

- нет отдельной breakdown fact table;
- нет canonical OS breakdown;
- нет event source catalog;
- нет event definition catalog;
- нет custom conversion catalog;
- нет event/conversion daily fact table;
- `events`, `conversion_rate` и `cost_per_conversion` отсутствуют в metric dictionary;
- TikTok worker синхронизирует campaign-level metrics, но не отдельные audience reports;
- Meta worker читает action aggregates, но не синхронизирует custom conversion definitions.

## 24. Порядок реализации

### Phase A — Generic breakdown engine

- migration `marketing_breakdown_daily`;
- derived metrics;
- capability contract;
- query endpoint;
- generic frontend page;
- Age, Gender, Country и OS manifests;
- empty states.

### Phase B — TikTok demographics

- TikTok audience report adapter;
- Age / Gender / Country / OS jobs;
- provider value normalization;
- account/campaign/ad group/ad filters;
- tables and charts.

### Phase C — Meta demographics

- age and gender reports;
- country and region reports;
- device/platform reports;
- demographics overview;
- geo map;
- attribution metadata.

### Phase D — Conversion catalog

- event sources;
- event definitions;
- custom conversion definitions;
- Custom Conversions page;
- Custom Events page;
- event/conversion trend and table.

### Phase E — Templates and exports

- add breakdown widgets to dashboard builder;
- scheduled reports;
- CSV/XLSX/PDF export;
- client portal permissions.

## 25. Definition of Done

Module считается готовым, когда:

- Age, Gender, Country и OS используют один generic page;
- provider limitations управляются capability matrix;
- metrics агрегируются на backend;
- CPC/CPM/CTR/rates никогда не суммируются;
- Meta и TikTok значения нормализованы;
- map использует ISO codes;
- Custom Conversions отделены от Custom Events;
- raw personal events не сохраняются;
- empty state объясняет конкретную причину;
- filters/date range сохраняются при переходах;
- EN/RU/KK полностью локализованы;
- RLS ограничивает данные client membership;
- provider failures не ломают другие analytics sections;
- tests покрывают formulas, capability rejection, normalization, RLS и empty states.
