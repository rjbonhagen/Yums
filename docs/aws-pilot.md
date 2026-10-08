# AWS pilot deployment

AWS is the selected provider. The prepared path is an ECR container image on
ECS Express Mode. No image has been uploaded and no AWS resources exist from
this work. Docker is unavailable on the local machine; the Linux image build
and container smoke test remain required before uploading it.

October 7 local evidence: the standalone Node server on Windows returned 200
for `/login`, `/feed`, `/api/health`, and a referenced static asset. Health
returned `{"status":"ok"}` with `Cache-Control: no-store`. This verifies the
local traced server and asset packaging, not the Docker/Linux image or AWS.

## Compatibility

This project uses Next.js 16. AWS's October 7 documentation lists Amplify SSR
support through Next.js 15. App Runner is closed to new customers. ECS runs
the app's Node.js server without a framework-specific hosting adapter.
References: [Amplify support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html),
[App Runner availability](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html),
[ECS Express Mode setup](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html).

## Local preparation

Run from the repository root with Node.js 22:

```text
npm ci
npm test
npm run test:pilot-config
npm run lint
npm run check:pilot
npm run check:supabase
```

Complete the remote SQL audit, reviewed migrations, invitation settings, and
two-account acceptance checks in `pilot-setup.md`. The public connection check
cannot prove policies or report-validation constraints. The current project
still needs moderation/allowance setup and public sign-ups disabled.

On a Docker-capable machine, set the two public configuration environment
variables locally, then build a Linux amd64 image:

```text
docker build --platform linux/amd64 --build-arg NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY -t yums:pilot .
docker run --rm -p 3000:3000 yums:pilot
```

Docker reads those build arguments from the calling shell's environment. The
root `.dockerignore` excludes local environment files, credentials directories,
dependencies, and old build output. The image contains the public Supabase
configuration, which Next.js embeds into client code. Never pass service-role
keys or optional provider/Calendar secrets as build arguments. Changing public
configuration requires rebuilding the image. Optional paid chat, Calendar,
and map features remain unavailable unless separately configured and verified.

The image runs the traced standalone server as the non-root `node` user,
listening on port 3000. Monorepo tracing includes shared packages; the final
image includes static assets and public files. `/api/health` returns process
health without requiring Auth or live discovery. It does not prove that
Supabase, email, or event feeds work. Test `/login`, `/feed`, `/saved`, static
assets, health, and the complete signed-in flow in the actual Linux container.

## Review before creating resources

Choose an AWS account, region, and approved spending limit. ECS Express Mode
provisions billable Fargate/load-balancer/networking resources; ECR and logs
also incur costs. Review current prices and the proposed configuration before
authorization. Do not enable automatic deployments for this pilot.

After explicit authorization, use a private ECR repository with immutable
release tags and deploy the tested image digest. Follow the AWS setup reference
for the task-execution and infrastructure roles; choose the matching x86_64
architecture, container port 3000, and health path `/api/health`. Start with one
task and a reviewed maximum task count. Use the generated HTTPS endpoint for
the initial pilot. Configure optional server secrets through AWS secret
references and an appropriately restricted task role rather than image layers.

## Hosted release gate

Before sending invitations:

1. Set Supabase Site URL to the final HTTPS origin and allow its exact
   `/auth/callback`. Retain localhost for testing. Add `?calendar=connect` only
   when Calendar is enabled and verified.
2. Verify SMTP delivery, sign-in, sign-out, preferences, and save/removal on a
   laptop and phone. Verify a second account cannot see private data.
3. Submit a future report, confirm it stays private until operator approval,
   and verify publication and denied self-approval through authenticated clients.
4. Check live-source statuses and original offer details. Review unavailable
   source messages and mobile layout on the hosted server.
5. Verify health checks, restarts, logs without tokens/credentials, and the
   optional chat fallback. Keep provider chat disabled until quota security
   and the provider spending limit are verified.
6. Record the approved image digest, release commit, acceptance evidence,
   operator contact, and previous working image for rollback.

## Recovery

Roll back to the previous verified image digest if the new release breaks
account behavior or feeds. Public configuration changes require a new build;
restart alone cannot change values embedded in the client. Disable a failing
paid provider by removing its runtime secret and deploying a new service
revision; deterministic replies remain. Withdraw problematic reports through
operator moderation. Do not restore old database schemas over newer user data
without reviewing the backup and compatibility. Review the created ECS, load
balancer, ECR, networking, and log resources together when ending the pilot so
unused resources do not keep accruing charges.
