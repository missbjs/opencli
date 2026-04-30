#!/usr/bin/env bash
# Installs a prepared OpenCLI npm tarball in Docker, runs non-interactive
# onboarding for a channel, and verifies one mocked model turn through Gateway.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
source "$ROOT_DIR/scripts/lib/docker-e2e-package.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "opencli-npm-onboard-channel-agent-e2e" OPENCLI_NPM_ONBOARD_E2E_IMAGE)"
DOCKER_TARGET="${OPENCLI_NPM_ONBOARD_DOCKER_TARGET:-bare}"
HOST_BUILD="${OPENCLI_NPM_ONBOARD_HOST_BUILD:-1}"
PACKAGE_TGZ="${OPENCLI_CURRENT_PACKAGE_TGZ:-}"
CHANNEL="${OPENCLI_NPM_ONBOARD_CHANNEL:-telegram}"

case "$CHANNEL" in
telegram | discord) ;;
*)
  echo "OPENCLI_NPM_ONBOARD_CHANNEL must be telegram or discord, got: $CHANNEL" >&2
  exit 1
  ;;
esac

docker_e2e_build_or_reuse "$IMAGE_NAME" npm-onboard-channel-agent "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "$DOCKER_TARGET"

prepare_package_tgz() {
  if [ -n "$PACKAGE_TGZ" ]; then
    PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz npm-onboard-channel-agent "$PACKAGE_TGZ")"
    return 0
  fi
  if [ "$HOST_BUILD" = "0" ] && [ -z "${OPENCLI_CURRENT_PACKAGE_TGZ:-}" ]; then
    echo "OPENCLI_NPM_ONBOARD_HOST_BUILD=0 requires OPENCLI_CURRENT_PACKAGE_TGZ" >&2
    exit 1
  fi
  PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz npm-onboard-channel-agent)"
}

prepare_package_tgz

docker_e2e_package_mount_args "$PACKAGE_TGZ"
run_log="$(docker_e2e_run_log npm-onboard-channel-agent)"
OPENCLI_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 npm-onboard-channel-agent empty)"

echo "Running npm tarball onboard/channel/agent Docker E2E ($CHANNEL)..."
if ! docker_e2e_run_with_harness \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e OPENCLI_NPM_ONBOARD_CHANNEL="$CHANNEL" \
  -e "OPENCLI_TEST_STATE_SCRIPT_B64=$OPENCLI_TEST_STATE_SCRIPT_B64" \
  "${DOCKER_E2E_PACKAGE_ARGS[@]}" \
  -i "$IMAGE_NAME" bash -s >"$run_log" 2>&1 <<'EOF'; then
set -euo pipefail

source scripts/lib/opencli-e2e-instance.sh
opencli_e2e_eval_test_state_from_b64 "${OPENCLI_TEST_STATE_SCRIPT_B64:?missing OPENCLI_TEST_STATE_SCRIPT_B64}"
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export OPENAI_API_KEY="sk-opencli-npm-onboard-e2e"
export OPENCLI_GATEWAY_TOKEN="npm-onboard-channel-agent-token"

CHANNEL="${OPENCLI_NPM_ONBOARD_CHANNEL:?missing OPENCLI_NPM_ONBOARD_CHANNEL}"
PORT="18789"
MOCK_PORT="44080"
SUCCESS_MARKER="OPENCLI_AGENT_E2E_OK_ASSISTANT"
MOCK_REQUEST_LOG="/tmp/opencli-mock-openai-requests.jsonl"
export SUCCESS_MARKER MOCK_REQUEST_LOG
mock_pid=""

case "$CHANNEL" in
  telegram)
    CHANNEL_TOKEN="123456:opencli-npm-onboard-token"
    DEP_SENTINEL="grammy"
    ;;
  discord)
    CHANNEL_TOKEN="opencli-npm-onboard-discord-token"
    DEP_SENTINEL="discord-api-types"
    ;;
  *)
    echo "unsupported channel: $CHANNEL" >&2
    exit 1
    ;;
esac

cleanup() {
  opencli_e2e_stop_process "${mock_pid:-}"
}
trap cleanup EXIT

dump_debug_logs() {
  local status="$1"
  echo "npm onboard/channel/agent scenario failed with exit code $status" >&2
  opencli_e2e_dump_logs \
    /tmp/opencli-install.log \
    /tmp/opencli-onboard.json \
    /tmp/opencli-channel-add.log \
    /tmp/opencli-doctor.log \
    /tmp/opencli-agent.combined \
    /tmp/opencli-agent.err \
    /tmp/opencli-agent.json \
    /tmp/opencli-mock-openai.log \
    "$MOCK_REQUEST_LOG"
}
trap 'status=$?; dump_debug_logs "$status"; exit "$status"' ERR

opencli_e2e_install_package /tmp/opencli-install.log

command -v opencli >/dev/null
package_root="$(opencli_e2e_package_root)"
opencli_e2e_assert_package_extensions "$package_root" telegram discord

mock_pid="$(opencli_e2e_start_mock_openai "$MOCK_PORT" /tmp/opencli-mock-openai.log)"
opencli_e2e_wait_mock_openai "$MOCK_PORT"

echo "Running non-interactive onboarding..."
opencli onboard --non-interactive --accept-risk \
  --mode local \
  --auth-choice openai-api-key \
  --secret-input-mode ref \
  --gateway-port "$PORT" \
  --gateway-bind loopback \
  --skip-daemon \
  --skip-ui \
  --skip-skills \
  --skip-health \
  --json >/tmp/opencli-onboard.json

node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-onboard-state "$HOME"
node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs configure-mock-model "$MOCK_PORT"

opencli_e2e_assert_dep_absent "$DEP_SENTINEL" "$package_root" "$HOME/.opencli"

echo "Configuring $CHANNEL..."
opencli channels add --channel "$CHANNEL" --token "$CHANNEL_TOKEN" >/tmp/opencli-channel-add.log 2>&1
node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-channel-config "$CHANNEL" "$CHANNEL_TOKEN"

echo "Running doctor after channel activation..."
opencli doctor --repair --non-interactive >/tmp/opencli-doctor.log 2>&1
opencli_e2e_assert_dep_present "$DEP_SENTINEL" "$package_root" "$HOME/.opencli"

echo "Running local agent turn against mocked OpenAI..."
opencli agent --local \
  --agent main \
  --session-id npm-onboard-channel-agent \
  --message "Return the success marker from the test server." \
  --thinking off \
  --json >/tmp/opencli-agent.combined 2>&1

node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-agent-turn "$SUCCESS_MARKER" "$MOCK_REQUEST_LOG"

echo "npm tarball onboard/channel/agent Docker E2E passed for $CHANNEL"
EOF
  docker_e2e_print_log "$run_log"
  rm -f "$run_log"
  exit 1
fi

rm -f "$run_log"
echo "npm tarball onboard/channel/agent Docker E2E passed ($CHANNEL)"
