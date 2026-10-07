# Yums

A UC Berkeley food-discovery demo: find campus events offering free food,
browse nearby restaurants, and rank recommendations for free food or shorter
walks. Prices, nutrition, attendance, and actual savings are not tracked.

An invited Berkeley pilot is being prepared with live feeds, account persistence,
reviewed community submissions, and per-account paid-chat limits. See
[pilot setup](docs/pilot-setup.md) and [release status](docs/pilot-release.md).
Remote account configuration and deployment have not yet been verified.

![Desktop feed](docs/screenshots/feed-desktop.jpg)

More screenshots: [mobile feed](docs/screenshots/feed-mobile.jpg),
[homepage](docs/screenshots/home-desktop.jpg), [live feed](docs/screenshots/feed-live.jpg).

## Run locally

Requires Node.js 22 and npm 10. From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No credentials are needed for public feeds,
preferences, browser-local saves, or the deterministic chat helper. Public
sources can return no matching events or be unavailable; failures are disclosed
and never replaced by sample offers.

For a reproducible offline demo, copy `apps/web/.env.example` to
`apps/web/.env.local` and set `YUMS_DEMO_MODE=true`, then restart the server.
Sample events and restaurant listings are visibly labeled. Sample saves stay
in the browser even if an account is connected. Set the flag to `false` to
restore live sources. Sample mode does not call the external discovery feeds.

For a production build, set the same demo flag before both build and start:

```sh
npm run build
npm run start
```

The homepage is cached; changing modes requires a rebuild for production.

## Demo walkthrough

1. Open Build My Week, set a $42 budget target and an eight-minute preferred walk.
2. Choose Shorter walks, submit, and inspect the dashboard.
3. Open Feed; reload to show the preferences survived direct navigation.
4. Filter Free food or Nearby eats, search a venue, and try an unmatched query.
5. Save an item, visit Saved, reload, and remove it.
6. Open Map to show the graceful unavailable state without a token.
7. Ask Yums “What's free this week?” Sample results remain explicitly labeled.

See [the rehearsal record](docs/demo-verification.md) for checks and limits.

## Verification

```sh
npm test
npm run lint
npm run build
npm audit --omit=dev
```

The included GitHub Actions workflow will run install, lint, tests, build, and
the production dependency audit after pushing; it has not run remotely yet.
The local production audit is clean. Development tooling still has
nine high-severity transitive `braces` findings; npm suggests incompatible
downgrades. Do not run `npm audit fix --force` without reviewing its changes.

## Optional integrations

- Supabase: account sign-in, synchronized preferences and saves, community reports.
- Google Calendar: optional conflict-aware ranking after consent.
- Mapbox: plotted source coordinates when a public token is provided.
- OpenAI: grounded chat replies with a deterministic fallback.

All variables are listed in [the environment example](apps/web/.env.example).
For a new Supabase project, run `packages/database/schema.sql` through the SQL
editor. For an existing database, apply
`packages/database/migrations/20261007_saved_identity.sql` before using updated
cloud saves. It preserves the newest duplicate snapshot and adds per-user
uniqueness. No remote database changes were made during this work.

For the invited pilot, also apply the report moderation and chat allowance
migrations described in [pilot setup](docs/pilot-setup.md). New databases need
the initial schema plus the chat allowance migration. Existing reports enter
pending review; only approved reports are shared. Paid provider replies require
a verified account and a database allowance; failures use deterministic replies.

Configure Supabase site URL and auth redirect URL for your localhost address
(`/auth/callback`). Google sign-in requires the Google provider in Supabase;
Calendar linking also requires the FreeBusy scope and the app's Google OAuth
client credentials for token refresh. Never commit `.env.local` or secret keys.

## Architecture and limitations

Next.js pages → cached campus-source adapters / OpenStreetMap → deterministic
food-evidence extraction → date window and scoring → feed, dashboard, and chat.
Preferences use a validated browser cookie and optional account persistence;
local saves use localStorage, while account saves use Supabase row-level security.

- Berkeley only; walking estimates start at campus center, not device location.
- Today and weekly views use Pacific Time; missing durations assume one hour.
- Food detection is conservative. An explicit offer can still be canceled or
  limited to eligible attendees; always inspect the original event details.
- Restaurant listings have no verified menu prices, discounts, or nutrition.
- Browser reminders require an open feed tab; there is no background push.
- Optional credential-backed integrations were not live-verified in this checkout.
- Remote migrations, invited-account checks, email delivery, host traffic limits,
  and provider spend limits must be verified before accepting pilot users.

See [architecture](docs/architecture.md), [sources](docs/data-sources.md),
[product scope](docs/product.md), and [roadmap](docs/roadmap.md).
