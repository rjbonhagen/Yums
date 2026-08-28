# Product

AI savings agent for college students — answers "what's the cheapest and
easiest way for me to eat and live around campus this week?"

Full spec lives in the original handoff doc; this file tracks what's
actually built vs. planned. See `docs/architecture.md` for how it's built
and `docs/data-sources.md` for what's live vs. mocked.

## MVP scope (V1, UC Berkeley only)

- [x] Campus/budget/preferences onboarding form (`/`)
- [x] Free food event discovery — **mocked** (3 Berkeley events)
- [x] Nearby student deals — **mocked** (3 deals)
- [x] Grocery price comparison + optimizer (multi-store cheapest vs.
      single-store convenience tradeoff) — **mocked** catalog
- [x] Weekly recommendations feed (`/feed`), ranked by the scoring formula
- [x] Dashboard with today's free food + weekly budget projection (`/dashboard`)
- [x] Meal plan / dining dollars pacing alert
- [ ] Map view (deferred — no Mapbox/Google Maps key wired up)
- [ ] Schedule awareness (deferred — no Google Calendar integration)
- [ ] Auth / persistence (deferred — Supabase schema exists, client not wired
      into pages yet; everything currently reads from
      `apps/web/src/lib/mock-data.ts`)
- [ ] Agentic checkout (out of MVP scope per the original spec)
