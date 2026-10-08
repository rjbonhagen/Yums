# Invited pilot setup

These steps prepare real UC Berkeley users. They have not been applied to a
remote project yet. Do not rerun the initial schema on an existing populated
database; inspect its tables and policies first.

## Database

Before changing an existing project, run `packages/database/pilot-audit.sql`
in its Supabase SQL editor as project owner. It runs in a read-only transaction
and returns table/RLS status, policies, migration columns, constraints, save
indexes, role grants, function permissions, and the profile-sync trigger.
It does not return account values or Calendar tokens. Missing tables/columns
and disabled RLS require review. Confirm all applicable result sets before
selecting the initial schema or migration path below.

Run `npm run check:supabase` locally for a preliminary connection check using
the public settings in `apps/web/.env.local`. It checks Auth signup/anonymous
settings and required table columns with GET requests and `limit=0`; it requests
no account rows and makes no remote changes. Missing schema is reported with
the relevant migration filename. A passing result does not replace the SQL
audit: it cannot verify RLS, unique indexes, profile triggers, report validation
constraints, quota-function permissions, email delivery, callback allowlists,
or signed-in account behavior. Network or key failures leave the checks failed.
Public configuration is never printed, and redirects are rejected.

Inspect extra permissive policies as well as the expected policies; another
policy can broaden access. `chat_usage` should have no client write policies.
`consume_chat_allowance()` must use security-definer execution with the reviewed
restricted search path, allow `authenticated`, and deny `anon` and `PUBLIC`.
Verify the enabled Auth trigger points to the reviewed profile-sync function,
and saves have uniqueness on `(user_id, save_key)`. Table grants alone do not
prove data is exposed or protected; RLS and actual client behavior also matter.
This inventory cannot inspect dashboard Auth settings or prove account isolation.

For a new empty Supabase database, run `packages/database/schema.sql`, then
`packages/database/migrations/20261007_chat_allowance.sql`.
The initial schema already includes report moderation, save identity, and
profile creation for email Auth accounts that predate the app schema.

For an existing database, review and apply these migrations in order:

1. `20261007_user_sync.sql`: creates missing profiles for existing email Auth
   accounts and repairs the new-account trigger. Review any existing customized
   `on_auth_user_created` trigger first; this migration replaces that named
   trigger. Existing profile rows remain unchanged. Non-email Auth identities
   are skipped and are outside this invited email-account pilot.
2. `20261007_saved_identity.sql`: preserves latest duplicate saved snapshots.
3. `20261007_report_moderation.sql`: existing reports enter pending review.
4. `20261007_chat_allowance.sql`: adds persistent provider-attempt limits.
5. `20261007_report_validation.sql`: enforces content limits on new report writes
   while preserving legacy records for review. Existing invalid records must be
   corrected before approval; the initial schema already includes these limits.

Back up existing data before migration. Verify row-level security and account
behavior with two invited test accounts before inviting the rest of the pilot.
Database tests run locally with a Supabase-compatible auth harness; remote
policy correctness still needs verification against the actual project.
Rerun the read-only inventory after authorized migrations, then complete the
two-account acceptance checks through the app's authenticated clients. The
privileged SQL editor bypasses RLS and cannot prove those client checks.

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

AWS is the selected provider. See [AWS pilot deployment](aws-pilot.md) for the
prepared Docker/ECS path, local image checks, public build configuration,
HTTPS/Auth setup, release gates, and recovery. Amplify's documented Next.js
support does not cover this project's Next.js 16 version. No image upload or
AWS resource creation is authorized or performed. The Linux container and
hosted flow must still be verified before inviting users.

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
- Verify an account created before app-schema installation can save preferences
  and listings. Check that a failed preference write keeps the entered values
  and shows an error; retry before expecting cross-device synchronization.
- Save and remove a real listing; confirm the other account cannot access it.
- Submit a report; confirm another account cannot see it before approval.
- Submit using the keyboard and confirm the pending report appears after
  navigation. Switch accounts while a draft is open; the previous draft must
  disappear. For an unconfirmed write, inspect your reports before retrying
  to avoid submitting the same tip twice.
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
