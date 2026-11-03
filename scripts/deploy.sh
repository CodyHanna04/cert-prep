#!/bin/sh
# Production deploy on the homelab LXC (docs/15-homelab-lxc-setup.md). Run from /srv/certprep:
#   sh scripts/deploy.sh            pull main, build, migrate, restart, check
#   sh scripts/deploy.sh --no-pull  deploy the files already in place
# The shared question bank (content/<pack>/bank/) reaches each learner the next time they open the app.
set -eu
cd "$(dirname "$0")/.."
compose() { docker compose -f docker-compose.yml "$@"; }

if [ "${1:-}" != "--no-pull" ]; then
  git pull --ff-only
fi
rm -f docker-compose.override.yml   # dev only: it publishes Postgres

compose --profile tools build   # the migrate image sits behind the "tools" profile
compose up -d db
compose run --rm migrate
compose up -d web
if compose ps --services --status running | grep -qx admin; then
  compose --profile admin up -d admin
fi

. ./.env
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://${WEB_BIND:-127.0.0.1}:3000/sign-in" || true)
  [ "$code" = "200" ] && { echo "Deployed: sign-in page answers 200."; docker image prune -f >/dev/null; exit 0; }
  sleep 2
done
echo "The web container did not answer in time. Logs:" >&2
compose logs --tail 50 web >&2
exit 1
