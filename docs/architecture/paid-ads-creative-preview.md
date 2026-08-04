# Paid Ads Creative Preview Architecture

## 1. Цель

Добавить в IMDS Marketing экран уровня Ads, где пользователь:

- видит список объявлений с thumbnail;
- фильтрует объявления по account, campaign, ad set/ad group, status и date range;
- открывает объявление в правой slide-over панели;
- переключает варианты preview: Desktop, Mobile, Instagram и TikTok;
- видит фактический текст объявления, identity, media, CTA и destination;
- сравнивает preview с performance-метриками выбранного объявления.

Preview является частью аналитического продукта, но не должен строиться из таблицы метрик. Метрики, рекламные сущности, creative assets и provider preview имеют разные жизненные циклы.

## 2. Пользовательский поток

```text
Ads table
  -> click thumbnail or ad name
  -> open AdPreviewDrawer
  -> GET normalized creative metadata
  -> request selected placement preview
  -> return cached provider preview or generate a fresh preview
  -> render preview in an isolated sandbox
```

Основной маршрут:

```text
/client/:clientId/:integration/ads
```

Drawer не меняет основной маршрут обязательно, но выбранное объявление должно поддерживать deep link:

```text
/client/:clientId/:integration/ads?ad=:adId&preview=mobile
```

Это позволяет делиться ссылкой и восстанавливать состояние после reload.

## 3. Компоненты системы

```text
React Frontend
  AdsExplorerPage
    AdsMetricsHeader
    AnalyticsToolbar
    AdsDataTable
      CreativeThumbnail
    AdPreviewDrawer
      PlacementTabs
      NormalizedAdPreview
      ProviderPreviewFrame
      CreativePerformancePanel

Analytics Query API
  ads list + metrics + filters

Creative Preview API
  metadata endpoint
  preview endpoint
  asset proxy / signed URL endpoint

Creative Preview Service
  tenant and permission validation
  provider adapter registry
  preview cache
  HTML sanitization
  asset URL renewal

Provider adapters
  MetaCreativeAdapter
  TikTokCreativeAdapter

PostgreSQL / Supabase
  marketing_entities
  marketing_creatives
  marketing_ad_creative_links
  marketing_creative_assets
  marketing_preview_cache
  marketing_daily_metrics
```

## 4. Разделение ответственности

### Sync Worker

Worker выполняет периодическую синхронизацию стабильных данных:

- campaigns;
- ad sets / ad groups;
- ads;
- creative metadata;
- image/video identifiers;
- thumbnails;
- destination and CTA metadata;
- daily performance metrics.

Worker не должен сохранять OAuth access token, provider HTML preview или бессрочные временные media URLs.

### Integration Service

Integration Service уже имеет доступ к encrypted credential vault и должен стать владельцем on-demand provider preview.

Новые обязанности:

- получить credential по `credential_handle`;
- проверить membership и доступ пользователя к client/data source;
- вызвать provider preview API;
- обновить временный URL creative asset;
- очистить provider HTML;
- сохранить короткоживущий cache;
- вернуть frontend безопасный normalized response.

### Frontend

Frontend никогда не получает provider access token. Он получает только:

- normalized creative JSON;
- безопасный preview HTML или signed preview URL;
- временные media URLs через IMDS endpoint;
- freshness и fallback status.

## 5. Модель данных

### 5.1 marketing_entities

Хранит иерархию рекламных объектов.

```sql
create table public.marketing_entities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,
  entity_type text not null check (
    entity_type in ('account','campaign','adgroup','ad')
  ),
  external_id text not null,
  parent_external_id text,
  name text not null,
  status text,
  provider_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (data_source_id, entity_type, external_id)
);
```

Для Meta `adgroup` отображается в UI как Ad Set. Для TikTok и Google Ads — как Ad Group.

### 5.2 marketing_creatives

Хранит normalized creative, не зависящий от конкретного provider UI.

