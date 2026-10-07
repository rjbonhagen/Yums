# Berkeley invited pilot

The next release serves invited UC Berkeley users with real source data and
account persistence. This extends the completed local portfolio demo. No
hosting provider is configured yet; an existing Supabase project is available
but its identifier and configuration have not been verified.

## Release requirements

- Live feeds enabled at build and runtime; no sample offers for pilot users.
- Weekly source coverage, pagination, descriptions, venues, and ongoing events
  verified against public sources and regression tests.
- Supabase project schema and existing migrations reviewed before application.
- Two real invited test accounts verify onboarding, synchronized preferences,
  saves/removal, sign-out, and isolation across devices.
- Invitation-only sign-up configured in Supabase; source browsing may remain
  public, while account creation is controlled by invitations.
- Community reports require database-enforced moderation before shared display;
  report authors cannot approve their own posts. Existing functionality remains
  available through a reviewed submission workflow.
- Paid chat receives persistent per-user usage controls before provider use;
  deterministic answers remain available when the provider is unavailable.
- Calendar connection, refresh, and disconnect verified with consent, or clearly
  marked unavailable until configured. Token access reviewed separately from
  ordinary profile data.
- Hosting environment, auth redirect URLs, HTTPS, production smoke checks,
  logging without secrets, and recovery instructions prepared and verified.
- Public deployment requires explicit authorization after the release is
  concrete and reviewable. No remote database mutation or publishing yet.

## Progress

October 7: found and corrected ignored Berkeley query parameters; added proper
date-window pagination and description/location fields. Cal Link now includes
recently started events. Live-mode production checks returned live status for
all three discovery sources: one qualifying food offer and 40 nearby places.

Community submissions now enter pending review; only approved records are
shared, authors see their own pending/rejected records, and approved content
cannot be changed by its author. A repeatable migration covers existing reports.
Database tests verify visibility, denied self-approval, and approved-content
protection. Approval is a manual pilot-operator task in the Supabase SQL editor.

Paid chat now requires verified authentication and a persistent database
allowance: 20 provider attempts per UTC day and five seconds between attempts.
Guests, exhausted accounts, and database failures receive deterministic replies.
Usage counts failed provider attempts as well as successful replies.

Invitation-mode sign-in avoids creating new accounts through magic links;
Supabase's global new-signup switch must also be disabled by the project owner.
See [pilot setup](pilot-setup.md) for configuration and operator steps.

Local verification after these changes: 156 tests across 23 files, lint,
live-mode production build, and production dependency audit all pass. No
production dependency vulnerabilities were reported. Database migrations were
tested in local PostgreSQL; they have not been applied to the remote project.

Still required: project configuration and migration application, hosting setup,
real-account verification, Calendar consent/refresh checks if enabled, and
deployment authorization. The local safeguards alone do not prove launch readiness.
