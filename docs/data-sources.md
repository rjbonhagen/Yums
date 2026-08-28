# Data sources — live vs. reference

## Free food events — LIVE

`services/event-ingestion/sources/berkeley-live.ts` hits
`events.berkeley.edu`'s public, unauthenticated JSON calendar feed
(`/live/json/events/?days=1&pp=100`) at request time. Real titles, URLs,
and start/end times for whatever's on Berkeley's calendar today. Powers
`/dashboard`, `/feed`, `/`, and the chatbot's free-food answers via
`buildRecommendations()` in `apps/web/src/lib/recommendations.ts`.

**What's missing**: the feed doesn't return description or location
fields — every query-param combination tried (`fields[]=`, `fields=`, bare
booleans) left `meta.response_fields` empty, so live events show up with
title/time only, no venue, and "distance unknown" rather than a guessed
one. Food keyword matching runs on the title alone (lower-precision than a
full description would give).

**Fallback**: `apps/web/src/lib/mock-data.ts`'s `freeFoodEvents` — used
only if the live fetch itself throws (network error, upstream down), never
as the default. `buildRecommendations()`'s returned `meta.freeFood.source`
tells the UI which one actually happened, and the UI shows a banner when
it's the fallback.

## Nearby eats — LIVE (real businesses, no fabricated deals)

`apps/web/src/lib/nearby-places.ts` queries OpenStreetMap's Overpass API
(public, keyless) for real cafes/restaurants/fast-food within a bounding
box around campus. This replaced a set of made-up business names ("Local
Poke Shop", "Burrito Corner") the app used to show as fake "student
deals." **No public source exists for real student-discount data** — none
of the businesses near campus publish one — so rather than attach fake
discount percentages to real places, this is shown honestly as "nearby
eats" with no savings claim (see the `RecommendationKind` comment in
`packages/shared/types.ts`).

Also used by `apps/web/src/lib/grocery-stores.ts` to find real coordinates
for Target/Safeway/Berkeley Bowl/Trader Joe's near campus (matched by name
against Overpass results), shown as a live "~N min walk" next to each
store in the `/feed` basket.

**Known reliability caveat**: verified working end-to-end via `curl`
against `overpass-api.de` — real business data confirmed (Caffé Strada,
Royal Ground Coffee, Target, Safeway, Trader Joe's, Berkeley Bowl, all with
real coordinates). During development, Node's `fetch` (and even the raw
`https` module) on the dev machine used to build this intermittently
couldn't reach `overpass-api.de` or its `overpass.kumi.systems` mirror
(`fetch failed` / connection timeouts), while `curl.exe` on the same
machine reached it reliably every time. That points to a TLS-fingerprint-
or client-based block somewhere on that machine's network path — not a bug
in this code, and not something fixable from application code. Two
mirrors are tried with a 6s timeout each; if both fail,
`meta.nearbyEats.source` is set to `"unavailable"` with the real error
message, and the UI says so rather than showing fabricated data. On a
normal deployment network this should just work — verify with `curl -X
POST https://overpass-api.de/api/interpreter --data-urlencode
'data=[out:json];node["amenity"="cafe"](37.86,-122.27,37.87,-122.25);out
body 5;'`.

## Grocery prices — reference only, not live

`apps/web/src/lib/mock-data.ts`'s `groceryProducts` — a manually
maintained snapshot. **Confirmed no public API exists** for any of these
chains (Target, Safeway, Berkeley Bowl, Trader Joe's) — this isn't a
"haven't gotten to it yet," it's a real gap. Store *locations* are live
(see above); per-item *prices* are not, and the UI/chatbot say so
explicitly rather than implying otherwise.

**To go live**: either a manually updated price sheet on a schedule, a
retailer partner API (Instacart/Kroger have one; none of these four
chains do), or browser automation against store websites — fragile,
higher maintenance, arguably better deferred to the agentic-checkout phase
where automation is needed anyway.

## Distance / routing — real geometry, real coordinates

`apps/web/src/lib/geo.ts`'s `haversineMinutes()` computes actual
great-circle distance between real coordinates (replacing an earlier
placeholder that multiplied an arbitrary lat/lng delta by a constant).
`walkingMinutesBetween()` calls the public OSRM demo router
(`router.project-osrm.org`, keyless) for real routed walking time,
falling back to the haversine estimate if that's slow/unreachable —
verified working via `curl`. Not wired into every recommendation (would
mean one OSRM call per item); used where a small, bounded number of calls
makes sense.

## Meal plan / dining dollars — user input, not a data source

There's no public API for a student's own dining balance (and there
couldn't reasonably be one without the student's real login — out of
scope, and this app is not the place to collect campus SSO credentials).
`/start` now asks for meal swipes / dining dollars / days left directly,
persisted via `apps/web/src/lib/preferences.ts`, and `/dashboard` uses
whatever was entered instead of a hardcoded number. This isn't "mocked" —
it's real user-provided data, same as budget or transportation.

## Schedule

Not implemented. `scheduleScore` in the recommendation engine is a flat
placeholder. Google Calendar integration was scoped for Phase 5 in the
original handoff doc.

## Auth / preference persistence

See `docs/architecture.md`'s Auth / persistence section — `localStorage`
works today; the Supabase read/write path is written and correct but not
wired in, pending a login flow.
