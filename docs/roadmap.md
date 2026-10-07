# Portfolio demo roadmap

Reviewed October 7, 2026. Goal: finish a polished portfolio/demo project in
under a week. Proposed six-day window: October 7–12; adjust daily scope to
available development time. Make incremental commits for each completed item.

## Current state

Yums already has live Berkeley event discovery, nearby restaurants, onboarding,
ranking, optional Calendar/chat/maps, saved items, community reports, and
reminders while the feed stays open. GitHub has no open issues or pull requests
at review time. The issues below are a local backlog, not published issues.
Prior claims of 98 passing tests and live integration checks are historical.
This review initially could not run tests/build because dependencies were absent.

## Review findings

| ID | Priority | Issue and code evidence | Done when |
| --- | --- | --- | --- |
| R1 | P0 | Generic food mentions become FREE claims: `services/event-ingestion/extract.ts` assigns positive confidence, `index.ts` accepts it, and `apps/web/src/lib/recommendations.ts` calls all results free food. | Require explicit free-food evidence; test paid food, negations, and food discussions. Omit or label uncertain mentions. |
| R2 | P1 | Preferences are saved but incompletely applied: feed hardcodes 20 minutes; dashboard reads only budget/travel query parameters; transportation and optimization choices do not affect ranking. | Persist travel/budget behavior across direct navigation and reload; implement supported choices or remove them. Validate numeric input. |
| R3 | P1 | Today includes all returned events; Cal Link has no upper date bound; recommendations do not remove expired events. Normalization drops source end times and Calendar scoring assumes one hour. | Use campus time for Today and a defined weekly window; omit ended events; preserve real end times with an explicit fallback. Test boundary times and conflicts. |
| R4 | P1 | Dashboard savings use $8 per event and 40% of aggregate value without attendance evidence. | Label assumptions and potential value clearly or remove the projection; never present it as achieved savings. |
| R5 | P2 | Saves use title/source URL identity, but nearby places have no source URL; database saves have no uniqueness constraint. | Preserve stable source IDs and make saves idempotent; identify expired saved snapshots. |
| R6 | P1 for demo | No CI workflow found; report read failures silently show an empty list; docs disagree about Calendar verification and LLM extraction is still a stub. | Tests/build/lint run reproducibly; document dated verification; show errors distinctly; rehearse configured and unconfigured paths. |
| R7 | Before public access | Chat message/history sizes are unbounded and the route has no application rate limit; reports have no moderation workflow. | Bound requests and paid usage before public chat; keep public reports disabled or add moderation. Verify account isolation before inviting users. |

Nearby restaurants have no verified prices or discounts, so the demo should
show restaurant discovery without promising the cheapest restaurant. Mock
fallback events need prominent sample labeling and must not imply real offers.
These findings come from code inspection, not production incident reports.

## Six-day delivery plan

| Day | Deliverable | Exit criteria / incremental commit |
| --- | --- | --- |
| 1 — Oct 7 | Correct free-food evidence (R1), establish runnable baseline. | Regression cases pass; commit classification fix independently. |
| 2 — Oct 8 | Correct Today/weekly windows and Calendar duration (R3). | Campus timezone and expired-event cases pass; commit event-time fix. |
| 3 — Oct 9 | Make onboarding useful and savings honest (R2, R4). | Guest and signed-in navigation preserve supported settings; commit preferences and projection changes separately. |
| 4 — Oct 10 | Polish the main mobile/desktop journey and save behavior (R5). | Onboard → dashboard → feed → save/remove works; empty/error/sample states are clear; commit UI and persistence changes separately. |
| 5 — Oct 11 | Reproducible setup, CI, README and portfolio evidence (R6). | Fresh install, tests, build and lint succeed; capture screenshots and a short architecture/limitations explanation; commit verification/docs. |
| 6 — Oct 12 | Demo rehearsal and buffer. | Rehearse with and without optional keys; fix only demo blockers; commit final fixes. If publishing publicly, meet R7 first or disable exposed paid/community features. |

Dates are a suggested schedule, not effort estimates. If capacity is tight,
cut optional integration polish and save-identity improvements before cutting
food/date correctness or reproducibility. Do not add multi-campus support,
background push, merchant deals, agentic checkout, or LLM extraction this week.

## Definition of finished

- A coherent Berkeley demo with accurate food claims and date windows.
- Supported preferences work; estimates and sample data are unmistakable.
- Main journey looks good on mobile and desktop and supports keyboard use.
- Tests/build/lint pass, and setup works from documented instructions.
- README includes screenshots, architecture, current limitations, and demo steps.
- Changes are committed in reviewable increments and ready to push to GitHub.

## Remaining choices

Weekly capacity is unspecified; prioritize the exit criteria over the daily
feature count. A hosted public demo is optional and needs a hosting choice and
public-access safeguards. Goal questions already answered: portfolio/demo,
under one week. Follow-up: decide whether delivery needs a hosted URL or only
a reproducible repository and recorded demo.

## Verification from this review

After `npm ci`, all 98 tests across 16 files passed and `npm run build`
succeeded, including TypeScript compilation. Lint reports two errors
(`report/page.tsx` and `notification-toggle.tsx`, synchronous state updates
inside effects) and one unused-variable warning (`app/page.tsx`). Include
these fixes in day 1 before treating the baseline as clean.

`npm audit` reports 20 vulnerabilities: 4 moderate, 14 high, 2 critical.
The direct Next.js dependency is flagged critical. Review advisory applicability
and compatible dependency updates on day 1, re-run checks, and resolve relevant
public-runtime findings before publishing. Do not use a blanket forced audit
fix: some suggested changes are major downgrades. No dependency versions were
changed during this review. Live credentials and browser journeys were not
reverified; passing tests/build do not establish integration or visual correctness.
