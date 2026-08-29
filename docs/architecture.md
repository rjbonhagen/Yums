# Architecture

## Repo layout

```
apps/web              Next.js 16 (App Router) frontend + API routes
services/event-ingestion   CampusEventSource adapter interface + mock Berkeley source + food extraction
packages/database      Supabase/Postgres schema (schema.sql)
packages/shared        Cross-package types + deterministic scoring math
```

`apps/web` depends on `@yums/shared` and `@yums/event-ingestion` as npm
workspace packages (see root `package.json`).

## Data flow (live-first, documented fallbacks)

```
events.berkeley.edu (live)   ─┐
callink.berkeley.edu (live)   ├─> apps/web/src/lib/recommendations.ts (async)
OpenStreetMap Overpass (live)─┘      scores + ranks free food + nearby eats
                                     |
apps/web/src/lib/mock-data.ts ──────┘ (freeFoodEvents: fallback only, on Berkeley-calendar fetch failure)
                                     |
apps/web/src/app/api/recommendations/route.ts
                                     |
                          /, /dashboard, /feed pages, chatbot
```

`buildRecommendations()` is async and returns `{ recommendations, meta }`.
`meta.freeFood.source`, `meta.callink.source`, and `meta.nearbyEats.source`
tell every caller (`/`, `/dashboard`, `/feed`, `/api/recommendations`, the
chatbot) whether each piece is genuinely live right now or degraded, with
the real error message attached — nothing silently pretends to be live
when it isn't.

`services/event-ingestion` has three `CampusEventSource` adapters:
`berkeleyMockSource` (hand-written, fallback-only), `berkeleyLiveSource`
(hits `events.berkeley.edu`'s public JSON feed), and `callinkSource` (hits
`callink.berkeley.edu`'s public club-events API — UC Berkeley's official
student-org platform, richer than the Berkeley calendar feed since it
includes real descriptions, an organizer-set "Free Food" benefit tag, and
sometimes coordinates). All three run through `extractDeterministic`.
`apps/web/src/lib/nearby-places.ts` hits OpenStreetMap's Overpass API for
real cafes/restaurants/fast-food near campus — see `docs/data-sources.md`
for exactly what's live vs. reference, including a known
Overpass-reachability caveat on the dev machine this was built on
(confirmed not a code bug — verified against the real API via `curl`).

## Caching the live sources inside dynamically-rendered pages

`/dashboard`, `/feed`, and `/api/recommendations` all read a Request-time
API (`searchParams` and/or `cookies()` via `getConnectedCalendarAccessToken`
for calendar personalization). Once a render touches any Request-time API,
Next.js stops honoring an individual `fetch()`'s own `cache`/`next.revalidate`
options for that render — verified empirically in this codebase: identical
fetches went from ~65ms (cached) to 2-6s (live, every request) the moment
any Request-time API was read anywhere in the same render, regardless of
`cache: 'force-cache'` on the fetch itself.

The fix, used throughout `apps/web/src/lib/recommendations.ts`: wrap
each live source in `unstable_cache` (Next's
documented mechanism for persisting a function's result across requests
independent of whether the calling route is dynamically rendered), defined
once at module scope, not per-call. This alone was sufficient for the two
GET-based sources (Berkeley calendar, Cal Link). The Overpass source is a
`POST` request, and empirically needed **both** `unstable_cache` *and* the
raw fetch's own `cache: 'force-cache'` together — `unstable_cache` alone
left it re-fetching (and, given this dev machine's documented Overpass
flakiness, frequently timing out at the full 6s `AbortSignal` ceiling) on
every request from a dynamically-rendered route, even though the identical
pattern worked for GET sources. Root cause not fully confirmed beyond that
combination fixing it — if revisiting, check whether a future Next.js
version changes this POST-specific behavior before assuming the double
opt-in is still required.

Do not reach for `export const dynamic = "force-dynamic"` as a "make it
fresh" lever here — it's documented to force every `fetch()` in that route
to `{ cache: 'no-store', next: { revalidate: 0 } }`, unconditionally
overriding the caching described above.

## Scoring (deterministic, no LLM)

