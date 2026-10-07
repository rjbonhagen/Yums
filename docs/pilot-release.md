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

Local verification after these changes: 198 tests across 29 files, lint,
live-mode production build, and production dependency audit all pass. No
production dependency vulnerabilities were reported. Database migrations were
tested in local PostgreSQL; they have not been applied to the remote project.

Six additional deployment-configuration tests pass. `npm run check:pilot`
currently fails as expected: no local Supabase environment is configured.
The production server was started explicitly with live mode and invite mode;
these flags must also be configured in the eventual host environment.

Source occurrence IDs now remain stable across reordered responses. Duplicate
source URL/start-time pairs and duplicate restaurant IDs collapse; distinct
recurring dates remain. Invalid coordinates cannot reach distance scoring or
map markers. Tests cover richer duplicate snapshots and repeated occurrences.

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

Freshness uses two-minute outer event caches, with a five-minute Berkeley
source fetch cache and two-minute Cal Link fetch cache. Nearby places refresh
on a ten-minute cache. These are request-triggered refresh intervals, not a
guarantee of real-time availability. Source failures stay visible; no samples
are substituted. Calendar response errors cannot be mistaken for a free
schedule.

## Verification remaining before launch

| Requirement | Current evidence | Remaining verification |
| --- | --- | --- |
| Live discovery | Public sources and local production browser | Hosted smoke check and ongoing operator review |
| Account persistence and isolation | Component mocks and local PostgreSQL policies | Two invited accounts on the actual Supabase project, across devices |
| Moderation and chat allowance | Local PostgreSQL migrations and regression tests | Apply reviewed migrations and check remote policies/allowance |
| Invitation-only access | Client flag and mocked sign-in tests | Disable remote sign-ups/anonymous access and verify email delivery |
| Calendar | Mocked consent, refresh, disconnect and outage tests | Real Google consent and refresh, if enabled |
| Deployment | Local production build and configuration checker | Choose host, configure HTTPS/redirects/environment, authorize publishing |

Still required: project configuration and migration application, hosting setup,
real-account verification, Calendar consent/refresh checks if enabled, and
deployment authorization. The local safeguards alone do not prove launch readiness.
