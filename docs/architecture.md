# Architecture

## Packages and data flow

`apps/web`: Next.js frontend and API routes.
`services/event-ingestion`: public Berkeley Events and Graduate Division
adapters, a separate personal Cal Link calendar parser, and food-evidence extraction.
`packages/shared`: types and deterministic scoring.
`packages/database`: Supabase schema and an existing-database save migration.

Public source adapters → conservative food extraction → normalized event
windows → deterministic scoring → food feed. The compatibility helpers use
the same recommendation results.
`buildRecommendations()` returns recommendations and source status. Source
fetches run concurrently and are cached independently: event feeds for two
minutes, restaurant listings for ten minutes. Per-user Calendar data is never
stored in these shared source caches. Cache keys include the time window;
each new window needs a successful network response. Inner source fetches
use no-store so a refresh cannot retain an older cached response during an
extended outage. Results can be up to one window old; they do not prove that
food is still available. The homepage is cached; preference-aware
feed/dashboard pages read cookies and render per request.

Public discovery does not query Cal Link or share a CalNet session. Each public
calendar refreshes independently on demand within two-minute cache windows.
Exact reposts can collapse in the feed when title, physical venue, real start
and end times, and organizer evidence agree. Distinct organizers or conflicting
coordinates remain separate. Publisher filters run before duplicate collapse,
and an existing saved source is preferred without changing its save identity.

## Evidence and timing

Generic food mentions are omitted. Explicit free/complimentary offers or an
exact organizer Free Food benefit can qualify. Paid, negated, dietary, and
food-discussion wording is conservatively excluded. This is a heuristic, not
proof of attendance eligibility, availability, or a complete meal.

Berkeley's Today uses America/Los_Angeles. Weekly discovery covers today and
the next six campus dates, excludes ended events, and retains ongoing events.
Real source end times inform Calendar overlap; missing/invalid durations use
a disclosed one-hour assumption. Distances are haversine walking estimates
from campus center, not the device's location. Budget is a target, not a
spending projection; discovery recommendations have zero estimated savings.

## Preferences and saves

Supported settings are normalized: budget $0–$1,000, walking time 1–120 minutes,
and free-food-first or shorter-walks ranking. Guest settings use localStorage
and a non-sensitive SameSite cookie so server pages can read them on direct
visits. Signed-in preferences take precedence; a validated browser copy is
the fallback when account synchronization is unavailable. Form URL overrides
are validated too.

Guest saves use localStorage and stable source/date identities. Sample items
always stay in browser storage and retain their labels. Real signed-in saves
use Supabase snapshots with per-user save-key uniqueness and idempotent upsert.
Existing databases need the dated migration before using this path; it has
not been applied to a remote database during this work. RLS scopes preferences,
saves, and Calendar tokens to each user's auth UID. Community reports are
separate unverified records: approved reports are public, while pending and
rejected reports are author-only. Authors cannot self-approve or edit approved
content; a pilot operator reviews reports through the privileged SQL editor.

## Optional services and limits

Without provider credentials the app still runs: map/auth/report views explain
the unavailable state, guest saves work, and chat uses deterministic replies.
Configured chat receives bounded request/history sizes and source-grounded
context. Provider failures fall back to deterministic replies. Request bounds
are supplemented by a persistent PostgreSQL allowance: verified accounts receive
up to 20 provider attempts per UTC day, with five seconds between attempts.
Guests, exhausted accounts, and allowance errors use deterministic replies.
Host traffic protection and provider aggregate spend caps remain deployment
tasks. Model extraction remains intentionally unimplemented.

`YUMS_DEMO_MODE=true` substitutes explicit sample listings and avoids discovery
network calls. Samples are never a live outage fallback. Provider-backed
features still require their own credentials. No background notification
service or public deployment is part of the local demo.
