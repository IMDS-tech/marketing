# Runtime and port matrix

| Component | Package | Local port | Public ingress | Responsibility |
|---|---|---:|---|---|
| Marketing Web | `@imds/marketing-web` | 5173 | Yes | React SPA and Supabase Auth session |
| Platform Core | `@imds/platform-core-service` | 4300 | Yes | Workspace, agency, memberships, teams, billing metadata, onboarding and permissions |
| Clients API | `@imds/clients-api` | 4102 | Yes | Clients, groups and client users |
| Integration Service | `@imds/integration-service` | 4100 | Yes plus protected internal route | OAuth, encrypted credentials, sources and sync health |
| Report API | `@imds/report-api` | 4200 | Yes | Analytics, dashboards and reports |
| Notification Worker | `@imds/notification-worker` | 4303 metadata only | No by default | Delivery queue and channels |
| AI Service | `@imds/ai-service` | 4304 | Yes | Tenant-scoped AI requests and usage |
| Search Indexer | `@imds/search-indexer` | 4305 | Yes/internal | Search API and indexing jobs |
| Sync Worker | `@imds/marketing-sync-worker` | none | No | Provider synchronization jobs |
| Supabase API | local Supabase | 54321 | Local/managed | Auth, Data API, Storage and Realtime |
| PostgreSQL | local Supabase | 54322 | Private | System of record |
| Supabase Studio | local Supabase | 54323 | Local only | Database administration |
| Inbucket | local Supabase | 54324 | Local only | Development email capture |

## Rules

1. This matrix, every `.env.example`, compose file, frontend service console and deployment configuration must remain identical.
2. Only browser-safe values use the `VITE_` prefix.
3. Worker processes do not need public ingress.
4. Production services expose `/health`; dependency-aware `/ready` is the next hardening contract.
5. A port change updates `scripts/validate-port-matrix.mjs` in the same pull request.
