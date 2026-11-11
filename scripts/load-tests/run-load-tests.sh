#!/usr/bin/env bash
# ============================================================================
# Hotel SaaS Platform v2 — Automated Load Test Runner (SignalR Hub & VNPay)
# ============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
PROFILE="${1:-smoke}" # smoke | load | stress
REPORT_DIR="./docs/reports/load-tests"
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

echo "[1/2] Running SignalR NotificationHub WebSocket & Multi-Branch Isolation Load Test..."
$K6_CMD run \
  -e BASE_URL="$BASE_URL" \
  --summary-export="${REPORT_DIR}/signalr-summary-${PROFILE}.json" \
  scripts/load-tests/signalr-hub.k6.js

echo "[2/2] Running VNPay Checkout & IPN Concurrency Storm Load Test..."
$K6_CMD run \
  -e BASE_URL="$BASE_URL" \
  --summary-export="${REPORT_DIR}/vnpay-summary-${PROFILE}.json" \
  scripts/load-tests/vnpay-checkout-ipn.k6.js

echo "✅ Load test suite completed. Reports saved to ${REPORT_DIR}/"
