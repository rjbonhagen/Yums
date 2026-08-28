# Architecture

## Repo layout

```
apps/web              Next.js 16 (App Router) frontend + API routes
services/event-ingestion   CampusEventSource adapter interface + mock Berkeley source + food extraction
packages/database      Supabase/Postgres schema (schema.sql)
packages/shared        Cross-package types + deterministic scoring math
```

`apps/web` depends on `@campus/shared` and `@campus/event-ingestion` as npm
workspace packages (see root `package.json`).

## Data flow (current, mock-backed)

```
apps/web/src/lib/mock-data.ts
  -> apps/web/src/lib/recommendations.ts   (scores free food + deals)
  -> apps/web/src/lib/grocery-optimizer.ts (cheapest basket across stores)
  -> apps/web/src/app/api/recommendations/route.ts
  -> /dashboard, /feed pages
```

`services/event-ingestion` is a separate, standalone pipeline (not yet wired
into the web app's API route) that demonstrates the real shape: a
`CampusEventSource` adapter fetches raw `CampusEvent[]`, then
`extractDeterministic` (or eventually an LLM call) tags each with a food
description and confidence score. Swapping the mock Berkeley source for a real
one, or wiring this pipeline into `/api/recommendations`, is the next step
once a real event source is chosen (see `docs/data-sources.md`).

## Scoring (deterministic, no LLM)

`packages/shared/optimizer.ts`:

```
score = savings*w1 + proximity*w2 + schedule*w3 + preference*w4 + confidence*w5
```

`scheduleScore` is currently a flat placeholder (0.5–0.7) until Google
Calendar integration lands — see Phase 5 in the original handoff doc.

## AI responsibilities (per the original spec)

Use an LLM for: parsing natural-language budget/preference requests,
extracting food info from event descriptions, generating meal plans,
explaining recommendations, product substitution reasoning.

Never use an LLM for: price comparisons, distance math, budget arithmetic,
the recommendation score itself — all of that is plain TypeScript in
`packages/shared` and `apps/web/src/lib`.

No LLM calls are wired up yet (no `OPENAI_API_KEY` handling exists). The
`extractWithLLM` stub in `services/event-ingestion/extract.ts` is the
intended integration point.

## Auth / persistence

`packages/database/schema.sql` defines the full V1 schema with RLS
policies, ready for `supabase db push`. `apps/web/src/lib/supabase/{client,server}.ts`
provide typed client factories that throw a clear error if env vars are
missing — the app currently never calls them; all pages read from
`mock-data.ts` instead. Wiring persistence in means: replace the mock-data
imports in `recommendations.ts` / `grocery-optimizer.ts` with Supabase
queries, and add the onboarding form's submit handler to write to
`user_preferences`.
