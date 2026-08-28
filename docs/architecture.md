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

## Data flow (live-first, documented fallbacks)

```
events.berkeley.edu (live)  ─┐
                              ├─> apps/web/src/lib/recommendations.ts (async)
OpenStreetMap Overpass (live)┘      scores + ranks free food + nearby eats
                                     |
apps/web/src/lib/mock-data.ts ──────┘ (freeFoodEvents: fallback only, on fetch failure)
                                     |
apps/web/src/lib/grocery-optimizer.ts (reference pricing, real store locations)
                                     |
apps/web/src/app/api/recommendations/route.ts
                                     |
                          /, /dashboard, /feed pages, chatbot
```

`buildRecommendations()` is async and returns `{ recommendations, meta }`.
`meta.freeFood.source` and `meta.nearbyEats.source` tell every caller
(`/`, `/dashboard`, `/feed`, `/api/recommendations`, the chatbot) whether
each piece is genuinely live right now or degraded, with the real error
message attached — nothing silently pretends to be live when it isn't.

`services/event-ingestion` has two `CampusEventSource` adapters:
`berkeleyMockSource` (hand-written, fallback-only) and `berkeleyLiveSource`
(hits `events.berkeley.edu`'s public JSON feed for real). Both run through
`extractDeterministic`. `apps/web/src/lib/nearby-places.ts` hits
OpenStreetMap's Overpass API for real cafes/restaurants/fast-food near
campus — see `docs/data-sources.md` for exactly what's live vs. reference,
including a known Overpass-reachability caveat on the dev machine this was
built on (confirmed not a code bug — verified against the real API via
`curl`).

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

`grocery-optimizer.ts` still reads its price catalog from `mock-data.ts`
(reference pricing, see `docs/data-sources.md`) — that's a data-source gap,
not a persistence gap, and unaffected by Supabase wiring.

Meal plan (swipes/dining dollars/days left) is collected directly from the
user on `/start` and passed through to `/dashboard` via query params +
`localStorage`, same pattern as the rest of the preferences — there's no
external source to fetch this from (see `docs/data-sources.md`).
