#!/usr/bin/env bash
# ============================================================================
# Hotel SaaS Platform v2 — Automated Load Test Runner (SignalR Hub & VNPay)
# ============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
PROFILE="${1:-smoke}" # smoke | load | stress
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
  K6_CMD="docker run --rm -i --network=host -v $(pwd):/work -w /work grafana/k6:latest"
else
  K6_CMD="k6"
fi

EXTRA_ENV_ARGS=(-e BASE_URL="$BASE_URL" -e TEST_TIER="$PROFILE")
[ -n "${JWT_TOKEN:-}" ] && EXTRA_ENV_ARGS+=(-e JWT_TOKEN="$JWT_TOKEN")
[ -n "${PROPERTY_ID:-}" ] && EXTRA_ENV_ARGS+=(-e PROPERTY_ID="$PROPERTY_ID")
[ -n "${FORBIDDEN_PROPERTY_ID:-}" ] && EXTRA_ENV_ARGS+=(-e FORBIDDEN_PROPERTY_ID="$FORBIDDEN_PROPERTY_ID")
[ -n "${STAFF_EMAIL:-}" ] && EXTRA_ENV_ARGS+=(-e STAFF_EMAIL="$STAFF_EMAIL")
[ -n "${STAFF_PASSWORD:-}" ] && EXTRA_ENV_ARGS+=(-e STAFF_PASSWORD="$STAFF_PASSWORD")
[ -n "${VNP_TMN_CODE:-}" ] && EXTRA_ENV_ARGS+=(-e VNP_TMN_CODE="$VNP_TMN_CODE")
[ -n "${VNP_HASH_SECRET:-}" ] && EXTRA_ENV_ARGS+=(-e VNP_HASH_SECRET="$VNP_HASH_SECRET")
[ -n "${RESERVATION_ID:-}" ] && EXTRA_ENV_ARGS+=(-e RESERVATION_ID="$RESERVATION_ID")
[ -n "${RESERVATION_CODE:-}" ] && EXTRA_ENV_ARGS+=(-e RESERVATION_CODE="$RESERVATION_CODE")
[ -n "${LOOKUP_TOKEN:-}" ] && EXTRA_ENV_ARGS+=(-e LOOKUP_TOKEN="$LOOKUP_TOKEN")
[ -n "${AMOUNT_VND:-}" ] && EXTRA_ENV_ARGS+=(-e AMOUNT_VND="$AMOUNT_VND")

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
$K6_CMD run \
  "${EXTRA_ENV_ARGS[@]}" \
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
$K6_CMD run \
  "${EXTRA_ENV_ARGS[@]}" \
  --summary-export="${REPORT_DIR}/vnpay-summary-${PROFILE}.json" \
  scripts/load-tests/vnpay-checkout-ipn.k6.js
VNPAY_EXIT=$?
set -e
redact_summary_tokens "${REPORT_DIR}/vnpay-summary-${PROFILE}.json"
if [ "$VNPAY_EXIT" -ne 0 ]; then
  exit "$VNPAY_EXIT"
fi

echo "Load test suite completed. Reports saved to ${REPORT_DIR}/"
