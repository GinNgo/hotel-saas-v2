#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Hotel SaaS Platform v2 — VPS Staging Health, Deployment & Rollback Script
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

TARGET_DIR="/opt/hotel-saas"
DOMAIN="https://luxustay.duckdns.org"
ROLLBACK_FILE="${TARGET_DIR}/.rollback_state"
IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

ROLLBACK_MODE=0
for arg in "$@"; do
  case "$arg" in
    --rollback)
      ROLLBACK_MODE=1
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      echo "Usage: $0 [--rollback]" >&2
      exit 2
      ;;
  esac
done

verify_health_probes() {
  local healthy=0
  for i in {1..20}; do
    local health_res ready_res
    health_res=$(curl -sk "${DOMAIN}/health" || echo "")
    ready_res=$(curl -sk "${DOMAIN}/health/ready" || echo "")
    if echo "${health_res}" | grep -q '"status":"healthy"' && echo "${ready_res}" | grep -q '"status":"ready"'; then
      echo "✔ Probes verified: /health (${health_res}) | /health/ready (${ready_res})"
      healthy=1
      break
    fi
    echo "  Waiting for health & readiness probes... (${i}/20)"
    sleep 3
  done
  [ "${healthy}" -eq 1 ]
}

restore_previous_images() {
  local backend_img="${1:-}"
  local frontend_img="${2:-}"
  if [ -z "${backend_img}" ] && [ -z "${frontend_img}" ]; then
    echo "⚠️ No previous container image IDs available for rollback." >&2
    return 1
  fi
  echo "⏪ Rolling back containers using IMAGE_TAG=${IMAGE_TAG}..."
  if [ -n "${backend_img}" ]; then
    docker tag "${backend_img}" "ghcr.io/ginngo/hotel-saas-backend:${IMAGE_TAG}"
  fi
  if [ -n "${frontend_img}" ]; then
    docker tag "${frontend_img}" "ghcr.io/ginngo/hotel-saas-frontend:${IMAGE_TAG}"
  fi
  docker compose -f docker-compose.staging.yml up -d --no-deps backend frontend
  docker exec hotelsaas-caddy caddy reload --config /etc/caddy/Caddyfile || true
}

echo "=== [1/5] Navigating to deployment directory: ${TARGET_DIR} ==="
cd "${TARGET_DIR}"

echo "--- Container inventory BEFORE deploy/rollback ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

if [ "${ROLLBACK_MODE}" -eq 1 ]; then
  echo "=== [2/5] Manual rollback mode enabled ==="
  if [ ! -f "${ROLLBACK_FILE}" ]; then
    echo "❌ Rollback state file not found: ${ROLLBACK_FILE}" >&2
    exit 1
  fi

  PREV_BACKEND_IMG=""
  PREV_FRONTEND_IMG=""
  PREV_IMAGE_TAG=""
  # shellcheck disable=SC1090
  source "${ROLLBACK_FILE}"

  if [ -z "${PREV_BACKEND_IMG}" ] && [ -z "${PREV_FRONTEND_IMG}" ]; then
    echo "❌ Rollback state file contains no previous container images: ${ROLLBACK_FILE}" >&2
    exit 1
  fi

  echo "=== [3/5] Restoring previous images (recorded tag=${PREV_IMAGE_TAG:-unknown}) onto IMAGE_TAG=${IMAGE_TAG} ==="
  restore_previous_images "${PREV_BACKEND_IMG}" "${PREV_FRONTEND_IMG}"

  echo "=== [4/5] Verifying /health and /health/ready probes after rollback at ${DOMAIN} ==="
  if ! verify_health_probes; then
    echo "❌ Rollback health or readiness check FAILED after 60s!" >&2
    docker logs --tail 80 hotelsaas-backend-api || true
    exit 1
  fi

  echo "--- Container inventory AFTER rollback ---"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo "✅ Manual rollback successfully verified on ${DOMAIN}!"
  exit 0
fi

PREV_BACKEND_IMG=$(docker inspect --format='{{.Image}}' hotelsaas-backend-api 2>/dev/null || true)
PREV_FRONTEND_IMG=$(docker inspect --format='{{.Image}}' hotelsaas-frontend-spa 2>/dev/null || true)
PREV_BACKEND_REF=$(docker inspect --format='{{.Config.Image}}' hotelsaas-backend-api 2>/dev/null || true)
PREV_IMAGE_TAG="${PREV_BACKEND_REF##*:}"
if [ -z "${PREV_IMAGE_TAG}" ] || [ "${PREV_IMAGE_TAG}" = "${PREV_BACKEND_REF}" ]; then
  PREV_IMAGE_TAG="latest"
fi

if [ -n "${PREV_BACKEND_IMG}" ] || [ -n "${PREV_FRONTEND_IMG}" ]; then
  {
    echo "PREV_BACKEND_IMG=${PREV_BACKEND_IMG}"
    echo "PREV_FRONTEND_IMG=${PREV_FRONTEND_IMG}"
    echo "PREV_IMAGE_TAG=${PREV_IMAGE_TAG}"
  } > "${ROLLBACK_FILE}"
  echo "Saved rollback snapshot to ${ROLLBACK_FILE} (tag=${PREV_IMAGE_TAG})"
fi

echo "=== [2/5] Pulling production images from GHCR (IMAGE_TAG=${IMAGE_TAG}) ==="
docker compose -f docker-compose.staging.yml pull

echo "=== [3/5] Rolling update backend, frontend & caddy containers ==="
docker compose -f docker-compose.staging.yml up -d --no-deps backend frontend
docker compose -f docker-compose.staging.yml up -d caddy

echo "=== [4/5] Deploying observability stack (if present) ==="
if [ -f docker/docker-compose.observability.yml ]; then
  docker compose -f docker/docker-compose.observability.yml up -d
fi
docker exec hotelsaas-caddy caddy reload --config /etc/caddy/Caddyfile || true

echo "=== [5/5] Verifying /health and /health/ready probes at ${DOMAIN} ==="
if ! verify_health_probes; then
  echo "❌ Health or readiness check FAILED after 60s!" >&2
  docker logs --tail 80 hotelsaas-backend-api || true
  if [ -n "${PREV_BACKEND_IMG}" ] || [ -n "${PREV_FRONTEND_IMG}" ]; then
    echo "⚠️ Triggering automatic rollback to previous container images..." >&2
    restore_previous_images "${PREV_BACKEND_IMG}" "${PREV_FRONTEND_IMG}" || true
  fi
  echo "--- Container inventory AFTER failed deploy / rollback ---"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  exit 1
fi

echo "--- Container inventory AFTER deploy ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "✅ Deployment successfully verified on ${DOMAIN} (IMAGE_TAG=${IMAGE_TAG})!"
