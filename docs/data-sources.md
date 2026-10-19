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

The campuswide feed includes public department, Student Union, and club
announcements published to Berkeley Events. It is not a complete mirror of
Cal Link. On October 19, its public API returned the same Halloween Game Night
listed on Cal Link, with real October 29 times and an original event URL.
That public description alone did not explicitly establish free food; it
does not qualify just because a separate private listing has a food tag.

## Graduate Division calendar

`services/event-ingestion/sources/graduate-live.ts` reads the public
`https://grad.berkeley.edu/wp-json/tribe/events/v1/events` endpoint. Its
[published API schema](https://grad.berkeley.edu/wp-json/tribe/events/v1/doc)
documents the Pacific date bounds, published status, and pagination parameters.
October 19 verification returned eight records for the October 18–26 request,
without authentication. Returned records are opportunities to inspect, not
eight qualifying free-food offers.

The adapter uses the supplied UTC start/end fields, organizer and venue names,
and original Graduate Division event links. It decodes description text and
reads up to four pages of 100 records. Unsupported dates, all-day listings,
private records, and foreign/unsafe source links are omitted. Missing locations
are not invented. Malformed responses, redirects, and page limits are disclosed
as source unavailability. `cost: Free` means free admission and is never used
as food evidence; ambiguous provided-snacks wording remains excluded.

The two public calendars have independent two-minute caches. Requests refresh
expired cache windows; there is no background polling job. The feed applies
the same seven-campus-date window and explicit-food rules to both. Exact
cross-publisher reposts can collapse when their title, venue, real duration,
and organizer evidence agree. This is a conservative display heuristic, not a
claim to identify every repost.

## Cal Link

On October 16, 2026, both the event page and discovery endpoint redirected
anonymous requests to CalNet sign-in. October 19 checks of its advertised
`/events.ics` and `/events.rss` links also returned sign-in redirects. Automatic
discovery no longer requests Cal Link; the standalone adapter remains for a
future approved integration and detects login redirects without following them.
Restoring automatic imports requires an approved public feed or another authorized integration;
personal CalNet sessions are not shared with Yums.

A separate [personal calendar preview](local-callink-import.md) can read an
official iCal/Outlook export after the user signs in on Berkeley's site. It keeps
reviewed events in the local browser tab and does not populate the shared feed.

When publicly accessible, `callink-live.ts` reads the event-search endpoint using descriptions,
organizer names, times, and organizer-entered locations/coordinates. An exact
Free Food benefit is explicit organizer evidence. The source requests the
first 100 events starting within the last day or later, retaining recently
started events until their actual end; recommendation construction applies the seven-day
window. There is no pagination guarantee or completeness claim. Same-organization,
same-title grouping is a display heuristic, not verified recurrence metadata.

## Local public-feed verification

October 19, 2026: all 315 tests, lint, the production build, and host smoke
checks passed. The local recommendations endpoint returned HTTP 200 with both
public calendars live, zero qualifying offers in the current seven-date window,
and zero sample listings. The homepage and personal-import page returned 200.
No CalNet prompt appeared in the public-feed HTML. This is a dated coverage
check, not an uptime or food-availability guarantee.

## Hosted public-feed verification

October 19, 2026: release `effc25e` was deployed to
[getyums.food](https://getyums.food) after CI and container checks passed.
Public HTTPS checks confirmed the updated interface, health response, login
HTML, packaged assets, and callback origin. Both public calendar sources
reported live status, with zero qualifying offers and no sample listings in
the current window. The private `/import` route returned 404. These checks
did not exercise signed-in saving or report submission.

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
