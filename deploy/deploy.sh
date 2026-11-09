#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Hotel SaaS Platform v2 — VPS Staging Health & Deployment Script
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

TARGET_DIR="/opt/hotel-saas"
DOMAIN="https://luxustay.duckdns.org"

echo "=== [1/4] Navigating to deployment directory: ${TARGET_DIR} ==="
cd "${TARGET_DIR}"

echo "=== [2/4] Pulling latest production images from GHCR ==="
docker compose -f docker-compose.staging.yml pull

echo "=== [3/4] Rolling update backend and frontend containers ==="
docker compose -f docker-compose.staging.yml up -d --no-deps backend frontend

echo "=== [4/4] Verifying health check probe at ${DOMAIN}/health ==="
HEALTHY=0
for i in {1..20}; do
  RESPONSE=$(curl -sk "${DOMAIN}/health" || echo "")
  if echo "${RESPONSE}" | grep -q '"status":"healthy"'; then
    echo "✔ Probe verified: Service is HEALTHY! (${RESPONSE})"
    HEALTHY=1
    break
  fi
  echo "  Waiting for health probe response... (${i}/20)"
  sleep 3
done

if [ "${HEALTHY}" -ne 1 ]; then
  echo "❌ Health check FAILED after 60s!"
  docker logs --tail 80 hotelsaas-backend-api
  exit 1
fi

echo "✅ Deployment successfully verified on ${DOMAIN}!"
