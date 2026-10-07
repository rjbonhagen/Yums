# Data sources

## Berkeley calendar

`services/event-ingestion/sources/berkeley-live.ts` reads the public
`events.berkeley.edu/live/json/events/?days=1&pp=100` endpoint. The adapter
uses titles, source URLs, and start/end times; it has no venue or description
fields. Food extraction is therefore limited to title evidence. On failure,
its events are omitted and source status is unavailable. Coverage is today,
not a comprehensive weekly calendar.

## Cal Link

`callink-live.ts` reads the public event-search endpoint. It uses descriptions,
organizer names, times, and organizer-entered locations/coordinates. An exact
Free Food benefit is explicit organizer evidence. The source requests the
first 100 upcoming events; recommendation construction applies the seven-day
window. There is no pagination guarantee or completeness claim. Same-organization,
same-title grouping is a display heuristic, not verified recurrence metadata.

## OpenStreetMap

`apps/web/src/lib/nearby-places.ts` queries two Overpass instances for named
cafes, restaurants, and fast-food nodes around campus. Sources can time out;
failed results are omitted. Each live recommendation links to its OSM node.
Listings are not proof of opening hours, prices, student discounts, or nutrition.
No current price or merchant-offer dataset is integrated; this does not imply
that no such dataset could exist.

## Distances, Calendar, chat

Displayed walking times use haversine estimates from campus center. A separate
routing helper exists but is not used for every recommendation. Calendar
FreeBusy is optional and requires consent and OAuth configuration. Overlap
ranking uses actual source durations where present and a disclosed one-hour
fallback. Chat draws from the recommendation results; it cannot supply unknown
prices or verified savings.

## Explicit sample mode

`YUMS_DEMO_MODE=true` uses synthetic event times and sample restaurants for a
repeatable walkthrough. All sample listings are labeled. Normal live mode never
injects these during source outages. Sample mode is for presentation, not finding
real food. Public-feed checks and optional-service verification are dated in
`docs/demo-verification.md`; past observations are not uptime guarantees.
