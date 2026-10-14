# AWS pilot deployment

The selected hosting path is a single EC2 server in Northern California
(`us-west-1`), with HTTPS, a private container registry, manual GitHub releases,
Session Manager administration, and CloudWatch monitoring. Supabase continues
handling authentication and user data.

See [EC2 pilot deployment](ec2-pilot.md) for the template, current estimate,
domain setup, required GitHub variables, validation status, and recovery steps.
The earlier ECS proposal is superseded by this plan. No AWS infrastructure has
been created and no image has been pushed by this preparation.

## Before launch

1. Choose a domain or an authorized subdomain and review registration costs.
2. Finish template validation and the Linux container build and smoke check.
3. Review the resource list, IAM permissions, network, and ongoing costs.
4. Configure the protected GitHub `pilot` environment and production callbacks.
5. Deploy the tested digest, then check HTTPS and both real accounts.

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
and previous working digest. Domain registration, hosted deployment, runtime
Calendar refresh configuration, and invitations remain separate release steps.
