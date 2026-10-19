# EC2 pilot deployment

The proposed pilot uses one Amazon Linux 2023 `t3.small` instance in Northern
California (`us-west-1`), an encrypted 20 GB gp3 disk, one static public IPv4
address, a private ECR repository, and two basic CloudWatch alarms. Supabase
continues to hold user data. No load balancer or NAT gateway is needed.

The template is `infra/ec2-pilot.yaml`. It accepts an existing VPC and a public
subnet, a hostname controlled by the operator, and an optional existing GitHub
OIDC provider ARN. Deploying the template incurs ongoing costs. Preparation
and template validation do not launch a server.

`ImageId` is an explicit regional AMI ID. For a new server, resolve the current
Amazon Linux 2023 image from the public Systems Manager parameter
`/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`. For an
existing server, preserve its current image during unrelated stack updates.
Image upgrades are separate changes because they can replace the instance.

## Cost and validation status

October 14, 2026 pricing for `us-west-1`, assuming 730 hours per month:

| Component | Estimated monthly cost |
| --- | ---: |
| `t3.small` Linux server, $0.0248/hour | $18.10 |
| 20 GB gp3 disk, $0.096/GB-month | $1.92 |
| Public IPv4 address, $0.005/hour | $3.65 |
| Base total | $23.67 |

