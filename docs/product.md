# Product scope

Yums is a single-campus portfolio demo for UC Berkeley: discover explicit
free-food offers and nearby restaurants, with honest source and sample states.

Built:
- Budget target, preferred walking time, and free-food/shorter-walks ranking.
- Guest settings persist via localStorage plus a validated preference cookie;
  signed-in settings can synchronize through Supabase.
- Today and seven-day feeds use Berkeley's timezone and source event durations.
- Search, type filters, optional map, exact-title recurring-event grouping.
- Browser-local saved snapshots and optional per-account cloud saves.
- Optional Calendar conflict ranking, grounded chat, and community reports.
- Open-tab browser reminders for real events; no sample-event reminders.
- Explicit sample mode for reproducible demos; no mock offers during outages.

Not built: menu-price comparisons, actual spending/savings tracking, nutrition
matching, travel modes beyond walking, background push, multi-campus support,
merchant deals, checkout, and model-based event extraction. Do not advertise
those as functioning features. Optional account features require configuration
and the database schema/migration in the README.
