#!/bin/bash
set -euo pipefail
exec 9>/run/yums-release.lock
flock -n 9 || { echo 'Another release is running'; exit 1; }
test -f /opt/yums/bootstrap-ready || { echo 'Host bootstrap is incomplete'; exit 1; }
source /etc/yums/host.env
image=${1:?Pass an image digest URI}
test "${image%@sha256:*}" = "$REPOSITORY_URI" || { echo 'Image must come from the pilot repository'; exit 1; }
[[ "$image" =~ @sha256:[a-f0-9]{64}$ ]] || { echo 'Use an immutable image digest'; exit 1; }
registry=${REPOSITORY_URI%%/*}
export AWS_DEFAULT_REGION="$AWS_REGION"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
docker pull "$image"
docker logout "$registry" >/dev/null
docker rm -f yums-candidate >/dev/null 2>&1 || true
cleanup() { docker rm -f yums-candidate >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name yums-candidate --cap-drop ALL --security-opt no-new-privileges \
  --env-file /etc/yums/runtime.env -p 127.0.0.1:3001:3000 "$image"
healthy=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:3001/api/health >/dev/null; then healthy=true; break; fi
  sleep 2
done
$healthy || { echo 'Candidate health check failed; current release preserved'; exit 1; }
docker rm -f yums-previous >/dev/null 2>&1 || true
had_previous=false
if docker inspect yums-app >/dev/null 2>&1; then
  docker stop yums-app >/dev/null
  if ! docker rename yums-app yums-previous; then
    docker start yums-app >/dev/null
    echo 'Could not preserve the previous release; current container restarted'
    exit 1
  fi
  had_previous=true
fi
restore_previous() {
  docker rm -f yums-app >/dev/null 2>&1 || true
  if $had_previous; then docker rename yums-previous yums-app; docker start yums-app >/dev/null; fi
}
if ! docker run -d --name yums-app --restart unless-stopped --cap-drop ALL --security-opt no-new-privileges \
  --env-file /etc/yums/runtime.env -p 127.0.0.1:3000:3000 \
  --log-driver awslogs --log-opt awslogs-region="$AWS_REGION" --log-opt awslogs-group="$LOG_GROUP" \
  --log-opt awslogs-stream=app "$image"; then restore_previous; exit 1; fi
healthy=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:3000/api/health >/dev/null; then healthy=true; break; fi
  sleep 2
done
$healthy || { restore_previous; echo 'Release failed health check; previous release restored'; exit 1; }
if ! docker inspect yums-proxy >/dev/null 2>&1; then
  printf '%s {\n  reverse_proxy 127.0.0.1:3000\n}\n' "$DOMAIN_NAME" > /etc/yums/Caddyfile
  docker run -d --name yums-proxy --restart unless-stopped --network host \
    --log-driver awslogs --log-opt awslogs-region="$AWS_REGION" --log-opt awslogs-group="$LOG_GROUP" \
    --log-opt awslogs-stream=proxy -v /etc/yums/Caddyfile:/etc/caddy/Caddyfile:ro \
    -v yums-caddy-data:/data -v yums-caddy-config:/config caddy:2.11.7-alpine
fi
printf '%s\n' "$image" > /opt/yums/current-image
echo 'Release started. Complete the public HTTPS smoke check before inviting users.'
