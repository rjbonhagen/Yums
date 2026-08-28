# Data sources — live vs. mocked

Most of the app runs on `apps/web/src/lib/mock-data.ts` and
`services/event-ingestion/sources/berkeley-mock.ts`, both clearly marked
MOCK in-file. One source is now genuinely live — see below. This doc exists
so nobody mistakes mock data for a working integration, and to track what a
real integration needs to replace it.

## Free food events

**Live (partial)**: `services/event-ingestion/sources/berkeley-live.ts`
hits `events.berkeley.edu`'s public, unauthenticated JSON calendar feed
(`/live/json/events/?days=1&pp=100`) at request time — real event titles,
URLs, and start/end times for whatever's on Berkeley's calendar today.
Exposed via `GET /api/events/live` and shown in a "Live from Berkeley's
events calendar" section on `/feed`, kept separate from the main
`/api/recommendations` demo so a slow/unreachable upstream never breaks it.

**What's still missing**: the feed doesn't return description or location
fields — every query-param combination tried (`fields[]=`, `fields=`, bare
booleans) left `meta.response_fields` empty, so this adapter is honest
about that gap rather than guessing at a venue or writing a fake
description. That means these live events aren't distance-scored or ranked
like the mock recommendations are (no lat/lng to work with), and food
detection runs on the title alone, so it's lower-precision than the mocked
events (which have full descriptions to key off of).

**Still mocked**: the main `/dashboard` and `/api/recommendations` paths —
3 hand-written UC Berkeley events (ACM meeting, Haas speaker series, res
hall social) in `berkeley-mock.ts` / `mock-data.ts` — because they need
lat/lng and organization data the live feed doesn't provide yet.

**To fully go live**: either find the right param to unlock
location/description on the existing feed, or add a second
`CampusEventSource` per source:

- ASUC club event portal
- Department event pages (Haas, EECS, etc.)
- Public Instagram posts — needs Meta Graph API access + business account
  scraping is fragile/ToS-risky; prefer official APIs where they exist
- Discord announcements — only where a bot/API is authorized by the server

Each adapter returns `CampusEvent[]`; `extractDeterministic` (or
`extractWithLLM` once implemented) tags food + confidence.

## Student deals

**Mocked**: 3 hand-written deals in `mock-data.ts`.

**To go live**: no adapter interface exists yet (unlike events). Needs the
same `fetchDeals(): Promise<StudentDeal[]>` shape, likely sourced from
manually curated business partnerships first (most local restaurants don't
publish structured deal data) before any scraping is attempted.

## Grocery prices

**Mocked**: 12 hand-written products across Target/Safeway/Berkeley
Bowl/Trader Joe's in `mock-data.ts`.

**To go live**: retailer APIs are the main blocker — most (Target, Safeway,
Berkeley Bowl, Trader Joe's) don't offer public product/price APIs. Options, roughly in order
of effort: manually maintained price sheet (fastest to ship, needs regular
updates), Instacart/Kroger partner APIs where available, or browser
automation (Playwright) against store websites — fragile and higher
maintenance, save for the agentic-checkout phase where automation is
needed anyway.

## Maps / distance

**Mocked**: `apps/web/src/lib/recommendations.ts` computes a rough
"minutes away" from a lat/lng delta around a hardcoded campus center — not
real routing. No Mapbox/Google Maps key is configured
(`NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.example` is unset).

## Schedule

Not implemented. `scheduleScore` in the recommendation engine is a flat
placeholder. Google Calendar integration was scoped for Phase 5 in the
original handoff doc.