```sql
create table public.marketing_creatives (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,
  external_creative_id text not null,
  creative_type text not null check (
    creative_type in ('image','video','carousel','collection','responsive','unknown')
  ),
  title text,
  body text,
  description text,
  call_to_action text,
  destination_url text,
  display_url text,
  identity_name text,
  identity_external_id text,
  page_external_id text,
  instagram_actor_external_id text,
  thumbnail_asset_id uuid,
  primary_asset_id uuid,
  provider_payload jsonb not null default '{}'::jsonb,
  content_hash text,
  provider_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (data_source_id, external_creative_id)
);
```

`provider_payload` содержит только поля, необходимые для повторного построения preview. Secrets и access tokens запрещены.

### 5.3 marketing_ad_creative_links

Одно объявление может иметь один или несколько creative variants.

```sql
create table public.marketing_ad_creative_links (
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  ad_external_id text not null,
  creative_id uuid not null references public.marketing_creatives(id) on delete cascade,
  variant_key text not null default 'primary',
  is_primary boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  primary key (data_source_id, ad_external_id, creative_id, variant_key)
);
```

Это важно для dynamic creative, responsive ads и случаев, когда provider меняет creative у существующего ad.

### 5.4 marketing_creative_assets

```sql
create table public.marketing_creative_assets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,
  external_asset_id text not null,
  asset_type text not null check (
    asset_type in ('image','video','thumbnail','logo','avatar')
  ),
  mime_type text,
  width integer,
  height integer,
  duration_ms integer,
  provider_url text,
  provider_url_expires_at timestamptz,
  storage_object_path text,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (data_source_id, asset_type, external_asset_id)
);
```

Для production предпочтительна двухрежимная стратегия:

1. thumbnail и разрешённые provider assets копируются в private object storage;
2. временные provider preview URLs обновляются on demand и не считаются постоянным хранилищем.

### 5.5 marketing_preview_cache

```sql
create table private.marketing_preview_cache (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  data_source_id uuid not null,
  integration_slug text not null,
  ad_external_id text not null,
  placement text not null,
  locale text not null default 'en',
  format text not null check (format in ('normalized_json','provider_html','signed_url')),
  payload jsonb,
  html text,
  content_hash text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (data_source_id, ad_external_id, placement, locale)
);
```

Cache должен находиться в private schema. Frontend не читает эту таблицу напрямую.

## 6. API

### 6.1 Список Ads

```http
POST /v1/analytics/ads/query
```

```json
{
  "clientId": "uuid",
  "integration": "meta-ads",
  "dataSourceId": "uuid",
  "dateRange": {
    "from": "2026-07-01",
    "to": "2026-07-31"
  },
  "filters": {
    "campaignIds": [],
    "adGroupIds": [],
    "statuses": [],
    "search": ""
  },
  "sort": {
    "field": "clicks",
    "direction": "desc"
  },
  "page": {
    "limit": 50,
    "cursor": null
  }
}
```

Response row:

```json
{
  "adId": "provider-ad-id",
  "adName": "Creative 01",
  "campaign": {"id": "...", "name": "..."},
  "adGroup": {"id": "...", "name": "..."},
  "status": "ACTIVE",
  "thumbnailUrl": "/v1/creative-assets/:assetId/content",
  "creativeType": "video",
  "metrics": {
    "clicks": 581,
    "impressions": 48361,
    "spend": 25000,
    "ctr": 0.0349,
    "cpc": 51.23
  },
  "previewAvailable": true,
  "previewFreshness": "2026-08-04T16:00:00Z"
}
```

### 6.2 Creative metadata

```http
GET /v1/clients/:clientId/data-sources/:dataSourceId/ads/:adId/creative
```

Возвращает normalized creative и список доступных placements.

```json
{
  "adId": "...",
  "creativeId": "...",
  "provider": "meta-ads",
  "type": "video",
  "identity": {
    "name": "Prostatit.pro",
    "avatarUrl": "/v1/creative-assets/.../content"
  },
  "copy": {
    "primaryText": "...",
    "headline": "...",
    "description": "..."
  },
  "cta": {
    "type": "WHATSAPP",
    "label": "WhatsApp",
    "destinationUrl": "..."
  },
  "media": {
    "type": "video",
    "thumbnailUrl": "/v1/creative-assets/.../content",
    "playbackUrl": "/v1/creative-assets/.../content"
  },
  "placements": [
    "desktop_feed",
    "mobile_feed",
    "instagram_feed",
    "instagram_story"
  ]
}
```

