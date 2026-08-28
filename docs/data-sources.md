# Data sources — live vs. mocked

Nothing below is connected to a real external source yet. Everything the
app shows comes from `apps/web/src/lib/mock-data.ts` and
`services/event-ingestion/sources/ucsd-mock.ts`, both clearly marked MOCK
in-file. This doc exists so nobody mistakes mock data for a working
integration, and to track what a real integration needs to replace it.

## Free food events

**Mocked**: 3 hand-written UCSD events (ACM meeting, Rady speaker series,
res hall social) in `ucsd-mock.ts` and duplicated in `mock-data.ts`.

**To go live**, implement a `CampusEventSource` (see
`services/event-ingestion/types.ts`) per real source:

- UCSD campus events calendar (check for a public iCal/JSON feed first)
- AS (Associated Students) club event portal
- Department event pages (Rady, Jacobs School, etc.)
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

**Mocked**: 12 hand-written products across Target/Safeway/Walmart in
`mock-data.ts`.

**To go live**: retailer APIs are the main blocker — most (Target, Safeway,
Walmart) don't offer public product/price APIs. Options, roughly in order
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
