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

`services/event-ingestion` now has two `CampusEventSource` adapters:
`berkeleyMockSource` (hand-written) and `berkeleyLiveSource`, which really
does hit `events.berkeley.edu`'s public JSON feed at request time. Both run
through the same `extractDeterministic` food-tagging pass. The live source
is wired into `GET /api/events/live` and shown on `/feed`, but not into
`/api/recommendations` yet — the live feed has no lat/lng or organization
data, so it can't be scored/ranked the same way (see `docs/data-sources.md`
for exactly what's missing and why).

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
missing.

Preferences persistence exists at two levels today:

- **Working now, no config needed**: `apps/web/src/lib/preferences.ts`'s
  `saveLocalPreferences`/`loadLocalPreferences` write to `localStorage`.
  `/start` saves on submit and restores on load — refresh the browser and
  your budget/optimize-for/transportation/max-travel settings are still
  there.
- **Written, not wired in**: the same file's `savePreferencesToSupabase` /
  `loadPreferencesFromSupabase` write/read the real `user_preferences`
  table via a passed-in `SupabaseClient` and user id. Nothing calls these
  yet because there's no login flow (magic link / OAuth) to produce an
  authenticated session — that's the next piece. Once it exists, swap
  `/start`'s submit handler to call `savePreferencesToSupabase` when signed
  in, falling back to `saveLocalPreferences` otherwise.

`recommendations.ts` / `grocery-optimizer.ts` still read from
`mock-data.ts` regardless — swapping those for Supabase queries is a
separate step from preferences persistence.
