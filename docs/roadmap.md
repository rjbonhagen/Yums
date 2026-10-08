# Berkeley pilot roadmap

Reviewed October 7, 2026. Target: a small invited UC Berkeley pilot before
October 14. The release serves real users with live offers and account-backed
saves/preferences. AWS is the chosen host; Supabase is connected locally.
The [portfolio roadmap](portfolio-roadmap.md) records the completed earlier
scope. Current verification is tracked in [pilot release](pilot-release.md).

## Release outcome

An invited student can sign in, find a current offer, save it across devices,
and submit a tip for operator review. Users cannot access another account's
private records or approve their own reports. Source outages are visible, and
sample data is never substituted into the pilot feed.

## Current state

- Real Supabase sign-in and saving confirmed by one user. Cross-device
  persistence, preference sync, and two-account isolation remain unverified.
- Local account-change protections, source validation/freshness, moderation,
  and quota safeguards implemented. 248 regression tests and 11 configuration
  tests pass; lint and the production build pass.
- Root builds package a standalone Node server and its assets. Local health,
  login, feed, and a static asset respond successfully. Dockerfile, container
  CI, and the AWS checklist are prepared; Linux container/CI/hosting checks
  have not run. No image upload or AWS resources have been created.
- Remote public sign-ups remain enabled. Report moderation and quota schema
  are missing. Remote validation constraints, profile triggers, policy/index
  correctness, email delivery, and callback allowlists still need review.

## Six-day sequence

Dates are target order, not a claim that work or external approval is complete.
Do not advance through a gate without its evidence.

| Target | Work | Completion evidence |
| --- | --- | --- |
| Oct 7 | Local safeguards and reproducible release package | Passing regressions/config checks, lint/build, local server/assets, incremental commits. Prepared. |
| Oct 8 | Supabase audit, reviewed migrations, invitation settings | Project-owner audit before/after changes; Auth signup/anonymous settings; custom SMTP and redirect checks; read-only connection check passes. Requires owner action. |
| Oct 9 | Real account and report acceptance | Two invited accounts in separate sessions/devices: preferences/saves persist, removal works, private records are isolated, pending reports stay private, operator approval publishes, self-approval is denied. |
| Oct 10 | Linux container and AWS release review | Container build and smoke check pass; approved AWS account/region/cost limit, image digest, roles, service configuration, and recovery plan are reviewable. No cloud creation yet. |
| Oct 11 | Authorized hosted rehearsal | HTTPS/callback/email setup and laptop/phone acceptance pass on the chosen AWS endpoint. Hosted source status, logs, restarts, and recovery verified. |
| Oct 12–13 | Small invited pilot and correction buffer | After authorization, invite 3–5 students, observe the core flow, fix blocking problems, and record feedback and release evidence. |

## Next required external actions

1. Project owner runs [the read-only database audit](../packages/database/pilot-audit.sql)
   and reviews the existing-database migration sequence in
   [pilot setup](pilot-setup.md). Back up data before applying reviewed changes.
   The known missing moderation and quota setup must be resolved; audit the
   validation constraints and profile trigger rather than assuming they exist.
2. Disable public sign-ups and confirm anonymous sign-ins remain disabled.
   Verify email delivery and the local callback before testing accounts.
3. Supply two existing invited test sessions, or explicitly authorize creating
   test accounts/invitations. No test invitations have been sent by this work.
4. Verify the Linux image on a Docker-capable machine or through an authorized
   GitHub push/PR that runs the prepared container CI. Review
   [AWS pilot deployment](aws-pilot.md) before authorizing cloud resources.

## Scope and operating rules

Keep optional paid chat, Calendar, and maps disabled unless their configuration
and acceptance checks are complete. Deterministic chat and the listing view
remain usable. Do not add multi-campus support, merchant deals, checkout,
background push, or spending projections during this pilot week.

Commit verified milestones with short lowercase messages using the configured
Git identity. Keep credentials and local tooling out of commits. Pushes,
deployments, invitations, purchases, and remote database changes require
explicit authorization. Test/metadata success alone does not prove launch
readiness; retain dated real-account and hosted evidence before releasing.
