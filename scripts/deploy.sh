#!/usr/bin/env bash
set -euo pipefail

# Deploy ZITTOSITE on the VPS (run remotely via GitHub Actions SSH).
# Expects repo files already synced to DEPLOY_DIR.

DEPLOY_DIR="${DEPLOY_DIR:-/opt/zittosite}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$DEPLOY_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: $DEPLOY_DIR/.env missing. Create it from .env.production.example first."
  exit 1
fi

env_value() {
  grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | tr -d "\"' \r" || true
}

# With a domain configured, Caddy terminates TLS and the app ports stay on localhost.
# Without one, the app is served directly on :3000 / :4000 over plain HTTP.
WEB_DOMAIN_VALUE="$(env_value WEB_DOMAIN)"
if [[ -n "$WEB_DOMAIN_VALUE" ]]; then
  for required in API_DOMAIN ACME_EMAIL; do
    if [[ -z "$(env_value "$required")" ]]; then
      echo "ERROR: WEB_DOMAIN is set but $required is missing in .env"
      exit 1
    fi
  done
  PROFILES=tls
  export PUBLIC_BIND_ADDR=127.0.0.1
  echo "==> Mode: HTTPS via Caddy ($WEB_DOMAIN_VALUE)"
else
  PROFILES=""
  echo "==> Mode: plain HTTP on ports 3000/4000 (set WEB_DOMAIN in .env to enable HTTPS)"
fi

# WhatsApp gateway (WAHA) runs only once its API key is configured.
if [[ -n "$(env_value WAHA_API_KEY)" ]]; then
  if [[ -z "$(env_value WAHA_DASHBOARD_PASSWORD)" ]]; then
    echo "ERROR: WAHA_API_KEY is set but WAHA_DASHBOARD_PASSWORD is missing in .env"
    exit 1
  fi
  PROFILES="${PROFILES:+$PROFILES,}waha"
  echo "==> WhatsApp gateway (WAHA) enabled"
fi
export COMPOSE_PROFILES="$PROFILES"

echo "==> Pulling base images / building..."
docker compose -f "$COMPOSE_FILE" build --pull

echo "==> Starting stack..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "==> Status"
docker compose -f "$COMPOSE_FILE" ps

echo "==> Health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:4000/health" >/dev/null 2>&1; then
    curl -fsS "http://127.0.0.1:4000/health"
    echo
    echo "Deploy OK"
    exit 0
  fi
  sleep 2
done

echo "API health check failed"
docker compose -f "$COMPOSE_FILE" logs --tail=80 api
exit 1
