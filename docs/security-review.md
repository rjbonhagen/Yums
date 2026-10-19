# Security review

Reviewed October 19, 2026 before repository publication.

## Scope and results

- Gitleaks 8.30.1 scanned all fetched Git references with redacted output and
  no detected secrets. Private environment files were not found in tracked
  history. The scanner ran from a temporary directory, outside app dependencies.
- `npm audit --omit=dev` reported zero known runtime dependency vulnerabilities.
- The complete dependency audit reported nine high-severity package findings,
  all through the development-tool dependency on `braces`. These represent one
  underlying [stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
  which lists no patched version. Forced toolchain downgrades were not applied.
- The live Supabase metadata audit confirmed row security on every public table.
  Saves, preferences, profiles, and Calendar connections use account-ownership
  predicates. Public reports require approval; authors cannot approve their own
  submissions. A read-only check as the anonymous role returned zero visible
  profiles, preferences, saves, Calendar connections, and unapproved reports.
  No private row contents or credential values were read.
- The live chat allowance function rejects anonymous execution, derives the
  caller from `auth.uid()`, uses a fixed search path, and enforces atomic usage
  limits. Its security-definer warning is expected for this restricted function.
  The usage table intentionally has no client policies.
- Source review covered sign-in redirects, local-import gating, source URLs,
  report validation, database policies, container exclusions, and deployment
  workflow permissions. Account isolation, moderation, and request-size tests
  are included in the existing suite; all 317 tests, lint, the production build,
  and container smoke checks passed. The theme and cache fix were deployed as
  release `c230fee`; public HTTPS health, sign-in HTML, asset, and callback-origin
  checks passed afterward.

## Corrections

- The legacy live-event endpoint now uses the same bounded public-source cache
  as the food feed instead of fetching Berkeley on every request. A regression
  check covers shared reads and failure after cache expiry. This cache is not
  a traffic rate limiter.
- Fresh database installations now enable row security on the five public
  catalog tables, permitting public reads and reserving writes for operators.
  Tests verify both anonymous and signed-in clients cannot insert, change, or
  delete catalog data even when table grants are broad. The live project already
  had these policies; no remote database changes were needed.
- Root Git exclusions now cover environment-file variants, local AWS settings,
  and private key files while retaining the blank configuration example.

## Remaining follow-up

Track the development-tool advisory and update when a compatible fix is
available. Avoid running development tools on untrusted repositories or glob
patterns. The production dependency audit does not cover operating-system
packages in container images.

Supabase reported that leaked-password protection is disabled. Enable it if
password sign-in is offered and the project's plan supports it. See
[Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

After publication, enable available GitHub secret-scanning, push-protection,
and dependency alerts. Repository visibility was not changed during this review.

This is a dated automated scan and focused source/configuration review, not a
penetration test or a guarantee that vulnerabilities are absent. It did not
exercise live account takeovers, conduct load testing, inspect every workflow
artifact or log, or change production authentication settings.
