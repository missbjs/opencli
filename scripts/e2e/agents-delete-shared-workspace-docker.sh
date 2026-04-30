#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "opencli-agents-delete-shared-workspace-e2e:local" OPENCLI_AGENTS_DELETE_SHARED_WORKSPACE_E2E_IMAGE)"
SKIP_BUILD="${OPENCLI_AGENTS_DELETE_SHARED_WORKSPACE_E2E_SKIP_BUILD:-0}"
DOCKER_COMMAND_TIMEOUT="${OPENCLI_AGENTS_DELETE_SHARED_WORKSPACE_DOCKER_COMMAND_TIMEOUT:-300s}"
OPENCLI_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 agents-delete-shared-workspace empty)"

docker_e2e_build_or_reuse "$IMAGE_NAME" agents-delete-shared-workspace "$ROOT_DIR/Dockerfile" "$ROOT_DIR" "" "$SKIP_BUILD"
docker_e2e_harness_mount_args

run_logged agents-delete-shared-workspace docker_e2e_docker_cmd run --rm \
  "${DOCKER_E2E_HARNESS_ARGS[@]}" \
  --entrypoint bash \
  -e OPENCLI_SKIP_CHANNELS=1 \
  -e OPENCLI_SKIP_PROVIDERS=1 \
  -e OPENCLI_SKIP_GMAIL_WATCHER=1 \
  -e OPENCLI_SKIP_CRON=1 \
  -e OPENCLI_SKIP_CANVAS_HOST=1 \
  -e OPENCLI_SKIP_BROWSER_CONTROL_SERVER=1 \
  -e OPENCLI_SKIP_ACPX_RUNTIME=1 \
  -e OPENCLI_SKIP_ACPX_RUNTIME_PROBE=1 \
  -e "OPENCLI_TEST_STATE_SCRIPT_B64=$OPENCLI_TEST_STATE_SCRIPT_B64" \
  "$IMAGE_NAME" \
  -lc '
set -euo pipefail
source scripts/lib/opencli-e2e-instance.sh

run_opencli() {
  if command -v opencli >/dev/null 2>&1; then
    opencli "$@"
    return
  fi
  if [ -f /app/opencli.mjs ]; then
    node /app/opencli.mjs "$@"
    return
  fi
  echo "opencli CLI not found in Docker image" >&2
  exit 1
}

opencli_e2e_eval_test_state_from_b64 "${OPENCLI_TEST_STATE_SCRIPT_B64:?missing OPENCLI_TEST_STATE_SCRIPT_B64}"
export SHARED_WORKSPACE="$HOME/workspace-shared"
output_file="$HOME/delete.json"
trap '\''rm -rf "$HOME"'\'' EXIT

mkdir -p "$OPENCLI_STATE_DIR" "$SHARED_WORKSPACE"
node scripts/e2e/lib/fixture.mjs agents-delete-config

run_opencli agents delete ops --force --json > "$output_file"

node scripts/e2e/lib/fixture.mjs agents-delete-assert "$output_file"
'
