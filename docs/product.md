# Product

AI savings agent for college students — answers "what's the cheapest and
easiest way for me to eat and live around campus this week?"

Full spec lives in the original handoff doc; this file tracks what's
actually built vs. planned. See `docs/architecture.md` for how it's built
and `docs/data-sources.md` for exactly what's live vs. reference-only, and
why for each.

## MVP scope (V1, UC Berkeley only)

- [x] Campus/budget/preferences/meal-plan onboarding form (`/start`),
      persisted to `localStorage` (real Supabase write path exists, not
      wired in yet — see `docs/architecture.md`)
- [x] Free food event discovery — **live**, from events.berkeley.edu's
      public calendar feed, with a documented mock fallback if that fetch
      fails. Powers `/`, `/dashboard`, `/feed`, and the chatbot.
- [x] Nearby eats — **live**, real cafes/restaurants near campus from
      OpenStreetMap. No live source exists anywhere for student-discount
      data, so this intentionally shows real places with no fabricated
      savings claim, replacing what used to be fake "student deals."
- [x] Grocery price comparison + optimizer (multi-store cheapest vs.
      single-store convenience tradeoff) — store *locations* are live
      (OpenStreetMap); per-item *prices* are a manually maintained
      reference, because no retailer publishes a live price API (confirmed
      gap, not a "haven't gotten to it yet")
- [x] Weekly recommendations feed (`/feed`), ranked by the scoring formula
- [x] Dashboard with today's free food + weekly budget projection (`/dashboard`)
- [x] Meal plan / dining dollars pacing — collected as direct user input
      (no API for a student's own balance could reasonably exist without
      their real campus login, which this app doesn't collect)
- [x] Floating chatbot assistant, deterministic answers grounded in the
      same live data (or documented fallback) as the rest of the app
- [x] Real distance/walking-time math from actual coordinates (haversine
      geometry + optional OSRM routing), replacing an earlier placeholder
      formula
- [ ] Map view (deferred — no Mapbox/Google Maps key wired up)
- [x] Schedule awareness — real Google Calendar FreeBusy check once a user
      connects via `/login`; flat placeholder otherwise (see
      `docs/architecture.md`'s "Schedule awareness" section). Wired but not
      verified against a live Google Cloud OAuth project in this session.
- [x] Auth — magic-link sign-in (`/login`, `/auth/callback`); `/start`
      switches to real Supabase-backed preference persistence for anyone
      signed in, `localStorage` otherwise. Wired but not verified against a
      live Supabase project in this session (none is configured).
- [ ] Agentic checkout (out of MVP scope per the original spec)
- [ ] Real student-discount data for nearby businesses — confirmed no live
      source exists (ASUC's site has no discount-card page at any URL
      checked, including its full page listing and REST search); still
      shown honestly as "nearby eats" with no savings claim, per
      `docs/data-sources.md`.

## What "live" means here

Every "live" item above hits a real, public, keyless API at request time —
verified working via `curl` in this session, not just assumed. Two things
worth knowing:

1. **Grocery per-item prices can't be live** — not a gap in effort, a
   confirmed absence of any public API from Target, Safeway, Berkeley
   Bowl, or Trader Joe's. See `docs/data-sources.md` for what it would
   take to close this (manual price sheet, retailer partnership, or
   scraping).
2. **OpenStreetMap/Overpass reachability was flaky from the dev machine
   this was built on** — Node's `fetch` intermittently couldn't reach it
   while `curl` on the same machine could, every time. Confirmed not a
   code bug (see `docs/data-sources.md`). The app degrades honestly when
   this happens (shows the real error, never fabricates a "deal") rather
   than hiding it.
