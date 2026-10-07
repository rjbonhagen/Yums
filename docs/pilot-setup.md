# Invited pilot setup

These steps prepare real UC Berkeley users. They have not been applied to a
remote project yet. Do not rerun the initial schema on an existing populated
database; inspect its tables and policies first.

## Database

For a new empty Supabase database, run `packages/database/schema.sql`, then
`packages/database/migrations/20261007_chat_allowance.sql`.
The initial schema already includes report moderation and save identity.

For an existing database, review and apply these migrations in order:

1. `20261007_saved_identity.sql`: preserves latest duplicate saved snapshots.
2. `20261007_report_moderation.sql`: existing reports enter pending review.
3. `20261007_chat_allowance.sql`: adds persistent provider-attempt limits.
4. `20261007_report_validation.sql`: enforces content limits on new report writes
   while preserving legacy records for review. Existing invalid records must be
   corrected before approval; the initial schema already includes these limits.

Back up existing data before migration. Verify row-level security and account
behavior with two invited test accounts before inviting the rest of the pilot.
Database tests run locally with a Supabase-compatible auth harness; remote
policy correctness still needs verification against the actual project.

## Accounts

In Supabase Authentication configuration, disable new user sign-ups and
anonymous sign-ins. Keep email confirmation enabled. The project owner can
invite pilot users from the Authentication dashboard. No invitations have
been sent during this work.

Set `NEXT_PUBLIC_INVITE_ONLY=true` in the app. This prevents magic-link login
from requesting automatic account creation; the global Supabase setting is
the enforcement boundary for all providers, including Google.
See [Supabase access configuration](https://supabase.com/docs/guides/auth/general-configuration)
and [magic-link options](https://supabase.com/docs/reference/javascript/auth-signinwithotp).

Set the site URL to the chosen hosted HTTPS origin and allow its
`/auth/callback` redirect. When enabling Calendar, also allow the callback
with `?calendar=connect`. Retain localhost callbacks for local testing.
Configure an email sender suitable for the invited users and verify delivery.
Use the public project URL and anon/publishable client key for the app's public
configuration. Never place a service-role key in a `NEXT_PUBLIC_` variable.

## Report review

Use the Supabase SQL editor as a privileged pilot operator. Inspect pending
reports and confirm the original offer, venue, time, and source link before
approval. Approval controls publication; it does not guarantee that food remains
available. Published reports keep their unverified community label.

```sql
select id, title, description, location_name, start_time, source_url
from public.user_reported_events
where moderation_status = 'pending'
order by created_at;

-- Substitute a reviewed report UUID. Use rejected to decline publication.
update public.user_reported_events
set moderation_status = 'approved'
where id = 'REVIEWED-REPORT-UUID' and moderation_status = 'pending';
```

Authors may delete reports; approved reports cannot be edited by their authors.
Corrections require withdrawal and a new reviewed submission. Reject an
approved report to withdraw it from the shared feed. Review the queue regularly
so time-sensitive tips do not sit pending until their event has passed.

## Hosting preparation

No hosting provider has been selected. If using Vercel, import the repository,
select the Next.js app with root directory `apps/web`, and allow source files
outside the root so the shared workspace packages are included. Keep the
root npm lockfile and workspace installation. Verify the dashboard's generated
install/build commands before publishing; this configuration has not been
tested on Vercel yet. See [Vercel monorepo setup](https://vercel.com/docs/monorepos).

Set `YUMS_DEMO_MODE=false` at build and runtime, public Supabase settings,
and `NEXT_PUBLIC_INVITE_ONLY=true`. Optional map/chat/Calendar credentials
belong in the hosting environment. Rebuild after changing public variables.
Do not enable provider chat until the allowance migration is verified.
Account limits do not replace a provider project spend cap or host traffic
protection; configure those for the intended pilot size.

Use Node.js 22, install from the repository root with `npm ci`, then run
`npm test`, `npm run test:pilot-config`, `npm run lint`, and `npm run build`.
Run `npm run check:pilot` with the actual deployment environment before
publishing. Locally it also reads the ignored `apps/web/.env.local`, when
present. It prints setting names rather than credential values, rejects
sample mode and secret/service-role public keys, and requires invitation
mode and a hosted HTTPS project origin. It checks key shape only; successful
output does not prove that credentials work or that remote settings are safe.

Calendar is optional. Connect explicitly from the signed-in account page;
regular Google sign-in does not enable Calendar access. Verify availability,
refresh, and reconnect with an existing Google identity. Disconnect removes
the app's stored credentials for that account. Users can separately revoke
the Google grant in their Google account settings.

## Acceptance and recovery

Before release, use two invited accounts and separate browser sessions:

- Sign in, save preferences, reload, and verify persistence from another device.
- Save and remove a real listing; confirm the other account cannot access it.
- Submit a report; confirm another account cannot see it before approval.
- Approve it as operator; confirm it appears, still labeled unverified.
- Attempt self-approval and editing approved content; both must be denied.
- Verify provider allowance and fallback under exhaustion or database failure.
- Check live source statuses and inspect the original food-offer details.
- Sign out and confirm private account records are no longer accessible.

If discovery fails, disclose unavailability rather than supplying samples.
If paid chat causes trouble, remove its provider key and rebuild/restart;
deterministic replies remain. Reject problematic reports to withdraw them.
For migration failures, preserve the error and restore from the database backup
after reviewing the failure; do not blindly rerun the initial schema.
