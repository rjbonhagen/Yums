# AWS pilot deployment

The selected hosting path is a single EC2 server in Northern California
(`us-west-1`), with HTTPS, a private container registry, manual GitHub releases,
Session Manager administration, and CloudWatch monitoring. Supabase continues
handling authentication and user data.

See [EC2 pilot deployment](ec2-pilot.md) for the template, current estimate,
domain setup, required GitHub variables, validation status, and recovery steps.
The earlier ECS proposal is superseded by this deployment. The EC2 stack is
running and the pilot is served over HTTPS at `https://getyums.food`.

## Before invitations

1. Complete hosted Google sign-in and Calendar consent for both invited accounts.
2. Verify private-data isolation, cloud saves, and report moderation on HTTPS.
3. Confirm the SNS subscription email to enable server alarm delivery.
4. Configure protected Calendar refresh credentials for long-lived sessions.
5. Record signed-in acceptance results and review ongoing costs.

Template validation, Linux builds, DNS, HTTPS, exact production callbacks, and
public packaged-server checks have passed. GitHub deployment is manual and
restricted to `pilot-release`; the current plan does not support required
reviewers on the deployment environment.

Public Supabase sign-ups have been disabled and the moderation, chat allowance,
and validation migrations have been applied. Recheck the remote audit before
launch; previously completed local checks do not establish hosted behavior.

## Acceptance before invitations

Verify sign-in, sign-out, preferences, saving/removal, and private-data isolation
on two separate accounts. Test Calendar availability and refresh after the
initial login, future-report submission and operator approval, source statuses,
mobile layout, health checks, logs, restart, and rollback. Keep optional paid
chat disabled until its quota and spending limits are verified.

Record the release commit, image digest, acceptance evidence, operator contact,
and previous working digest. Runtime Calendar refresh configuration and hosted
signed-in acceptance remain release requirements before wider invitations.
