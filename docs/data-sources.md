# Data sources

## Berkeley calendar

`services/event-ingestion/sources/berkeley-live.ts` reads the public
LiveWhale JSON endpoint using documented path parameters for Pacific date
bounds, pagination, and explicit description/location fields. The old query
parameters were ignored by the source. Live verification on October 7 returned
544 records for the requested date range, with descriptions and venues.
Pagination reads all returned pages up to a bounded four-page limit; exceeding
that limit is disclosed as source unavailability. The recommendation layer
applies the final seven-date window and excludes ended events. No source
guarantees complete coverage of every campus offer.
Publisher-relative links resolve against the Berkeley origin; unsafe links
and records without required event fields are omitted during ingestion.

API format: [LiveWhale documentation](https://support.livewhale.com/live/blurbs/json-api).

## Cal Link

On October 16, 2026, both the event page and discovery endpoint redirected
anonymous requests to CalNet sign-in. Yums cannot currently import this feed.
The adapter detects the login redirect without following it, and the feed
shows an access message with a direct link to Cal Link. Restoring automatic
imports requires an approved public feed or another authorized integration;
personal CalNet sessions are not shared with Yums.

When publicly accessible, `callink-live.ts` reads the event-search endpoint using descriptions,
organizer names, times, and organizer-entered locations/coordinates. An exact
Free Food benefit is explicit organizer evidence. The source requests the
first 100 events starting within the last day or later, retaining recently
started events until their actual end; recommendation construction applies the seven-day
window. There is no pagination guarantee or completeness claim. Same-organization,
same-title grouping is a display heuristic, not verified recurrence metadata.

## OpenStreetMap

`apps/web/src/lib/nearby-places.ts` queries two Overpass instances for named
cafes, restaurants, and fast-food nodes around campus. Sources can time out;
failed results are omitted. Each live recommendation links to its OSM node.
Malformed mirror responses count as failures, allowing another valid mirror
to supply places; failures from both mirrors are disclosed as unavailability.
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
