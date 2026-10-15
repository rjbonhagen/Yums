# Product scope

Yums is preparing for a small invited UC Berkeley pilot: discover explicit
free-food offers and nearby restaurants, save listings across devices, and
submit community tips for review. The local portfolio demo is complete; the
pilot still requires remote account/security checks and authorized hosting.
See [roadmap](roadmap.md) and [release evidence](pilot-release.md).

Built:
- Budget target, preferred walking time, and free-food/shorter-walks ranking.
- Guest settings persist via localStorage plus a validated preference cookie;
  signed-in settings can synchronize through Supabase.
- Today and seven-day feeds use Berkeley's timezone and source event durations.
- Search, type filters, optional map, exact-title recurring-event grouping.
- Browser-local saved snapshots and optional per-account cloud saves.
- Optional Calendar conflict ranking and grounded chat. Community reports
  require operator approval before shared display; remote setup is pending.
- Open-tab browser reminders for real events; no sample-event reminders.
- Explicit sample mode for reproducible demos; no mock offers during outages.

Not built: menu-price comparisons, actual spending/savings tracking, nutrition
matching, travel modes beyond walking, background push, multi-campus support,
merchant deals, checkout, and model-based event extraction. Do not advertise
those as functioning features. Optional account features require configuration
and the database schema/migration in the README.
