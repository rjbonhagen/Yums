# Yums

Find free food around UC Berkeley. Yums brings campus announcements and community
tips into one feed with event times, locations, and links to the original posts.

[Live site](https://getyums.food)

![Yums homepage](.github/images/homepage.png)

## Features

- Free-food offers from Berkeley Events and Graduate Division calendars.
- Date and source filters, plus search by event or location.
- Browser saves for guests and account saves across devices.
- Community submissions reviewed before publication.

Browsing works without an account. New accounts require an invitation.

## Architecture

```text
Yums
├── apps/web                 Next.js + React interface and API
├── services/event-ingestion Campus calendar adapters
├── packages
│   ├── database             Supabase schema and migrations
│   └── shared               Types and ranking helpers
├── infra                    EC2 and HTTPS setup
└── .github/workflows        Tests and container releases
```

## Run locally

Requires Node.js 22 and npm 10.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

To enable account saves and submissions, copy `apps/web/.env.example` to
`apps/web/.env.local` and configure the Supabase public settings. Database schema
and migrations are in `packages/database/`.

## Checks

```sh
npm test
npm run lint
npm run build
```

Check original announcements for attendance requirements and food availability.
