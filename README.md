# Yums

AI savings agent for college students — answers "what's the cheapest and
easiest way for me to find free food and eat cheap around campus this
week?" for UC Berkeley students. See [`docs/product.md`](docs/product.md)
for scope, [`docs/architecture.md`](docs/architecture.md) for how it's
built, and [`docs/data-sources.md`](docs/data-sources.md) for exactly
what's live vs. reference-only.

## Develop

```
npm install
npm run dev
```

Runs the Next.js app at `apps/web` on http://localhost:3000. No environment
variables are required to run the MVP — it reads from mock data
(`apps/web/src/lib/mock-data.ts`) and live public feeds until
Supabase/Google/OpenAI/Mapbox keys are added (see
[`apps/web/.env.example`](apps/web/.env.example)):

- **Supabase** — magic-link auth + cross-device preference sync
- **Google Calendar** — real schedule-aware scoring
- **OpenAI** — LLM-based chat and event/deal extraction
- **Mapbox** — map view on `/feed`

Every integration is optional and degrades honestly (an explicit "not
configured" state, never a fabricated result) when its keys are absent.

## Test

```
npm test
```

Runs the Vitest suite across all workspaces.

## Structure

```
apps/web                    Next.js 16 (App Router) frontend + API routes
services/event-ingestion    Campus event source adapters + food extraction
packages/database            Postgres schema (packages/database/schema.sql)
packages/shared               Shared types + deterministic scoring math
docs/                        Product, architecture, and data-source notes
```

`apps/web` depends on `@yums/shared` and `@yums/event-ingestion` as npm
workspace packages.
