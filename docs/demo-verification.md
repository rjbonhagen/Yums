# Demo verification

Verified October 7, 2026 on Windows.
Delivery is a reproducible local Berkeley portfolio demo; no public deployment,
GitHub push, or remote database migration was performed.

## Reproducible checks

Fresh `npm ci` succeeded. With `YUMS_DEMO_MODE=true`, `npm test` passed
145 tests across 21 files, `npm run lint` passed, and `npm run build` passed
including TypeScript and all page generation. `npm audit --omit=dev` reported
zero vulnerabilities. Nine high-severity transitive development-tooling findings
remain; incompatible forced downgrades were not applied.

The final checks were repeated after the last code commit. A restricted Windows
sandbox initially prevented temporary-file renames and Next.js path resolution;
the same commands passed with approved local execution access. These were
environment failures before tests could execute, not failed assertions.

## Browser rehearsal

The production sample build was exercised at localhost:3000, with desktop
1280 × 900 and mobile 390 × 844 viewports. Screenshots were inspected visually.

| Journey | Observed result |
| --- | --- |
| Onboarding → dashboard → feed | Budget $42 and preferred walk 8 minutes persisted across navigation and reload; Shorter walks applied. A second keyboard submission used $45 / 6 minutes and updated the dashboard. |
| Keyboard submission | Tab from the final onboarding input focused Build My Week; Enter submitted and navigated to the dashboard. |
| Filters and search | Free food / Nearby eats changed the list; an unmatched query showed an empty state. |
| Save → Saved → reload → remove | A sample event survived reload with its sample label; removal returned the empty state. Repeated on the final production build. |
| Map without token | Explained that the map was unavailable without breaking the list. |
| Chat without provider key | Deterministic responses kept sample offers explicitly labeled. |
| Sign-in without Supabase | Explained that account sign-in was unconfigured and preferences remain in the browser. |
| Community reports without Supabase | Feed showed unavailable status rather than an apparently successful empty result. |
| Mobile feed | Navigation wrapped, controls and cards remained readable; document width did not exceed viewport width. |

Sample events use relative current times so the walkthrough remains available
on future dates. They are synthetic examples and must not be presented as real
campus offers. Samples do not generate food reminders.

## Live sources and optional integrations

A separate local live-mode production feed returned a real Cal Link event,
Cal-nival on October 9 at noon, and OpenStreetMap restaurant listings with source
links. No sample records were substituted. Overpass timed out on the first
request and recovered later; source availability is not guaranteed.

Supabase sign-in, real account synchronization, Google consent/Calendar,
Mapbox rendering, and provider-backed chat were not live-verified because their
credentials were absent. Tests exercise configured paths and failure handling
with mocked service responses. Those tests do not establish that external
account configuration is correct.

Database tests execute the schema in local PostgreSQL through PGlite, with a
Supabase-compatible auth contract supplied by the harness. They verify account
isolation for saves/preferences/Calendar tokens, report ownership, repeated
upsert uniqueness, and an existing-database migration that retains the latest
duplicate and can run again. They do not verify a remote Supabase deployment.

## Portfolio walkthrough

Follow the seven steps in the README. Allow about five minutes. Start in sample
mode so network availability cannot interrupt the presentation. Explain the
explicit food-evidence rule, Pacific date window, preference ranking, local
saves, and source-status handling. Use the live screenshot to illustrate the
source-backed view, with the dated availability caveat above.

## Before public access

Add service-level paid-chat rate/usage controls and a report moderation workflow
before inviting public users. Request/history size bounds are already enforced
but are not a rate limit. Apply the save migration and verify real account
isolation and credential-backed services against the intended deployment.
Public hosting and these public-access gates remain outside this local delivery.

## Screenshots

- [Desktop sample feed](screenshots/feed-desktop.jpg)
- [Mobile sample feed](screenshots/feed-mobile.jpg)
- [Sample homepage](screenshots/home-desktop.jpg)
- [Live feed observed October 7](screenshots/feed-live.jpg)
