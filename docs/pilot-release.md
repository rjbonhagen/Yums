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
recently started events. Live-mode build and rehearsal are the next checks.

Still required: account project configuration, moderation and usage controls,
hosting preparation, real-account verification, and deployment authorization.
