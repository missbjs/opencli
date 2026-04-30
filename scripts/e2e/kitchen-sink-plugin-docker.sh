#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
IMAGE_NAME="$(docker_e2e_resolve_image "opencli-kitchen-sink-plugin-e2e" OPENCLI_KITCHEN_SINK_PLUGIN_E2E_IMAGE)"

docker_e2e_build_or_reuse "$IMAGE_NAME" kitchen-sink-plugin
OPENCLI_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 kitchen-sink-plugin empty)"

DEFAULT_KITCHEN_SINK_SCENARIOS="$(
  cat <<'SCENARIOS'
npm-latest-full|npm:@opencli/kitchen-sink@latest|opencli-kitchen-sink-fixture|npm|success|full
npm-latest-conformance|npm:@opencli/kitchen-sink@latest|opencli-kitchen-sink-fixture|npm|success|conformance|conformance
npm-latest-adversarial|npm:@opencli/kitchen-sink@latest|opencli-kitchen-sink-fixture|npm|success|adversarial|adversarial
npm-beta|npm:@opencli/kitchen-sink@beta|opencli-kitchen-sink-fixture|npm|failure|none
clawhub-latest|clawhub:opencli-kitchen-sink@latest|opencli-kitchen-sink-fixture|clawhub|success|basic
clawhub-beta|clawhub:opencli-kitchen-sink@beta|opencli-kitchen-sink-fixture|clawhub|failure|none
SCENARIOS
)"
KITCHEN_SINK_SCENARIOS="${OPENCLI_KITCHEN_SINK_PLUGIN_SCENARIOS:-$DEFAULT_KITCHEN_SINK_SCENARIOS}"
MAX_MEMORY_MIB="${OPENCLI_KITCHEN_SINK_MAX_MEMORY_MIB:-2048}"
MAX_CPU_PERCENT="${OPENCLI_KITCHEN_SINK_MAX_CPU_PERCENT:-1200}"
CONTAINER_NAME="opencli-kitchen-sink-plugin-e2e-$$"
RUN_LOG="$(mktemp "${TMPDIR:-/tmp}/opencli-kitchen-sink-plugin.XXXXXX")"
STATS_LOG="$(mktemp "${TMPDIR:-/tmp}/opencli-kitchen-sink-plugin-stats.XXXXXX")"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

DOCKER_ENV_ARGS=(
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  -e "OPENCLI_TEST_STATE_SCRIPT_B64=$OPENCLI_TEST_STATE_SCRIPT_B64"
  -e "KITCHEN_SINK_SCENARIOS=$KITCHEN_SINK_SCENARIOS"
)
for env_name in \
  OPENCLI_KITCHEN_SINK_LIVE_CLAWHUB \
  OPENCLI_CLAWHUB_URL \
  CLAWHUB_URL \
  OPENCLI_CLAWHUB_TOKEN \
  CLAWHUB_TOKEN \
  CLAWHUB_AUTH_TOKEN; do
  env_value="${!env_name:-}"
  if [[ -n "$env_value" && "$env_value" != "undefined" && "$env_value" != "null" ]]; then
    DOCKER_ENV_ARGS+=(-e "$env_name")
  fi
done

echo "Running kitchen-sink plugin Docker E2E..."
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker_e2e_harness_mount_args
docker run --name "$CONTAINER_NAME" "${DOCKER_E2E_HARNESS_ARGS[@]}" "${DOCKER_ENV_ARGS[@]}" -i "$IMAGE_NAME" bash scripts/e2e/lib/kitchen-sink-plugin/sweep.sh \
  >"$RUN_LOG" 2>&1 &
docker_pid="$!"

while kill -0 "$docker_pid" 2>/dev/null; do
  if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker stats --no-stream --format '{{json .}}' "$CONTAINER_NAME" >>"$STATS_LOG" 2>/dev/null || true
  fi
  sleep 2
done

set +e
wait "$docker_pid"
run_status="$?"
set -e

cat "$RUN_LOG"

node scripts/e2e/lib/docker-stats/assert-resource-ceiling.mjs "$STATS_LOG" "$MAX_MEMORY_MIB" "$MAX_CPU_PERCENT" kitchen-sink

rm -f "$RUN_LOG" "$STATS_LOG"
exit "$run_status"
