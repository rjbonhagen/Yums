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

## Phase 3 — New capabilities (done)

9. [x] **Recurring-event awareness.** Done, conservatively: Cal Link's
   API has no recurrence metadata at all (confirmed by reading
   `callink-live.ts` — no series/recurring id field exists), so this
   deliberately does **not** use fuzzy title matching, which risks
   merging unrelated events. Instead, `Recommendation.seriesKey`
   (`${organization}::${original event title}`, set in
   `recommendations.ts`) is an exact-match-only key computed from the
   *original* title — not the transformed display title ("Free pizza"),
   which two unrelated events could both end up with. `/feed`'s List
   view groups 2+ items sharing a seriesKey into one card listing every
   upcoming instance, each keeping its own Save button and Source link;
   a lone item never gets grouped. Map view and per-item save/search
   are unaffected — grouping is purely a List-view display choice.
   Covered by a dedicated `recommendations.test.ts` case (confirms
   seriesKey uses the original title) and three `recommendations-view`
   component tests (groups real duplicates, doesn't group a lone item,
   never merges same-display-title-different-series items).
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
12. [x] **Crowdsourced event reporting.** Done: `/report` lets a
    signed-in student submit free food they found that isn't on either
    live feed; shown on `/feed` in its own "Community reports" section
    with an explicit "Unverified — user-submitted" badge — a deliberate
    design choice to keep it out of `buildRecommendations()`'s
    scored/ranked list entirely, never blended with the live sources
    (see the comment on `user_reported_events` in `schema.sql`). Public
    read (no sign-in needed to see reports, matching the rest of the
    app), reports scoped to their author for delete. Verified
    end-to-end against the live Supabase project: submitted a real
    report, confirmed it via SQL, removed it, confirmed the row was
    actually gone.

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

Phases 0–3 are complete and verified: 98 tests passing (up from 43 at
the start of this work), `tsc --noEmit` clean, and every feature checked
live — either in the browser directly, or end-to-end against the live
Supabase project (insert → confirm via SQL → delete → confirm gone) for
anything involving persistence. One thing genuinely NOT verified: the
real OpenAI API call in `answerWithLLM()`, since no `OPENAI_API_KEY` is
configured in this environment — its request-building/grounding logic
and the fallback-to-deterministic wiring are both covered by
mocked-fetch tests instead.

Phase 4 is intentionally not started: both items are explicitly
conditional on the project outgrowing a single-campus student demo,
which hasn't happened, and multi-campus support in particular would
require real per-campus event/place sources to be worth anything (no
fabricated "coming soon" campuses).

GrubHub was considered as a Phase 3 candidate and explicitly dropped:
no public discount API exists, and scraping it would violate its ToS —
declined for the same reason this app already rules out scraping
Instagram for free-food posts (see `docs/data-sources.md`), regardless
of this being a non-commercial student project.