### 6.3 Provider preview

```http
GET /v1/clients/:clientId/data-sources/:dataSourceId/ads/:adId/preview
  ?placement=mobile_feed
  &locale=ru
```

Response:

```json
{
  "mode": "provider_html",
  "placement": "mobile_feed",
  "content": "sanitized html or signed IMDS URL",
  "expiresAt": "2026-08-04T17:00:00Z",
  "fallback": false
}
```

Если provider preview временно недоступен:

```json
{
  "mode": "normalized_json",
  "placement": "mobile_feed",
  "content": {},
  "fallback": true,
  "reason": "provider_preview_unavailable"
}
```

Frontend всегда должен уметь построить IMDS normalized preview как fallback.

## 7. Provider adapters

```ts
interface CreativePreviewProvider {
  syncAds(input: ProviderContext & DateRange): Promise<NormalizedAd[]>;
  syncCreatives(input: ProviderContext): Promise<NormalizedCreative[]>;
  syncAssets(input: ProviderContext): Promise<NormalizedCreativeAsset[]>;

  getPreview(input: ProviderContext & {
    adId: string;
    placement: PreviewPlacement;
    locale: string;
  }): Promise<ProviderPreview>;

  refreshAsset(input: ProviderContext & {
    externalAssetId: string;
    assetType: CreativeAssetType;
  }): Promise<TemporaryAsset>;
}
```

### Meta

Текущий Meta adapter получает у ad только `creative{id}`. Его нужно расширить отдельным creative sync, который нормализует:

- identity/page;
- primary text;
- headline and description;
- CTA;
- destination;
- image/video/carousel assets;
- thumbnail;
- provider placement availability.

Provider-generated preview вызывается on demand через backend adapter. Результат никогда не вставляется в основное DOM приложения без sanitization и sandbox.

### TikTok

Текущий TikTok adapter синхронизирует только campaign-level reporting. Нужно добавить:

- Ad Group entity sync;
- Ad entity sync;
- creative/video identifiers;
- cover image;
- temporary playback URL renewal;
- Spark and non-Spark identity metadata;
- on-demand creative preview.

TikTok video cover и preview URLs являются временными, поэтому `expires_at` является обязательной частью asset model.

## 8. Frontend

### AdsExplorerPage

```text
AdsExplorerPage
  ClientAnalyticsHeader
  DateRangeControl
  AccountFilter
  FilterBuilder
  KPI strip
  Charts
  AdsTable
```

Минимальные columns:

```text
Campaign
Ad + thumbnail
Ad Set / Ad Group
Status
Clicks
Impressions
Spend
Average CPC
CTR
Conversions
```

### AdPreviewDrawer

```text
AdPreviewDrawer
  header
    title
    freshness indicator
    close
  PlacementTabs
    Desktop
    Mobile
    Instagram
    TikTok
  PreviewViewport
  CreativeMetadata
  PerformanceSummary
```

Drawer должен иметь ширину `min(560px, 100vw)` и открываться поверх текущего Ads table без потери filters/date range.

### Безопасный render

При `provider_html`:

```html
<iframe
  sandbox="allow-scripts allow-forms allow-popups"
  referrerpolicy="no-referrer"
  src="IMDS_SIGNED_PREVIEW_URL"
/>
```

Нельзя использовать `dangerouslySetInnerHTML` для provider HTML в основном document.

При `normalized_json` frontend рендерит собственные placement templates IMDS.

## 9. Security

Обязательные правила:

