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
- Deterministic scoring/ranking feed (`/feed`), dashboard (`/dashboard`)
- Map view (Mapbox), real distance/walking-time math
- Deterministic chatbot grounded in the same live data
- Test coverage for scoring, geo, and event-mapping logic (43 tests)

## Phase 1 — Fix what's broken or misleading

Nothing new here — just making the existing surface honest and complete
before building on top of it.

1. **Event dates are missing where they matter.** Berkeley's calendar
   feed only returns today's events (`?days=1`,
   `services/event-ingestion/sources/berkeley-live.ts:13`), but Cal Link
   has no upper bound (`callink-live.ts:53-58`) and can return events
   days or weeks out. Both `formatTime()` implementations
   (`recommendations-view.tsx:9`, `dashboard/page.tsx:14`) render only
   the time — a club event next Tuesday shows identically to one
   tonight. Fix: show the date whenever an event isn't today.
2. **Dietary preferences are advertised but don't exist.** The homepage
   says "Tell it your week: Budget, dietary needs, transportation..."
   (`page.tsx:27`), but there's no dietary-preference field anywhere in
   `/start`, and `preferenceScore` — the scoring input dietary fit would
   feed into — is a hardcoded flat `0.6`/`0.5` in both places it's used
   (`recommendations.ts:187,217`), never computed from real data.
   Either build the field + real scoring, or stop claiming it.
3. **No empty state on `/feed`.** If every live source fails or returns
   nothing, the List tab silently renders blank
   (`recommendations-view.tsx:61-65`) — no "nothing found right now"
   message. Dashboard already handles this correctly for free food
   (`dashboard/page.tsx:58-60`); feed doesn't.
4. **Dead code cleanup.** `/api/recommendations` and `/api/events/live`
   are unused by any client code — `/feed`/`/dashboard` call
   `buildRecommendations()` directly. One route's comment falsely claims
   `/api/recommendations` "stays on mock data" (it doesn't).
   `answerWithLLM` (`chatbot.ts`) is fully unreferenced dead code, not
   just "not wired yet."
5. **`/login` is unreachable from nav** when Supabase isn't configured
   (`AuthStatus` returns `null` in that state) — only affects an
   unconfigured deployment, not the current one, but worth a fallback
   link.

## Phase 2 — Round out the core experience

6. **Filter/search on `/feed`.** Currently one undifferentiated ranked
   list (List/Map toggle only) — add a free-food-only / nearby-eats-only
   filter, and keyword search.
7. **Component-level test coverage.** All 43 existing tests cover
   scoring/geo/mapping logic in `lib/`; zero tests exercise the actual
   React components or pages.
8. **Real LLM chat path**, once `OPENAI_API_KEY` is configured — replace
   or augment `answerDeterministically()`'s keyword matching with actual
   open-ended question handling (the original spec's "feed me for a week
   for $50" case), while keeping deterministic answers as the fallback.

## Phase 3 — New capabilities

9. **Recurring-event awareness.** Weekly club meetings currently show as
   a flat list of upcoming instances rather than being recognized as
   recurring — worth grouping/deduping intelligently once Cal Link
   volume grows.
10. **Notifications/reminders** — e.g. "free food starting in 20 min
    near you," building on the schedule-awareness work already in place.
11. **Save/favorite places or events** for a signed-in user.
12. **Crowdsourced event reporting** — let students report free food
    they find that isn't on either live feed, with the same
    no-fabrication discipline the rest of the app holds (clearly labeled
    as user-submitted, not verified).

## Phase 4 — Beyond a single-campus demo

Only worth pursuing if this outgrows "student project for one campus."

13. **Multi-campus support** — `/start` already has a disabled
    "University: UC Berkeley — More campuses coming soon" field
    (`start/page.tsx:174-177`); the schema (`universities` table) already
    supports it, nothing else does yet.
14. **Deployment/CI, error monitoring** — not worth the overhead while
    this stays a local/dev project.

## Suggested near-term order

Phase 1 items are all small, concrete, and prevent the app from
misleading a user (fake feature claim, wrong-looking dates, silent blank
states) — worth clearing before Phase 2/3 adds anything new on top of a
shaky foundation. Within Phase 1, start with #1 (dates) since it's
already confirmed and scoped.