`packages/shared/optimizer.ts`:

```
score = savings*w1 + proximity*w2 + schedule*w3 + preference*w4 + confidence*w5
```

`scheduleScore` is a real overlap check against the user's Google Calendar
once they connect one (see the "Schedule awareness" section below); it
stays the original flat placeholder (0.5 for nearby eats, 0.7 for free-food
events pre-connection) otherwise.

## AI responsibilities (per the original spec)

Use an LLM for: parsing natural-language budget/preference requests,
extracting food info from event descriptions, explaining recommendations.

Never use an LLM for: price comparisons, distance math, budget arithmetic,
the recommendation score itself — all of that is plain TypeScript in
`packages/shared` and `apps/web/src/lib`.

**Chat**: wired. `apps/web/src/lib/chatbot.ts`'s `answerWithLLM()` calls
OpenAI's chat completions API directly (raw `fetch`, no SDK — same
pattern as every other external integration in this app) once
`OPENAI_API_KEY` is set. Its system prompt hands the model the same live
`buildRecommendations()` data `answerDeterministically()` uses and
explicitly instructs it to answer only from that, never invent events or
prices — the no-fabrication rule enforced via the prompt instead of a
keyword match. `/api/chat/route.ts` tries the LLM path first when
configured and falls back to `answerDeterministically()` on any failure
(bad/expired key, rate limit, outage) so a chat request never hard-fails.

**Extraction**: still a stub. The `extractWithLLM` function in
`services/event-ingestion/extract.ts` is the intended integration point
for extracting food info from event descriptions, not yet implemented.

## Auth / persistence

`packages/database/schema.sql` defines the full V1 schema with RLS
policies, ready for `supabase db push`, including a `handle_new_auth_user`
trigger that mirrors each new Supabase auth user into `public.users` (the
FK every other user-scoped table points at) and a `calendar_connections`
table for the Google Calendar integration below.
`apps/web/src/lib/supabase/{client,server}.ts` provide typed client
factories that throw a clear error if env vars are missing;
`apps/web/src/proxy.ts` (Next.js 16's renamed `middleware.ts`) refreshes
the session cookie on every request via `lib/supabase/middleware.ts`.

**Login**: `/login` (`apps/web/src/app/login/page.tsx`) sends a Supabase
magic-link email; `/auth/callback` exchanges the emailed code for a real
session. `components/auth-status.tsx` in `Nav` shows sign-in/sign-out based
on live auth state. All of this no-ops honestly when Supabase isn't
configured — `/login` says so instead of showing a broken form.

Preferences persistence now has two levels, chosen automatically:

- **No session (default)**: `apps/web/src/lib/preferences.ts`'s
  `saveLocalPreferences`/`loadLocalPreferences` write to `localStorage`.
  `/start` saves on submit and restores on load.
- **Signed in**: the same file's `savePreferencesToSupabase` /
  `loadPreferencesFromSupabase` write/read the real `user_preferences`
  table via the session's user id — `/start` calls these automatically
  once `/login` has produced a session, falling back to
  `saveLocalPreferences` if the Supabase write itself fails so input is
  never silently lost.

## Schedule awareness (Google Calendar)

`apps/web/src/lib/google-calendar.ts` calls Google's real Calendar
FreeBusy API once a user connects via `/login`'s "Connect Google Calendar"
button (`supabase.auth.linkIdentity()` with the `calendar.freebusy` scope,
requires a Google OAuth provider configured in the Supabase project
dashboard). `/auth/callback` stores the resulting access/refresh token in
`calendar_connections`; `getConnectedCalendarAccessToken()` resolves
(refreshing if expired via `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) and
is wired into `/dashboard`, `/feed`, and `/api/recommendations`.

`buildRecommendations()` uses this to compute a real per-event
`scheduleScore` — `scheduleScoreFromBusyIntervals()` is a deterministic
overlap check against the user's real busy blocks, not a model guess —
falling back to the same flat `0.7` placeholder used before whenever no
calendar is connected or the FreeBusy call fails, with
`meta.schedule.source` (`"live" | "placeholder" | "unavailable"`) telling
callers which happened.