- provider access/refresh tokens только в encrypted vault;
- preview endpoint проверяет user JWT, membership и client access;
- `dataSourceId` должен принадлежать запрошенному client;
- provider HTML очищается и обслуживается с отдельного origin или sandboxed endpoint;
- CSP запрещает произвольные parent navigation и credentialed third-party requests;
- destination URLs отображаются, но не исполняются автоматически;
- signed media URL имеет короткий TTL;
- provider payload не должен содержать token, app secret или internal credential handle;
- private preview cache недоступен через Supabase authenticated role;
- audit log фиксирует preview generation errors без creative text и token payload.

## 10. Cache и freshness

Рекомендуемые TTL:

```text
normalized creative metadata: 6-24 hours
thumbnail copied to private storage: until checksum changes
provider HTML preview: 15-60 minutes
provider video playback URL: until provider expiration minus safety window
negative preview cache: 1-5 minutes
```

Cache key:

```text
provider:dataSourceId:adId:placement:locale:creativeContentHash
```

При изменении `content_hash` старые previews инвалидируются.

## 11. Jobs

Новые job kinds:

```text
paid_ads.entities
paid_ads.creatives
paid_ads.assets
paid_ads.metrics
paid_ads.breakdowns
paid_ads.preview_warmup   optional
```

Preview generation не должен блокировать metric sync. Это отдельный low-priority flow.

Recommended sync order:

```text
accounts
  -> campaigns
  -> adgroups
  -> ads
  -> creatives
  -> assets
  -> metrics
  -> breakdowns
```

## 12. Изменения в текущем репозитории

### services/sync-worker

- расширить MetaClient creative fields and asset sync;
- добавить Meta creative normalizer;
- добавить TikTok ad group/ad/creative clients;
- разделить provider registry на entity, creative, metric и breakdown adapters;
- upsert entities, creatives, links и assets отдельными repository methods.

### services/integration-service

Добавить:

```text
CreativePreviewController
CreativePreviewService
CreativeProviderRegistry
PreviewCacheRepository
AssetProxyController
```

Integration Service должен обращаться к credential vault внутри backend, а не возвращать credential worker/frontend.

### apps/marketing-web

Добавить:

```text
pages/integrations/AdsExplorerPage.tsx
components/ads/AdsDataTable.tsx
components/ads/CreativeThumbnail.tsx
components/ads/AdPreviewDrawer.tsx
components/ads/NormalizedAdPreview.tsx
components/ads/ProviderPreviewFrame.tsx
components/ads/CreativePerformancePanel.tsx
```

### supabase/migrations

Добавить tenant-scoped schema для:

```text
marketing_entities
marketing_creatives
marketing_ad_creative_links
marketing_creative_assets
private.marketing_preview_cache
```

RLS для public entities/assets должен повторять client access model `private.can_access_client(client_id)`. Private preview cache доступен только backend/service role.

## 13. Этапы реализации

### Этап 1: Meta Ads vertical slice

- Meta Campaign -> Ad Set -> Ad entity hierarchy;
- creative metadata;
- thumbnail в Ads table;
- normalized mobile/desktop preview;
- provider preview endpoint;
- AdPreviewDrawer;
- metrics panel.

### Этап 2: Instagram placements

- Instagram feed;
- Instagram story/reel;
- placement availability;
- fallback при несовместимом формате.

### Этап 3: TikTok

- Ad Groups and Ads;
- video cover and playback URL renewal;
- Spark/non-Spark identity;
- TikTok provider preview;
- normalized fallback.

### Этап 4: Creative analytics

- creative-level rankings;
- fatigue indicators;
- hook retention and video metrics where provider supports them;
- compare creatives;
- creative library and reuse history.

## 14. Definition of Done

Creative Preview считается готовым, когда:

- thumbnail присутствует в Ads table;
- drawer открывается без reset filters;
- deep link восстанавливает выбранное объявление;
- Desktop/Mobile/Instagram/TikTok tabs показываются только когда placement доступен;
- provider preview имеет normalized fallback;
- expired media URLs обновляются backend;
- токены отсутствуют в browser network payload;
- RLS/tenant checks покрыты tests;
- preview HTML изолирован sandbox/CSP;
- provider failure не ломает Ads analytics page;
- EN/RU/KK labels полностью локализованы.
