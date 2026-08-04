# ADR-0001: Архитектура IMDS Marketing Platform

- Статус: Accepted for Phase 1
- Дата: 2026-08-04
- Владельцы: Architecture, Backend, Frontend, Data, DevOps

## Контекст

IMDS Marketing Platform — мульти-тенантная SaaS-платформа для агентств. Агентство управляет клиентами, подключает рекламные и аналитические источники, получает автоматически синхронизируемые метрики, строит дашборды, отчёты, white-label портал и предоставляет ограниченный доступ клиентам.

Целевая иерархия:

```text
Agency (tenant)
└── Client
    ├── Data Sources
    ├── Dashboards
    │   └── Sections
    │       └── Widgets
    ├── Reports
    ├── Views
    ├── KPIs
    └── Client Portal
```

Платформа должна поддерживать:

- строгую изоляцию агентств и клиентов;
- десятки коннекторов с разными OAuth, rate-limit и схемами;
- длинные временные ряды рекламных и аналитических метрик;
- интерактивные виджеты с ответом агрегатов менее 300 мс;
- фоновые синхронизации, backfill, PDF/XLS и scheduled reports;
- white-label, public API, AI и MCP без обхода tenant authorization.

## Решение

Выбираем модульную платформу с разделением control plane, data plane и presentation plane.

```text
┌──────────────────────────────── Presentation plane ────────────────────────────────┐
│ marketing-web │ client-portal │ public share pages │ API Playground │ AgencyAI   │
└───────────────────────────────┬────────────────────────────────────────────────────┘
                                │ HTTPS / typed API
┌───────────────────────────────▼──────────── Application plane ─────────────────────┐
│ API Gateway / BFF                                                               │
│ ├── Identity & Tenant Context                                                   │
│ ├── Clients, Dashboards, Widgets, Reports, Views, KPIs                          │
│ ├── Reporting / AAQL Query Service                                              │
│ ├── Export / PDF / Email                                                        │
│ └── AI tool layer                                                               │
└───────────────────────────────┬────────────────────────────────────────────────────┘
                                │ commands / events / jobs
┌───────────────────────────────▼──────────── Integration & data plane ──────────────┐
│ Integration Service │ Connector plugins │ Sync Dispatcher │ Workers              │
│         │                   │                    │             │                   │
│         └── encrypted credentials / token refresh ─────────────┘                   │
│                              │ normalized metric rows                              │
│         PostgreSQL/Supabase  │ ClickHouse │ Redis/BullMQ │ Object Storage         │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Репозиторий

Используем pnpm monorepo:

```text
marketing
├── apps/
│   └── marketing-web
├── packages/
│   ├── ui
│   ├── api-client
│   ├── auth
│   ├── permissions
│   ├── integrations
│   └── analytics
├── supabase/
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Границы пакетов:

- `ui`: дизайн-токены и переиспользуемые компоненты без бизнес-логики.
- `api-client`: typed HTTP client, query keys, error model, pagination.
- `auth`: Supabase session adapter, bootstrap user/agency context.
- `permissions`: роли, policy helpers, route guards, widget/report capabilities.
- `integrations`: каталог коннекторов, connector contracts, provider adapters и sync worker.
- `analytics`: metric dictionary, formulas, date comparison, aggregation and formatting.

### 2. Frontend

- React 18 + TypeScript + Vite.
- TanStack Router для маршрутов и route loaders.
- TanStack Query для server state и кэша.
- Zustand только для локального UI/editor state.
- Tailwind CSS и собственный UI-kit.
- Recharts/ECharts для визуализаций.
- `dnd-kit` + `react-grid-layout` для редактора дашбордов.
- TipTap для rich-text widgets.

Frontend не обращается к закрытым таблицам через service-role и не владеет OAuth-секретами.

### 3. Backend

Целевой backend — NestJS modular monolith с выделенными workers. Модули могут быть вынесены в сервисы только после появления операционной необходимости.

Основные модули:

- Identity and Sessions;
- Agencies and Membership;
- Clients and Client Access;
- Integrations and Data Sources;
- Dashboards, Sections and Widgets;
- Reports, Templates and Scheduling;
- Views and Custom Metrics;
- KPIs, Roll-ups and Benchmarks;
- Exports and Files;
- AAQL Query API;
- Notifications and Activity Log;
- AI and MCP tools.

### 4. Хранилища

#### PostgreSQL / Supabase

Используется как system of record для:

- агентств, пользователей, memberships и permissions;
- клиентов и настроек портала;
- интеграций и data source metadata;
- дашбордов, виджетов, отчётов и шаблонов;
- sync jobs/runs metadata;
- API keys, notifications и audit log.

Все tenant-owned таблицы содержат `agency_id`. Client-owned таблицы дополнительно содержат `client_id`. На exposed schemas включается RLS.

Supabase в Phase 1 предоставляет PostgreSQL и Auth. Авторизация не строится на изменяемом `user_metadata`; роли и membership хранятся в приложенческих таблицах или app metadata.

#### ClickHouse

Используется для фактов и длинных временных рядов:

```text
metrics_daily(
  agency_id, client_id, data_source_id, integration,
  entity_type, entity_id, entity_name,
  date, metric_key, value,
  dimensions Map(String, String)
)
```

Производные показатели CTR, CPC, CPM, CPA, ROAS вычисляются из базовых метрик. Для популярных разрезов создаются materialized views.

До ввода ClickHouse Phase 1 может хранить ограниченный объём фактов в PostgreSQL через `marketing_daily_metrics`, но API не должен зависеть от физической реализации хранилища.

#### Redis / BullMQ

- очереди sync, backfill, exports, PDF и email;
- locks и idempotency keys;
- rate-limit state;
- кэш агрегатов и invalidation по sync events.

#### S3-compatible storage

Логотипы, пользовательские файлы, PDF/XLS/CSV exports и временные артефакты.

### 5. Интеграции

Каждый коннектор реализует единый контракт:

```ts
interface Connector {
  slug: string;
  category: ConnectorCategory;
  authType: AuthType;
  scopes: string[];

  authorize(context: AuthorizationContext): Promise<OAuthUrl | CredentialForm>;
  listAccounts(credentials: CredentialHandle): Promise<Account[]>;
  describeSchema(): ConnectorSchema;
  fetch(request: FetchRequest): AsyncIterable<ProviderRow>;
  normalize(rows: ProviderRow[]): MetricRow[];
}
```

Требования:

- refresh tokens хранятся только в Integration Service и шифруются KMS;
- incremental backfill до 365 дней;
- rolling resync последних 30 дней;
- cursor pagination, exponential backoff и provider rate-limits;
- idempotent writes;
- унифицированные ошибки: unauthorized, no permission, usage limit, network, not integrated, report not ready;
- отключение соединения вызывает notification и не удаляет исторические метрики.

### 6. Reporting и AAQL

Frontend-виджеты и public API используют единый query service. Query service:

1. получает проверенный agency/client context;
2. валидирует metrics, dimensions, filters и scope;
3. строит запрос к ClickHouse/PostgreSQL adapter;
4. возвращает current period, previous period, totals и metadata;
5. применяет Agency Markup в reporting layer;
6. кэширует результат с tenant-aware key.

Public AAQL endpoint всегда возвращает HTTP 200 и передаёт доменный статус в payload только для совместимости спецификации. Внутренний API использует обычную HTTP-семантику.

### 7. Мульти-тенантность и безопасность

- `agency_id` является обязательной границей tenant isolation.
- `client_id` ограничивает доступ Client User.
- Tenant context извлекается из проверенной server-side session, а не принимается как доверенный header.
- RLS является дополнительным уровнем защиты; backend также выполняет policy checks.
- Service-role используется только в server/worker runtime.
- Все public links имеют opaque token, optional password, expiry и revoke.
- API keys хранятся только как hash и имеют scopes.
- Audit log фиксирует security-sensitive и data-changing operations.
- AI tools вызывают те же policy-protected services, что и UI; прямого доступа LLM к БД нет.

### 8. Deployment

- `marketing-web` разворачивается на Cloudflare Workers static assets.
- API и workers поставляются контейнерами.
- Local и production environment конфигурируются через environment/secrets.
- GitHub Actions выполняет typecheck, lint, tests, build, migration validation и deploy gates.
- OpenTelemetry, Grafana и Sentry используются для observability.

### 9. Фазирование

1. Skeleton: auth, tenant/client model, UI-kit, application shell, sidebar и empty states.
2. Integrations: Google Ads, GA4, Meta Ads, TikTok Ads, Search Console, metric dictionary.
3. Dashboard editor, widgets, date comparison и filters.
4. Reports, templates, schedules, PDF/XLS и sharing.
5. Views, custom metrics, KPIs, roll-ups, benchmarks и bulk actions.
6. White-label, portal и fine-grained roles.
7. AAQL, Playground, AI и MCP.
8. Остальные коннекторы, billing и performance hardening.

## Отклонённые альтернативы

### Один frontend, напрямую читающий Supabase tables

Отклонено: создаёт жёсткую связь UI со схемой, усложняет ClickHouse, AAQL, Agency Markup и permission enforcement.

### Отдельный микросервис для каждого домена с первого дня

Отклонено: высокая операционная стоимость до появления реальной нагрузки. Модульный монолит сохраняет границы без преждевременной распределённости.

### Хранение всех временных рядов только в PostgreSQL

Допустимо для Phase 1, но не является конечным решением из-за объёма, cardinality и требований к быстрым cross-client roll-ups.

### Хранение OAuth credentials в marketing database

Отклонено: секреты принадлежат Integration Service; остальные модули используют credential handle и short-lived internal access.

## Последствия

Положительные:

- понятные ownership boundaries;
- безопасная tenancy;
- независимое развитие UI, connectors и storage;
- единая модель метрик и запросов;
- возможность начать с Supabase/PostgreSQL и мигрировать facts в ClickHouse без переписывания UI.

Стоимость:

- требуется typed query/reporting layer;
- необходимо поддерживать event contracts между sync и cache/reporting;
- две базы данных и очередь увеличивают DevOps-нагрузку на поздних фазах;
- connector SDK и metric dictionary должны управляться как платформенные контракты.