Logs, alarms, registry storage, transfer, snapshots, taxes, and the domain are
additional. Enabling email alarms also creates a customer-managed KMS key at
[$1/month before rotations and request charges](https://aws.amazon.com/kms/pricing/).
Promotional credits cover
eligible charges only while credits and account eligibility remain available.
The $30 budget is an alert threshold, not a spending cap.

October 14 local verification: `cfn-lint` 1.57.2 passed for `us-west-1` with
no diagnostics. `guardpycfn` 0.1.0 passed all three rules in `infra/pilot.guard`.
Four in-memory negative controls were rejected: optional IMDS tokens,
unencrypted EBS, public SSH, and mutable image tags. These checks cover the
defined rules; they are not a comprehensive security assessment.

Release-command tests pass locally. CloudFormation's basic `ValidateTemplate`
check accepts the template. GitHub's Linux builds and container smoke checks
passed. The first release is deployed with HTTPS at `https://getyums.food`.
Public health, login HTML, static assets, and callback-origin checks pass.
Hosted signed-in account acceptance checks remain a release gate for invitations.

The `yums-pilot` change set `pre-deploy-20261014` completed account-aware
pre-deployment validation in `us-west-1`; `DescribeEvents` returned no validation
errors. It provisioned 16 resources, using the existing default VPC and public
subnet in `us-west-1a`. The server passed bootstrap and EC2 health checks.
The deployment identity was subsequently updated in place to match GitHub's
immutable repository subject format. CloudTrail has no persistent trail configured;
management event history provides limited retention rather than durable audit
logging. Alert delivery will use the operator-selected address and requires
confirmation of the SNS email subscription after launch. Public DNS resolves to
the stack's static IP. Production and localhost callback URLs are configured
in Supabase, with `https://getyums.food` as the Site URL.

## Access and exposure

Only ports 80 and 443 are public. Caddy redirects HTTP to HTTPS and obtains a
certificate after the hostname resolves to the static IP. Port 3000 binds only
to loopback. Session Manager handles administration; the stack creates no SSH
key and exposes no SSH port. The EC2 metadata endpoint requires IMDSv2 and a hop
limit of one. The application container runs as the image's non-root user with
Linux capabilities dropped and privilege escalation disabled.

The instance role can pull images only from the stack's ECR repository, write
only to the stack's log group, and connect to Session Manager. GitHub's separate
deployment role can publish to that repository and run the standard shell
document only on the pilot instance. ECR authorization and command-status APIs
require wildcard resources; image and deployment mutations remain scoped.

GitHub OIDC eliminates stored AWS access keys. The role trusts the immutable
`sub_claim_prefix` returned by GitHub's repository OIDC settings API, followed
by `:environment:pilot`. Keep this prefix aligned with the repository identity.
After a repository rename, read the current prefix again and update the existing
stack's `GitHubSubjectPrefix` parameter before deploying. Changing the template's
default alone does not change an existing parameter value. Review the change set
and allow only the deployment role's trust update; do not replace the server.
The `pilot` environment restricts deployment to `pilot-release`. The current
GitHub plan does not support required reviewers; deployment is an explicit
manual workflow dispatch. Enable reviewer approval if the plan supports it.
Pushing code does not
launch or update infrastructure. Review changes to the workflow and release
script as privileged server code because deployment runs through Session Manager.

## Domain and initial launch

The selected hostname is `getyums.food`. The operator confirmed registration
through Porkbun on October 14, 2026. Use `https://getyums.food` as the production
origin. DNS configuration remains pending until the server's static IP exists.

Choose and register a domain, or obtain a subdomain from a domain owner. Domain
registration is a separate purchase and is not included in the server estimate.
Use the exact hostname as `DomainName`; do not include `https://` or a path.

Before authorizing the stack, review its resource list, current cost estimate,
VPC/subnet, AMI, host parameters, and IAM changes. The chosen public subnet must
have an active internet gateway route. Check for an existing GitHub OIDC
provider and pass its ARN instead of creating a duplicate.

After approved creation:

1. Wait for cloud-init to finish and the host to appear online in Session Manager.
   `/opt/yums/bootstrap-ready` confirms Docker installation completed.
2. Point the hostname's DNS A record at the stack's `PublicIp`. Do not add an
   AAAA record unless IPv6 is deliberately configured.
3. Set Supabase Site URL to the stack's `Origin`, and allow its exact
   `/auth/callback` and Calendar reconnect callback. Update Google test users
   and Mapbox token URL restrictions for the hosted pilot.
4. Configure the GitHub `pilot` environment variables below.
5. Run **Deploy EC2 pilot** manually from `pilot-release` after CI is green.
6. Verify both real accounts, Calendar availability, saved items, reports,
   mobile layout, and source availability over public HTTPS before inviting users.

## Deployment variables

| GitHub environment variable | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | Stack output `DeploymentRoleArn` |
| `EC2_INSTANCE_ID` | Stack output `InstanceId` |
| `ECR_REPOSITORY_URI` | Stack output `RepositoryUri` |
| `APP_ORIGIN` | Stack output `Origin` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project origin |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable or anon client key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Public Mapbox token restricted for this hostname |

Public configuration is embedded during the Docker build. Never supply a
service-role key or server credential as a build argument. `/etc/yums/runtime.env`
starts with only `APP_ORIGIN`. Server-side Calendar refresh credentials require
a separate protected runtime configuration before long-lived Calendar testing;
Google sign-in alone does not configure the application's refresh client.
Keep optional paid chat disabled until its spend limit and quota are reviewed.

## Release and recovery

The workflow builds a Linux amd64 image, runs the packaged-server smoke check,
pushes an immutable release tag, and deploys the corresponding digest. The host
rejects images outside its configured repository and candidates that fail the
health check. The current container remains online during the candidate check.
Promotion briefly interrupts requests on this single-server pilot. If the new
container fails local health after promotion, the previous container is restored.

The public smoke check must also pass. A public HTTPS or downstream-account
failure is not covered by the local process-health rollback. Inspect it and
re-run `/opt/yums/release.sh` through Session Manager with the previous verified
digest. Retain release image digests; the repository has no automatic deletion
policy. A hostname change requires updating the host configuration and proxy,
not just changing DNS or redeploying the app.

CloudWatch retains container logs for 14 days. The two alarms track EC2 health
and CPU credits. Supply `AlertEmail` to connect them to an encrypted SNS topic;
confirm the resulting email subscription. The stack also defines an account-wide
$30 monthly budget with 80% and 100% actual-cost email alerts when `AlertEmail`
is set. Promotional credits are excluded from the budget calculation so credit
consumption stays visible. Budget alerts are delayed notifications, not a hard
spending cap. Without a recipient, there are no outbound notifications. Standard CPU credit
mode caps surplus charges but can throttle sustained workloads. Build images
in GitHub Actions instead of on this small host.

This is a single-server pilot, not a high-availability deployment. Take a
snapshot before replacing the host if certificate state or runtime configuration
needs preservation. User records remain in Supabase. When ending the pilot,
review the stack deletion plan: ECR is retained for rollback and requires separate
cleanup; DNS and retained images can continue to incur separate costs.
