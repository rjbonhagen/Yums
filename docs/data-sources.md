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

## Club events (Cal Link) — LIVE

`services/event-ingestion/sources/callink-live.ts` hits
`callink.berkeley.edu`'s public, unauthenticated JSON API
(`/api/discovery/event/search`) at request time. This is UC Berkeley's
official student-org platform (a CampusGroups instance) — real event
titles, full HTML descriptions (stripped to plain text), start/end times,
location names, and, when the organizing club entered them, real
coordinates. Filtered to events starting from now onward via the API's own
`startsAfter` param (confirmed working, not a guessed filter).

Unlike the Berkeley calendar feed above, Cal Link also returns a
`benefitNames` tag array that organizers set themselves — many food events
are tagged literally `"Free Food"`. That's a real, attributable signal, not
a guess, so it's folded into the description text handed to
`extractDeterministic()` rather than fabricating a separate confidence
path. Runs alongside (not instead of) the Berkeley calendar feed — the two
sources cover different event catalogs (club/org events vs. the
university's own calendar) with no meaningful overlap observed.

**What's missing**: not every event has coordinates — some clubs don't
enter a precise location, in which case `latitude`/`longitude` are left
undefined rather than guessed, same as the Berkeley feed's handling of
missing location data.

**Fallback**: none — there's no hand-written mock for this source. If the
live fetch throws, `buildRecommendations()`'s `meta.callink.source` is set
to `"unavailable"` with the real error, and Cal Link events are simply
omitted from that response rather than replaced with fake data. The UI
(`/dashboard`, `/feed`, chatbot) shows this the same honest way it already
handles a Overpass/nearby-eats outage.

This was investigated as an alternative to scraping Instagram/club social
pages for free-food posts — Instagram has no public read API for arbitrary
accounts and scraping it violates their ToS, whereas Cal Link is a real,
public, keyless API that already covers the same "what are clubs offering
free food at" need with attributable data.

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

**Specifically checked and ruled out**: ASUC (Berkeley's student
government) was the most plausible candidate for a real, published,
attributable student-discount list. Checked directly — `asuc.org`'s
homepage, every guessed discount-card URL, its full WordPress REST page
listing (100+ pages), and a REST search for "discount"/"card" — none show
a discount-card program currently published anywhere on the site. This is
a confirmed absence, not an unchecked gap; revisit only if ASUC publishes
one at a URL that can be found.

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

## Schedule — LIVE once connected, otherwise an honest placeholder

`apps/web/src/lib/google-calendar.ts` calls Google's real Calendar
FreeBusy API (`calendar.freebusy` scope) for the signed-in user's primary
calendar, once they explicitly connect via `/login`'s "Connect Google
Calendar" action (Google OAuth linked through Supabase — see
`docs/architecture.md`'s Auth / persistence section). `scheduleScore` for
each free-food event becomes a real overlap check against the user's own
busy blocks (`scheduleScoreFromBusyIntervals()` — no LLM, no guessing:
overlap = busy, no overlap = free) instead of a fabricated number.

**Fallback**: no connection (the default — nobody is opted in until they
click "Connect") or a FreeBusy fetch failure both leave `scheduleScore` at
the same flat `0.7` placeholder this always used; `meta.schedule.source` in
`buildRecommendations()`'s return value is `"live"`, `"placeholder"`, or
`"unavailable"` (with the real error) so callers can tell which happened,
same pattern as every other source in this file.

**Requires**: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (the app's own
OAuth client, used only to refresh expired access tokens — see
`apps/web/.env.example`) plus a Google OAuth provider configured in the
Supabase project dashboard with the `calendar.freebusy` scope allowed.
Neither is configured in this repo's example env — this is wired and
ready, not verified against a live Google Cloud project in this session.

## Auth / preference persistence

See `docs/architecture.md`'s Auth / persistence section — `localStorage`
still works for anyone not signed in; the Supabase read/write path is now
wired into `/start` via `/login`'s magic-link flow for anyone who is.
