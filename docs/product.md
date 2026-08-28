# Product

AI savings agent for college students — answers "what's the cheapest and
easiest way for me to eat and live around campus this week?"

Full spec lives in the original handoff doc; this file tracks what's
actually built vs. planned. See `docs/architecture.md` for how it's built
and `docs/data-sources.md` for what's live vs. mocked.

## MVP scope (V1, UC Berkeley only)

- [x] Campus/budget/preferences onboarding form (`/start`), preferences
      persisted to `localStorage` (real Supabase write path exists, not
      wired in yet — see `docs/architecture.md`)
- [x] Free food event discovery — **mocked** for `/dashboard` +
      `/api/recommendations`; **partially live** via `/api/events/live` and
      the `/feed` page, pulling real titles/times from
      events.berkeley.edu's public calendar feed (no location/description
      available from that feed — see `docs/data-sources.md`)
- [x] Nearby student deals — **mocked** (3 deals)
- [x] Grocery price comparison + optimizer (multi-store cheapest vs.
      single-store convenience tradeoff) — **mocked** catalog
- [x] Weekly recommendations feed (`/feed`), ranked by the scoring formula
- [x] Dashboard with today's free food + weekly budget projection (`/dashboard`)
- [x] Meal plan / dining dollars pacing alert
- [x] Floating chatbot assistant, deterministic answers grounded in mock data
- [ ] Map view (deferred — no Mapbox/Google Maps key wired up)
- [ ] Schedule awareness (deferred — no Google Calendar integration)
- [ ] Auth (deferred — no login flow; Supabase schema + write functions
      exist and are ready to use once one is added)
- [ ] Agentic checkout (out of MVP scope per the original spec)
