# CampusSaver

AI savings agent for college students. See `docs/product.md` for scope,
`docs/architecture.md` for how it's built, `docs/data-sources.md` for what's
live vs. mocked.

## Develop

```
npm install
npm run dev
```

Runs the Next.js app at `apps/web` on http://localhost:3000. No environment
variables are required to run the MVP — it reads from mock data
(`apps/web/src/lib/mock-data.ts`) until Supabase/LLM/Maps keys are added
(see `apps/web/.env.example`).

## Structure

```
apps/web               Next.js frontend + API routes
services/event-ingestion   Campus event source adapters + food extraction
packages/database       Postgres schema (packages/database/schema.sql)
packages/shared         Shared types + deterministic scoring math
docs/                   Product, architecture, and data-source notes
```
