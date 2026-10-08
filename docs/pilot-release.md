# Berkeley invited pilot

The next release serves invited UC Berkeley users with real source data and
account persistence. This extends the completed local portfolio demo. No
hosting provider is configured yet. Supabase public connection settings are
configured locally; the remaining remote release gates below are unverified.

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

Local verification after these changes: 238 tests across 36 files, lint,
live-mode production build, and production dependency audit all pass. No
production dependency vulnerabilities were reported. Database migrations were
tested in local PostgreSQL; they have not been applied to the remote project.

Six deployment-configuration tests passed before Supabase connection.
`npm run check:pilot` now passes with the ignored local Supabase configuration.
The production server was started explicitly with live mode and invite mode;
these flags must also be configured in the eventual host environment.

`packages/database/pilot-audit.sql` now provides a read-only project-owner
inventory of RLS, policies, required columns/constraints/indexes, role grants,
privileged functions, and the profile-sync trigger. Local PostgreSQL tests
cover missing schema, a migrated schema, and deliberately weakened security
metadata, and verify that account values and tokens are not returned or
changed. The inventory is a review aid, not an automatic release approval.
It has not run against the remote Supabase project.

Source occurrence IDs now remain stable across reordered responses. Duplicate
source URL/start-time pairs and duplicate restaurant IDs collapse; distinct
recurring dates remain. Invalid coordinates cannot reach distance scoring or
map markers. Tests cover richer duplicate snapshots and repeated occurrences.

Live ingestion also requires a nonempty event title/organization, a parseable
start time, and a complete http/https source link without embedded credentials
or control characters. Invalid records are omitted. Berkeley relative links
resolve against its publisher origin. Cal Link records without usable event
IDs cannot produce fabricated links. Malformed source response envelopes fail
explicitly; a malformed Overpass mirror no longer masks another valid mirror.
Eight additional regression tests cover these boundaries.
The production API smoke check after this change retained 42 live listings,
including two food listings, with all discovery sources available and no
invalid source-link protocols. No optional account service was configured.

Reports now have application validation for a future start within seven days,
field lengths, and safe http/https links. Database constraints prevent clients
from bypassing content limits. A repeatable migration preserves legacy records
and blocks invalid legacy reports from approval until corrected.

Calendar credentials are stored only after an explicit connection request and
a successful Google availability probe. Ordinary Google sign-in does not
create a Calendar connection. Disconnect deletes only the current account's
stored connection; it does not revoke Google's external authorization grant.
Mocked tests cover consent boundaries, refresh errors, callback failures,
reconnect, scoped disconnect, sign-out failures, and private-view refreshes.

October 7 browser rehearsal against the live-mode production server verified
desktop onboarding with a $42 target and eight-minute walking preference,
feed preference propagation, saving a real source event, persistence after
reload, removal, empty search results, unavailable-map guidance, guest chat
using live event titles/times, and the
unconfigured invitation-only sign-in state. The
390-pixel mobile feed has no horizontal overflow. Screenshots are in
`docs/screenshots/pilot-mobile.jpg`. The current feed returned 40 nearby places
and two source listings for Cal-nival. Those listings have different source
URLs and start times; cross-source duplicates are not automatically merged.
No browser console errors were observed during this rehearsal.

Report submission now uses a keyboard-accessible form, verifies the current
account immediately before writing, and refreshes the feed after success.
Account changes clear the previous draft and discard obsolete Auth responses
or submission completions. Validation and unconfirmed writes show accessible
errors; failed removal restores the report and explains the failure. Ten
mocked form tests cover these behaviors. No real report has been submitted.
The package's default `ingestAll()` source list is now live-only; its sample
adapter remains available only through an explicit export. Two regression
tests verify that normal ingestion and source failures never invoke samples.

Existing email Auth accounts now receive missing application profiles through
the initial schema or a reviewed repeatable migration. Local PostgreSQL tests
verify legacy-account backfill, preserved existing profiles, future account
creation, and account isolation. This migration has not run remotely.
Onboarding waits for account preference restoration, discards obsolete reads
after account changes, verifies the current account again before saving, and
keeps the form/input visible when synchronization fails. Eight component
tests cover guest behavior, failure/retry, Auth failure, account changes, and
cleanup. A fresh production-browser check still reaches the dashboard with
the entered target and walk preference (`docs/screenshots/pilot-onboarding.jpg`).

Freshness uses two-minute event cache windows and ten-minute nearby-place
windows. Each new window requires a successful network fetch; old windows
cannot silently persist through an extended outage. Inner fetch caching is
disabled. Regression tests simulate expired caches followed by source failures
and recovery. These tests emulate argument-keyed persistence; they do not
exercise Next's cache implementation. Results within a window can still be
that old and do not guarantee that food remains available. Source failures
stay visible; no samples are substituted. Calendar response errors cannot
be mistaken for a free schedule.

Production API checks after the cache change returned 42 real source listings
with all discovery sources marked live. Two sequential requests with different
walk preferences took 6,225 ms and 11 ms, respectively, confirming shared
source cache reuse in the running Next server. This is one dated observation,
not a latency or uptime guarantee. Homepage and dashboard regression tests
verify that unavailable counts remain unknown and empty-source wording does
not claim offers are absent when both event sources are unreachable.

## Verification remaining before launch

October 7 connected-project check: the public key is accepted, and zero-row
queries confirm `users`, `user_preferences`, and saved-item `save_key`/`end_time`
columns are available. The user confirmed real sign-in and a saved listing in
the app. That confirms one account's observed save, not cross-device persistence
or isolation. The saved-item migration was applied by the project owner after
a missing-column error; its remote unique index and policies remain unaudited.
No account records were read in the public connection check.

The new `npm run check:supabase` reports remaining setup failures: public signup
is still enabled, `user_reported_events.moderation_status` is unavailable, and
`chat_usage` is absent from the public schema cache. Anonymous sign-ins are
disabled. Review the read-only SQL audit and existing-database migrations in
`pilot-setup.md` before changing the project. Report validation/profile triggers
also require that audit; a public zero-row query cannot prove their presence.
Five checker regression tests cover read-only/zero-row requests, invalid keys
and origins, missing migrations, permissive/unknown Auth settings, network
failure, and sanitized output. Eleven total configuration/checker tests pass.

| Requirement | Current evidence | Remaining verification |
| --- | --- | --- |
| Live discovery | Public sources and local production browser | Hosted smoke check and ongoing operator review |
| Account persistence and isolation | User-confirmed sign-in/save for one account; component mocks and local PostgreSQL policies | Sign-out/reload, preferences, two invited accounts and devices |
| Moderation and chat allowance | Local PostgreSQL migrations and regression tests | Apply reviewed migrations and check remote policies/allowance |
| Invitation-only access | Client flag and mocked sign-in tests | Disable remote sign-ups/anonymous access and verify email delivery |
| Calendar | Mocked consent, refresh, disconnect and outage tests | Real Google consent and refresh, if enabled |
| Deployment | Local production build and configuration checker | Choose host, configure HTTPS/redirects/environment, authorize publishing |

Still required: remaining project configuration and reviewed migrations, hosting setup,
real-account verification, Calendar consent/refresh checks if enabled, and
deployment authorization. The local safeguards alone do not prove launch readiness.
