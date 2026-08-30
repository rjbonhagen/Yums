# Roadmap

Where this project is, what's actually broken or misleading right now,
and what a sensible build order looks like from here. Every item below is
based on reading the current code, not a guess — see the file references.
`docs/product.md` tracks what's *built*; this file tracks what's *next*.

## Phase 0 — Foundation (done)

- Auth: magic-link + Google OAuth sign-in, Google Calendar linking for
  schedule-awareness (`/login`)
- Live data: free food events (events.berkeley.edu + Cal Link), real
  nearby eateries (OpenStreetMap) — see `docs/data-sources.md`
- Scoring/ranking feed (`/feed`), dashboard (`/dashboard`)
- Map view (Mapbox), real distance/walking-time math
- Chatbot: LLM-first (OpenAI, grounded in live data) with a
  deterministic fallback
- Test coverage for scoring, geo, event-mapping, and formatting logic

## Phase 1 — Fix what's broken or misleading (done)

Nothing new here — just making the existing surface honest and complete
before building on top of it.

1. [x] **Event dates were missing where they matter.** Berkeley's
   calendar feed only returns today's events, but Cal Link has no upper
   bound and can return events days/weeks out — a club event next
   Tuesday showed identically to one tonight. Fixed:
   `lib/format.ts`'s `formatEventDateTime()` now shows the date whenever
   an event isn't today, used by `recommendations-view.tsx` and
   `dashboard/page.tsx`.
2. [x] **Dietary preferences were advertised but didn't exist.** The
   homepage claimed "budget, dietary needs, transportation..." with no
   backing field or real scoring anywhere. Removed the false claim
   rather than build fake matching against free-text event descriptions
   / sparse OSM tags — consistent with this app's no-fabrication
   standard rather than a compromise of it.
3. [x] **No empty state on `/feed`.** Fixed — the list view now shows
   "Nothing found right now" (zero results) or "Nothing matches your
   filter/search" (filtered to zero) instead of rendering blank.
4. [x] **Dead code / misleading comments cleaned up.**
   `/api/events/live/route.ts`'s comment falsely claiming
   `/api/recommendations` "stays on mock data" is fixed; both routes are
   kept as a documented public JSON API surface (not deleted — they're
   correct, just unused by the current web UI).
5. [x] **`/login` is now reachable from nav** even when Supabase isn't
   configured — `AuthStatus` still renders the "Sign in" link in that
   state instead of returning `null`.

## Phase 2 — Round out the core experience (done)

6. [x] **Filter/search on `/feed`.** `RecommendationsView` now has an
   All/Free food/Nearby eats filter plus keyword search over
   title/subtitle, computed client-side over the already-fetched
   recommendations.
7. [x] **Component-level test coverage.** Added
   `@testing-library/react` + jsdom; `RecommendationsView` and
   `AuthStatus` now have real component tests (filter/search/empty
   states, all three auth-config states).
8. [x] **Real LLM chat path.** `answerWithLLM()` in `chatbot.ts` calls
   OpenAI directly once `OPENAI_API_KEY` is set, grounded in the same
   live `buildRecommendations()` data and instructed never to invent
   facts; `/api/chat/route.ts` falls back to the deterministic path on
   any failure. Not yet verified against a live OpenAI key in this
   session (none is configured) — code path and fallback are tested,
   the actual API call is not.

## Phase 3 — New capabilities

9. **Recurring-event awareness.** Weekly club meetings currently show as
   a flat list of upcoming instances rather than being recognized as
   recurring — worth grouping/deduping intelligently once Cal Link
   volume grows.
10. [x] **Notifications/reminders.** Done, with an honest scope limit:
    `NotificationToggle` schedules a real browser `Notification` ~20 min
    before each upcoming free-food event's actual `startTime`, via
    `setTimeout` while `/feed` stays open. This is explicitly **not**
    push notifications — there's no service worker or backend
    subscription (that would need VAPID keys and a subscriptions table
    this app doesn't have) — so closing the tab cancels pending
    reminders, and the UI says so rather than implying background
    delivery. Gracefully renders nothing when the browser doesn't
    support the Notification API, and shows a real "blocked" message
    when permission is denied rather than silently failing.
11. [x] **Save/favorite places or events** for a signed-in user. Done:
    ☆/★ Save toggle on every `/feed` card, a `/saved` page with a
    working Remove action, persisted to the `recommendations` table
    (repurposed for this — see its comment in `schema.sql` — rather than
    a new table, since it already had the right shape). Matches by
    `kind::title::sourceUrl` since recommendation ids aren't stable
    across requests. Verified end-to-end against the live Supabase
    project (insert, list, delete all confirmed via direct SQL).
12. **Crowdsourced event reporting** — let students report free food
    they find that isn't on either live feed, with the same
    no-fabrication discipline the rest of the app holds (clearly labeled
    as user-submitted, not verified).

## Phase 4 — Beyond a single-campus demo

Only worth pursuing if this outgrows "student project for one campus."
Deliberately not started — see reasoning below.

13. **Multi-campus support** — `/start` already has a disabled
    "University: UC Berkeley — More campuses coming soon" field
    (`start/page.tsx:150-152`); the schema (`universities` table) already
    supports it, nothing else does yet.
14. **Deployment/CI, error monitoring** — not worth the overhead while
    this stays a local/dev project.

## Status

Phases 0–2 are complete and verified (tests passing, changes checked
live in the browser). Phase 3 items are each a real feature build (new
DB tables, new UI flows) rather than a bugfix — tackle them one at a
time based on which is actually wanted next, rather than building all
four speculatively. Phase 4 is intentionally not started: both items
are explicitly conditional on the project outgrowing a single-campus
student demo, which hasn't happened, and multi-campus support in
particular would require real per-campus event/place sources to be
worth anything (no fabricated "coming soon" campuses).
