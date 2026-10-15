# Yums

Free food at UC Berkeley, collected in one feed from campus calendars and
community tips. See when an event happens, where to go, and the original
announcement before heading out.

## Features

- **One food feed:** Berkeley calendar and Cal Link events with explicit food
  offers, shown in time order.
- **Simple filters:** this week, today, tomorrow, and search by name or location.
- **Saved food:** save in the browser without an account, or sign in to sync new
  saves across devices.
- **Community reports:** signed-in users can share opportunities for operator
  review before they appear publicly.
- **Source transparency:** original announcement links, visible source outages,
  and clearly labeled sample data.

The interface focuses on free food. It does not include a week planner, budget
setup, restaurant browsing, maps, chat, or Calendar connection prompts. Old
`/start` and `/dashboard` links lead to the feed.

## Status

The invited pilot is hosted at [getyums.food](https://getyums.food). The simplified
interface is being verified locally before its next release. Public discovery
works without signing in; new accounts require an invitation.

Ed Discussion is a proposed source, not an implemented integration. Its board
access, audience, and permitted event-sharing workflow need to be established.

## Run locally

Requires Node.js 22 and npm 10. From the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Public food discovery and browser
saves work without credentials. External source outages are disclosed rather
than filled with fabricated offers.

For account saves and submissions, copy `apps/web/.env.example` to
`apps/web/.env.local` and configure your Supabase project URL and public client
key. Google sign-in uses the provider configured in Supabase; ordinary sign-in
does not request Calendar access. See [pilot setup](docs/pilot-setup.md) for
database and account configuration. Never commit local environment files.

For an offline preview, set `YUMS_DEMO_MODE=true` locally and restart. Sample
events stay labeled. Restore `false` for live data; production mode changes
require a rebuild.

## Verify

```sh
npm test
npm run test:pilot-config
npm run lint
npm run build
npm run start
```

With the production server running, `npm run check:host` checks health, login
HTML, packaged assets, and callback origin. Signed-in acceptance checks must also
cover account isolation, saving, and report submission.

## Architecture

| Area | Implementation |
| --- | --- |
| Website | Next.js, React, TypeScript, Tailwind CSS |
| Event discovery | Campus-source adapters, food evidence extraction, shared source caching |
| Accounts and data | Supabase Auth and PostgreSQL with row-level security |
| Hosting | Docker, AWS EC2, ECR, Caddy HTTPS, CloudWatch, GitHub Actions |

The public food feed skips restaurant lookups and Calendar requests. Source
results are normalized, duplicate listings are collapsed, and expired events
are removed from the visible list. Saved items retain a snapshot of the event.
Existing experimental backend helpers and tables remain for compatibility;
they do not add steps to the current interface.

See [product scope](docs/product.md), [data sources](docs/data-sources.md), and
[EC2 deployment](docs/ec2-pilot.md).

## Limits

Coverage is limited to available sources around UC Berkeley. A food announcement
does not establish eligibility or remaining supplies; check the original post.
Community reports are user submitted and are labeled accordingly. The pilot
runs on one server and does not provide high availability.
