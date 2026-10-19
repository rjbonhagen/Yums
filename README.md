# Yums

Find free food around UC Berkeley. Yums brings campus announcements and community
tips into one feed with event times, locations, and links to the original posts.

[Live site](https://getyums.food) · [Architecture](docs/architecture.md) · [Data sources](docs/data-sources.md)

![Yums homepage](docs/screenshots/home-live.png)

## Features

- Free-food offers from Berkeley Events and Graduate Division calendars.
- Date and source filters, plus search by event or location.
- Browser saves for guests and account saves across devices.
- Community submissions reviewed before publication.

Browsing works without an account. New accounts require an invitation.

## Tech stack

| Area | Technology |
| --- | --- |
| Website | Next.js, React, TypeScript, Tailwind CSS |
| Event discovery | Calendar adapters, food evidence extraction, caching, deduplication |
| Accounts and data | Supabase Auth, PostgreSQL, row-level security |
| Hosting | AWS EC2, ECR, Docker, Caddy HTTPS, CloudWatch, GitHub Actions |

## Run locally

Requires Node.js 22 and npm 10.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

To enable account saves and submissions, copy `apps/web/.env.example` to
`apps/web/.env.local` and configure the Supabase public settings. See
[setup instructions](docs/pilot-setup.md) for database and sign-in configuration.

## Checks

```sh
npm test
npm run lint
npm run build
```

## Documentation

- [Deployment](docs/ec2-pilot.md)
- [Security review](docs/security-review.md)

Check original announcements for attendance requirements and food availability.
