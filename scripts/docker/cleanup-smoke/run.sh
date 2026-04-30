#!/usr/bin/env bash
set -euo pipefail

cd /repo

export OPENCLI_STATE_DIR="/tmp/opencli-test"
export OPENCLI_CONFIG_PATH="${OPENCLI_STATE_DIR}/opencli.json"

echo "==> Build"
if ! pnpm build >/tmp/opencli-cleanup-build.log 2>&1; then
  cat /tmp/opencli-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${OPENCLI_STATE_DIR}/credentials"
mkdir -p "${OPENCLI_STATE_DIR}/agents/main/sessions"
echo '{}' >"${OPENCLI_CONFIG_PATH}"
echo 'creds' >"${OPENCLI_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${OPENCLI_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm opencli reset --scope config+creds+sessions --yes --non-interactive >/tmp/opencli-cleanup-reset.log 2>&1; then
  cat /tmp/opencli-cleanup-reset.log
  exit 1
fi

test ! -f "${OPENCLI_CONFIG_PATH}"
test ! -d "${OPENCLI_STATE_DIR}/credentials"
test ! -d "${OPENCLI_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${OPENCLI_STATE_DIR}/credentials"
echo '{}' >"${OPENCLI_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm opencli uninstall --state --yes --non-interactive >/tmp/opencli-cleanup-uninstall.log 2>&1; then
  cat /tmp/opencli-cleanup-uninstall.log
  exit 1
fi

test ! -d "${OPENCLI_STATE_DIR}"

echo "OK"
