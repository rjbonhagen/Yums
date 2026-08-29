# Product

AI savings agent for college students — answers "what's the cheapest and
easiest way for me to find free food and eat cheap around campus this
week?" Scope is deliberately narrow: free food events and real nearby
eateries/restaurants. No grocery shopping, no meal-plan/dining-dollars
tracking — cut from V1 to keep the app focused on eateries and
restaurants specifically.

Full spec lives in the original handoff doc; this file tracks what's
actually built vs. planned. See `docs/architecture.md` for how it's built
and `docs/data-sources.md` for exactly what's live vs. reference-only, and
why for each.

## MVP scope (V1, UC Berkeley only)

- [x] Campus/budget/preferences onboarding form (`/start`), persisted to
      `localStorage` for anyone signed out, or to Supabase
      (`savePreferencesToSupabase`) for anyone signed in — see
      `docs/architecture.md`
- [x] Free food event discovery — **live**, from events.berkeley.edu's
      public calendar feed, with a documented mock fallback if that fetch
      fails. Powers `/`, `/dashboard`, `/feed`, and the chatbot.
- [x] Nearby eats — **live**, real cafes/restaurants near campus from
      OpenStreetMap. No live source exists anywhere for student-discount
      data, so this intentionally shows real places with no fabricated
      savings claim, replacing what used to be fake "student deals."
- [x] Weekly recommendations feed (`/feed`), ranked by the scoring formula
- [x] Dashboard with today's free food + weekly budget projection (`/dashboard`)
- [x] Floating chatbot assistant, deterministic answers grounded in the
      same live data (or documented fallback) as the rest of the app
- [x] Real distance/walking-time math from actual coordinates (haversine
      geometry + optional OSRM routing), replacing an earlier placeholder
      formula
- [x] Map view — List/Map toggle on `/feed` (`components/recommendations-view.tsx`,
      `components/feed-map.tsx`) plotting real coordinates already computed
      for free food and nearby eats. No fabricated locations — items
      without real coordinates are simply omitted from the map, disclosed
      via a count of how many. Requires `NEXT_PUBLIC_MAPBOX_TOKEN`; shows
      an honest "not configured" message in the Map tab without it, same
      as every other optional integration in this app.
- [x] Schedule awareness — real Google Calendar FreeBusy check once a user
      connects via `/login`; flat placeholder otherwise (see
      `docs/architecture.md`'s "Schedule awareness" section). Verified
      end-to-end this session: `calendar_connections` holds a real
      access/refresh token pair and `/feed` correctly shows the "live"
      ranking notice.
- [x] Auth — magic-link sign-in (`/login`, `/auth/callback`); `/start`
      switches to real Supabase-backed preference persistence for anyone
      signed in, `localStorage` otherwise. Verified end-to-end against the
      live Supabase project: a confirmed `auth.users` row exists with the
      `handle_new_auth_user` trigger correctly mirroring it into
      `public.users` and `public.user_preferences`.
- [ ] Agentic checkout (out of MVP scope per the original spec)
- [ ] Real student-discount data for nearby businesses — confirmed no live
      source exists (ASUC's site has no discount-card page at any URL
      checked, including its full page listing and REST search); still
      shown honestly as "nearby eats" with no savings claim, per
      `docs/data-sources.md`.

## What "live" means here

Every "live" item above hits a real, public, keyless API at request time —
verified working via `curl` in this session, not just assumed. One thing
worth knowing:

**OpenStreetMap/Overpass reachability was flaky from the dev machine
this was built on** — Node's `fetch` intermittently couldn't reach it
while `curl` on the same machine could, every time. Confirmed not a
code bug (see `docs/data-sources.md`). The app degrades honestly when
this happens (shows the real error, never fabricates a "deal") rather
than hiding it.
