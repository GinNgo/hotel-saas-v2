#!/usr/bin/env bash
set -euo pipefail

cd /opt/hotel-saas

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

can_write_dir() {
  [ "$(id -u)" -eq 0 ] || [ -w "$1" ]
}

read_file_safe() {
  local file="$1"
  if [ -r "${file}" ]; then
    cat "${file}"
  elif [ "$(id -u)" -ne 0 ]; then
    sudo cat "${file}"
  fi
}

read_env_value() {
  local key="$1"
  local file="${2:-.env}"
  if [ ! -f "${file}" ] && ! sudo test -f "${file}" 2>/dev/null; then
    return 0
  fi
  local line
  line=$(read_file_safe "${file}" | grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" | tail -n 1 || true)
  if [ -z "${line}" ]; then
    return 0
  fi
  local val="${line#*=}"
  val="${val%$'\r'}"
  val="${val#\"}"
  val="${val%\"}"
  val="${val#\'}"
  val="${val%\'}"
  printf '%s' "${val}"
}

upsert_env_value() {
  local key="$1"
  local val="$2"
  local file="${3:-.env}"
  local tmp
  tmp="$(mktemp)"

  if [ -f "${file}" ] || sudo test -f "${file}" 2>/dev/null; then
    read_file_safe "${file}" | grep -vE "^[[:space:]]*(export[[:space:]]+)?${key}=" > "${tmp}" || true
  fi

  if printf '%s' "${val}" | grep -q '[[:space:]]'; then
    printf '%s="%s"\n' "${key}" "${val}" >> "${tmp}"
  else
    printf '%s=%s\n' "${key}" "${val}" >> "${tmp}"
  fi

  if can_write_dir "$(dirname "${file}")" && { [ ! -e "${file}" ] || [ -w "${file}" ]; }; then
    mv "${tmp}" "${file}"
    chmod 600 "${file}"
  else
    run_privileged mv "${tmp}" "${file}"
    run_privileged chmod 600 "${file}"
    run_privileged chown "$(id -un):$(id -gn)" "${file}" || true
  fi
}

sync_metrics_key_file() {
  local key_file="$1"
  local key_value="$2"
  local key_dir
  key_dir="$(dirname "${key_file}")"

  if can_write_dir "${key_dir}"; then
    mkdir -p "${key_dir}"
    printf '%s' "${key_value}" > "${key_file}"
    chmod 644 "${key_file}"
  else
    sudo mkdir -p "${key_dir}"
    printf '%s' "${key_value}" | sudo tee "${key_file}" >/dev/null
    sudo chmod 644 "${key_file}"
  fi
}

patch_caddyfile_geolocation() {
  local f="$1"
  if [ ! -f "${f}" ] && ! sudo test -f "${f}" 2>/dev/null; then
    return 1
  fi
  if ! read_file_safe "${f}" | grep -qi 'geolocation=()'; then
    return 1
  fi

  local tmp
  tmp="$(mktemp)"
  read_file_safe "${f}" | sed -E 's/geolocation=\(\)/geolocation=(self)/g' > "${tmp}"

  if [ -w "${f}" ]; then
    cp "${f}" "${f}.bak"
    cat "${tmp}" > "${f}"
  else
    run_privileged cp "${f}" "${f}.bak"
    run_privileged tee "${f}" < "${tmp}" >/dev/null
  fi

  rm -f "${tmp}"
  return 0
}

if [ -z "${IMAGE_TAG:-}" ]; then
  echo "❌ IMAGE_TAG is empty; refusing to deploy bare :latest!"
  exit 1
fi

echo "[0/6] Ensuring VPS .env hygiene (JWT secret & SePay/SMTP sync)..."
if can_write_dir "/opt/hotel-saas"; then
  touch .env
  cp .env .env.bak
  chmod 600 .env .env.bak
else
  run_privileged touch .env
  run_privileged cp .env .env.bak
  run_privileged chmod 600 .env .env.bak
  run_privileged chown "$(id -un):$(id -gn)" .env .env.bak || true
fi

CURRENT_JWT="$(read_env_value JWT_SECRET_KEY .env)"
LOWER_JWT="$(printf '%s' "${CURRENT_JWT}" | tr '[:upper:]' '[:lower:]')"
NEED_JWT_ROTATE=0
if [ -z "${CURRENT_JWT}" ] || [ "${#CURRENT_JWT}" -lt 32 ]; then
  NEED_JWT_ROTATE=1
fi
if [ "${CURRENT_JWT}" = "DevOnly_SuperSecretKey_ChangeInProduction_AtLeast32Chars!" ] || \
   [ "${CURRENT_JWT}" = "HotelSaasPlatform2026EnterpriseSuperSecretKey32BytesLong!" ] || \
   [ "${CURRENT_JWT}" = "YourSuperSecretKeyMustBeAtLeast32CharactersLongForJwt!" ]; then
  NEED_JWT_ROTATE=1
fi
if printf '%s' "${LOWER_JWT}" | grep -qE 'devonly|changeinproduction'; then
  NEED_JWT_ROTATE=1
fi
if [ "${NEED_JWT_ROTATE}" -eq 1 ]; then
  NEW_JWT="$(openssl rand -base64 48 | tr -d '\n')"
  upsert_env_value JWT_SECRET_KEY "${NEW_JWT}" .env
  echo "✔ Rotated placeholder JWT_SECRET_KEY on VPS (.env backed up to .env.bak)"
else
  echo "✔ Existing JWT_SECRET_KEY passed production guard."
fi

export JWT_SECRET_KEY="$(read_env_value JWT_SECRET_KEY .env)"
echo "✔ Effective JWT_SECRET_KEY length: ${#JWT_SECRET_KEY} chars"

LEGACY_JWT_SECRET="$(read_env_value JWT_SECRET .env)"
if [ -n "${LEGACY_JWT_SECRET}" ]; then
  upsert_env_value JWT_SECRET "${JWT_SECRET_KEY}" .env
  export JWT_SECRET="${JWT_SECRET_KEY}"
fi

SYNCED_COUNT=0
if [ -n "${SEPAY_API_KEY:-}" ]; then
  upsert_env_value SEPAY_API_KEY "${SEPAY_API_KEY}" .env
  SYNCED_COUNT=$((SYNCED_COUNT + 1))
fi
if [ -n "${SEPAY_PLATFORM_BANK_NAME:-}" ]; then
  upsert_env_value SEPAY_PLATFORM_BANK_NAME "${SEPAY_PLATFORM_BANK_NAME}" .env
  SYNCED_COUNT=$((SYNCED_COUNT + 1))
fi
if [ -n "${SEPAY_PLATFORM_ACCOUNT:-}" ]; then
  upsert_env_value SEPAY_PLATFORM_ACCOUNT "${SEPAY_PLATFORM_ACCOUNT}" .env
  SYNCED_COUNT=$((SYNCED_COUNT + 1))
fi
if [ -n "${SEPAY_PLATFORM_ACCOUNT_HOLDER:-}" ]; then
  upsert_env_value SEPAY_PLATFORM_ACCOUNT_HOLDER "${SEPAY_PLATFORM_ACCOUNT_HOLDER}" .env
  SYNCED_COUNT=$((SYNCED_COUNT + 1))
fi
if [ -n "${SMTP_USERNAME:-}" ]; then
  upsert_env_value SMTP_USERNAME "${SMTP_USERNAME}" .env
  SYNCED_COUNT=$((SYNCED_COUNT + 1))
fi
if [ -n "${SMTP_PASSWORD:-}" ]; then
  upsert_env_value SMTP_PASSWORD "${SMTP_PASSWORD}" .env
  SYNCED_COUNT=$((SYNCED_COUNT + 1))
fi
echo "✔ Synced ${SYNCED_COUNT} SePay/SMTP environment variable(s) into VPS .env."

echo "[1/6] Authenticating Docker with GHCR on VPS..."
printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin

echo "[2/6] Pulling immutable images (${IMAGE_TAG}) from GHCR..."
IMAGE_TAG="${IMAGE_TAG}" docker compose --env-file .env -f docker-compose.staging.yml pull

echo "[3/6] Gracefully rolling update backend & frontend containers (${IMAGE_TAG})..."
if [ -f deploy/docker-compose.staging.override.yml ]; then
  IMAGE_TAG="${IMAGE_TAG}" docker compose --env-file .env -f docker-compose.staging.yml -f deploy/docker-compose.staging.override.yml up -d --no-deps backend frontend
else
  IMAGE_TAG="${IMAGE_TAG}" docker compose --env-file .env -f docker-compose.staging.yml up -d --no-deps backend frontend
fi

echo "[4/6] Deploying observability stack (if GF_SECURITY_ADMIN_PASSWORD is configured)..."
if [ -f docker/docker-compose.observability.yml ]; then
  EFFECTIVE_GF_PASSWORD="${GF_SECURITY_ADMIN_PASSWORD:-$(read_env_value GF_SECURITY_ADMIN_PASSWORD .env)}"
  EFFECTIVE_METRICS_KEY="${METRICS_API_KEY:-$(read_env_value METRICS_API_KEY .env)}"
  METRICS_KEY_FILE="${PROMETHEUS_METRICS_KEY_FILE:-$(read_env_value PROMETHEUS_METRICS_KEY_FILE .env)}"
  METRICS_KEY_FILE="${METRICS_KEY_FILE:-/etc/hotelsaas/metrics_api_key}"

  if [ -z "${EFFECTIVE_GF_PASSWORD}" ]; then
    echo "ℹ️ Skipping observability stack deploy: GF_SECURITY_ADMIN_PASSWORD is not set in /opt/hotel-saas/.env."
  else
    if [ -n "${EFFECTIVE_METRICS_KEY}" ]; then
      sync_metrics_key_file "${METRICS_KEY_FILE}" "${EFFECTIVE_METRICS_KEY}"
      echo "✔ Synced Prometheus metrics key file: ${METRICS_KEY_FILE} (mode 644)"
    elif [ ! -f "${METRICS_KEY_FILE}" ]; then
      sync_metrics_key_file "${METRICS_KEY_FILE}" ""
      echo "⚠️ METRICS_API_KEY not set in .env; initialized empty ${METRICS_KEY_FILE} so Prometheus can start."
    fi

    docker compose --env-file .env -f docker/docker-compose.observability.yml up -d
  fi
fi

echo "[5/6] Auto-discovering Caddy & patching Permissions-Policy geolocation=(self)..."
CADDY_HANDLED=0

CADDY_CONTAINER="$(docker ps --format '{{.Names}}\t{{.Image}}' | awk 'tolower($1) ~ /caddy/ || tolower($2) ~ /caddy/ {print $1; exit}' || true)"
if [ -n "${CADDY_CONTAINER}" ]; then
  CADDY_HANDLED=1
  CADDY_HOST_FILE="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "${CADDY_CONTAINER}" 2>/dev/null || true)"
  echo "✔ Found Caddy Docker container: ${CADDY_CONTAINER} (host config: ${CADDY_HOST_FILE:-<none>})"
  if [ -n "${CADDY_HOST_FILE}" ] && patch_caddyfile_geolocation "${CADDY_HOST_FILE}"; then
    if ! docker exec "${CADDY_CONTAINER}" caddy validate --config /etc/caddy/Caddyfile; then
      echo "❌ Patched Caddyfile failed validation; restoring ${CADDY_HOST_FILE}.bak..." >&2
      if [ -f "${CADDY_HOST_FILE}.bak" ] || sudo test -f "${CADDY_HOST_FILE}.bak" 2>/dev/null; then
        if [ -w "${CADDY_HOST_FILE}" ]; then
          cat "${CADDY_HOST_FILE}.bak" > "${CADDY_HOST_FILE}"
        else
          run_privileged tee "${CADDY_HOST_FILE}" < "${CADDY_HOST_FILE}.bak" >/dev/null
        fi
      fi
      exit 1
    fi
    docker exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile
    echo "✔ Patched geolocation=(self) in ${CADDY_HOST_FILE} and reloaded ${CADDY_CONTAINER}."
  else
    docker exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile || echo "⚠️ Caddy reload returned non-zero (continuing)"
  fi
fi

if [ -f /etc/caddy/Caddyfile ] || sudo test -f /etc/caddy/Caddyfile 2>/dev/null; then
  CADDY_HANDLED=1
  echo "✔ Found host Caddyfile: /etc/caddy/Caddyfile"
  if patch_caddyfile_geolocation "/etc/caddy/Caddyfile"; then
    if command -v caddy >/dev/null 2>&1; then
      if ! run_privileged caddy validate --config /etc/caddy/Caddyfile; then
        echo "❌ Patched /etc/caddy/Caddyfile failed validation; restoring backup..." >&2
        if [ -f /etc/caddy/Caddyfile.bak ] || sudo test -f /etc/caddy/Caddyfile.bak 2>/dev/null; then
          run_privileged tee /etc/caddy/Caddyfile < /etc/caddy/Caddyfile.bak >/dev/null
        fi
        exit 1
      fi
    fi
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet caddy 2>/dev/null; then
      run_privileged systemctl reload caddy
      echo "✔ Patched geolocation=(self) in /etc/caddy/Caddyfile and reloaded systemd caddy."
    elif command -v caddy >/dev/null 2>&1; then
      run_privileged caddy reload --config /etc/caddy/Caddyfile
      echo "✔ Patched geolocation=(self) in /etc/caddy/Caddyfile and reloaded host caddy."
    fi
  fi
fi

if [ "${CADDY_HANDLED}" -eq 0 ]; then
  echo "ℹ️ No Caddy container or host /etc/caddy/Caddyfile found in standard locations."
fi

echo "[6/6] Verifying health probes..."
HEALTHY=0
for i in $(seq 1 20); do
  if curl -sk https://luxustay.duckdns.org/health | grep -q '"status":"healthy"'; then
    READY_CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://luxustay.duckdns.org/health/ready || echo "000")
    if [ "$READY_CODE" = "200" ]; then
      HEALTHY=1
      break
    fi
  fi
  echo "Waiting for health check probe ($i/20)..."
  sleep 3
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "❌ Health check (/health & /health/ready) failed after 60 seconds!"
  echo "--- Compose JWT lines (values redacted) ---"
  grep -iE 'jwt|env_file' docker-compose.staging.yml | sed 's/=.*/=<REDACTED>/' || true
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' hotelsaas-backend-api | grep -i jwt | awk -F= '{print $1 " (len=" length($2) ")"}' || true
  docker logs --tail 80 hotelsaas-backend-api || true
  exit 1
fi

PERM_HEADER="$(curl -skI https://luxustay.duckdns.org/booking | grep -i '^permissions-policy:' | tr -d '\r' || true)"
echo "✔ Live header: ${PERM_HEADER:-<none>}"
if printf '%s' "${PERM_HEADER}" | grep -qi 'geolocation=()'; then
  echo "❌ Live Permissions-Policy still blocks geolocation=(): ${PERM_HEADER}" >&2
  echo "--- Diagnostics ---" >&2
  docker ps --format '{{.Names}} ({{.Image}})' >&2 || true
  systemctl is-active caddy >&2 || true
  grep -rli 'Permissions-Policy' /etc/caddy /opt/hotel-saas 2>/dev/null >&2 || sudo grep -rli 'Permissions-Policy' /etc/caddy /opt/hotel-saas 2>/dev/null >&2 || true
  exit 1
fi

echo "✅ Hotel SaaS Platform deployment verified (/health & /health/ready == 200)!"
