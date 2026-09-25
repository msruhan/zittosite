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
