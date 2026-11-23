#!/usr/bin/env bash
# ============================================================================
# Hotel SaaS Platform v2 — Automated Load Test Runner (SignalR Hub & VNPay)
# ============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
PROFILE="${TEST_TIER:-${1:-smoke}}" # smoke | load | stress
REPORT_DIR="./docs/reports/load-tests"

case "$PROFILE" in
  smoke|load|stress) ;;
  *)
    echo "[ERROR] Invalid profile '$PROFILE'. Expected: smoke | load | stress" >&2
    exit 1
    ;;
esac

mkdir -p "$REPORT_DIR"

echo "=================================================================="
echo " Hotel SaaS v2 Load Test Suite — Profile: ${PROFILE^^}"
echo " Target API: ${BASE_URL}"
echo "=================================================================="

if ! command -v k6 >/dev/null 2>&1; then
  echo "[INFO] k6 binary not found locally. Executing via grafana/k6 Docker container..."
  K6_CMD=(docker run --rm -i --network=host -v "$(pwd):/work" -w /work grafana/k6:latest)
else
  K6_CMD=(k6)
fi

K6_ENV_VARS=("BASE_URL=$BASE_URL" "TEST_TIER=$PROFILE")
K6_DOCKER_ENV_ARGS=(-e "BASE_URL=$BASE_URL" -e "TEST_TIER=$PROFILE")
for name in JWT_TOKEN PROPERTY_ID FORBIDDEN_PROPERTY_ID STAFF_EMAIL STAFF_PASSWORD TEST_EMAIL TEST_PASSWORD VNP_TMN_CODE VNP_HASH_SECRET RESERVATION_ID RESERVATION_CODE LOOKUP_TOKEN AMOUNT_VND FIREBASE_ID_TOKEN FIREBASE_ID_TOKEN_CHECKOUT FIREBASE_ID_TOKEN_IPN; do
  if [ -n "${!name:-}" ]; then
    K6_ENV_VARS+=("$name=${!name}")
    K6_DOCKER_ENV_ARGS+=(-e "$name=${!name}")
  fi
done

if [[ "$BASE_URL" == https://* && "$PROFILE" != smoke ]]; then
  echo "[WARN] Running ${PROFILE} against a remote HTTPS host can affect shared staging capacity."
  echo "       Set ALLOW_REMOTE_LOAD_TEST=true to confirm this run." >&2
  if [ "${ALLOW_REMOTE_LOAD_TEST:-false}" != true ]; then
    exit 2
  fi
fi

redact_summary_tokens() {
  local summary_file="$1"
  [ -f "$summary_file" ] || return 0
  local tmp_file
  tmp_file="$(mktemp)"
  sed -E 's/("(token|checkoutLookupToken)"[[:space:]]*:[[:space:]]*)"[^"]*"/\1"<redacted>"/g' "$summary_file" > "$tmp_file"
  mv "$tmp_file" "$summary_file"
}

echo "[1/2] Running SignalR NotificationHub WebSocket & Multi-Branch Isolation Load Test..."
set +e
if [ "${K6_CMD[0]}" = docker ]; then
  K6_RUN_PREFIX=("${K6_CMD[@]}" "${K6_DOCKER_ENV_ARGS[@]}" run)
else
  K6_RUN_PREFIX=(env "${K6_ENV_VARS[@]}" "${K6_CMD[@]}" run)
fi

"${K6_RUN_PREFIX[@]}" \
  --summary-export="${REPORT_DIR}/signalr-summary-${PROFILE}.json" \
  scripts/load-tests/signalr-hub.k6.js
SIGNALR_EXIT=$?
set -e
redact_summary_tokens "${REPORT_DIR}/signalr-summary-${PROFILE}.json"
if [ "$SIGNALR_EXIT" -ne 0 ]; then
  exit "$SIGNALR_EXIT"
fi

echo "[2/2] Running VNPay Checkout & IPN Concurrency Storm Load Test..."
set +e
"${K6_RUN_PREFIX[@]}" \
  --summary-export="${REPORT_DIR}/vnpay-summary-${PROFILE}.json" \
  scripts/load-tests/vnpay-checkout-ipn.k6.js
VNPAY_EXIT=$?
set -e
redact_summary_tokens "${REPORT_DIR}/vnpay-summary-${PROFILE}.json"
if [ "$VNPAY_EXIT" -ne 0 ]; then
  exit "$VNPAY_EXIT"
fi

echo "Load test suite completed. Reports saved to ${REPORT_DIR}/"
