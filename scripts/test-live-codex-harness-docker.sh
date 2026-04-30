#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="${OPENCLI_LIVE_DOCKER_REPO_ROOT:-$SCRIPT_ROOT_DIR}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
TRUSTED_HARNESS_DIR="${OPENCLI_LIVE_DOCKER_TRUSTED_HARNESS_DIR:-${OPENCLI_LIVE_CODEX_TRUSTED_HARNESS_DIR:-$SCRIPT_ROOT_DIR}}"
if [[ -z "$TRUSTED_HARNESS_DIR" || ! -d "$TRUSTED_HARNESS_DIR" ]]; then
  echo "ERROR: trusted Codex harness directory not found: ${TRUSTED_HARNESS_DIR:-<empty>}." >&2
  exit 1
fi
TRUSTED_HARNESS_DIR="$(cd "$TRUSTED_HARNESS_DIR" && pwd)"
source "$TRUSTED_HARNESS_DIR/scripts/lib/live-docker-auth.sh"
IMAGE_NAME="${OPENCLI_IMAGE:-opencli:local}"
LIVE_IMAGE_NAME="${OPENCLI_LIVE_IMAGE:-${IMAGE_NAME}-live}"
CONFIG_DIR="${OPENCLI_CONFIG_DIR:-$HOME/.opencli}"
WORKSPACE_DIR="${OPENCLI_WORKSPACE_DIR:-$HOME/.opencli/workspace}"
PROFILE_FILE="${OPENCLI_PROFILE_FILE:-$HOME/.profile}"
CODEX_HARNESS_AUTH_MODE="${OPENCLI_LIVE_CODEX_HARNESS_AUTH:-codex-auth}"
TEMP_DIRS=()
DOCKER_USER="${OPENCLI_DOCKER_USER:-node}"
DOCKER_HOME_MOUNT=()
DOCKER_TRUSTED_HARNESS_MOUNT=()
DOCKER_TRUSTED_HARNESS_CONTAINER_DIR=""
DOCKER_EXTRA_ENV_FILES=()
DOCKER_AUTH_PRESTAGED=0

opencli_live_codex_harness_append_build_extension() {
  local extension="${1:?extension required}"
  local current="${OPENCLI_DOCKER_BUILD_EXTENSIONS:-${OPENCLI_EXTENSIONS:-}}"
  case " $current " in
    *" $extension "*)
      ;;
    *)
      export OPENCLI_DOCKER_BUILD_EXTENSIONS="${current:+$current }$extension"
      ;;
  esac
}

case "$CODEX_HARNESS_AUTH_MODE" in
  codex-auth | api-key)
    ;;
  *)
    echo "ERROR: OPENCLI_LIVE_CODEX_HARNESS_AUTH must be one of: codex-auth, api-key." >&2
    exit 1
    ;;
esac

if [[ "$CODEX_HARNESS_AUTH_MODE" == "api-key" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "ERROR: OPENCLI_LIVE_CODEX_HARNESS_AUTH=api-key requires OPENAI_API_KEY." >&2
  exit 1
fi

cleanup_temp_dirs() {
  if ((${#TEMP_DIRS[@]} > 0)); then
    rm -rf "${TEMP_DIRS[@]}"
  fi
}
trap cleanup_temp_dirs EXIT

if [[ -n "${OPENCLI_DOCKER_CLI_TOOLS_DIR:-}" ]]; then
  CLI_TOOLS_DIR="${OPENCLI_DOCKER_CLI_TOOLS_DIR}"
elif [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  CLI_TOOLS_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/opencli-docker-cli-tools.XXXXXX")"
  TEMP_DIRS+=("$CLI_TOOLS_DIR")
else
  CLI_TOOLS_DIR="$HOME/.cache/opencli/docker-cli-tools"
fi
if [[ -n "${OPENCLI_DOCKER_CACHE_HOME_DIR:-}" ]]; then
  CACHE_HOME_DIR="${OPENCLI_DOCKER_CACHE_HOME_DIR}"
elif [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  CACHE_HOME_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/opencli-docker-cache.XXXXXX")"
  TEMP_DIRS+=("$CACHE_HOME_DIR")
else
  CACHE_HOME_DIR="$HOME/.cache/opencli/docker-cache"
fi

mkdir -p "$CLI_TOOLS_DIR"
mkdir -p "$CACHE_HOME_DIR"
if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  DOCKER_USER="$(id -u):$(id -g)"
  DOCKER_HOME_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/opencli-docker-home.XXXXXX")"
  TEMP_DIRS+=("$DOCKER_HOME_DIR")
  DOCKER_HOME_MOUNT=(-v "$DOCKER_HOME_DIR":/home/node)
fi

PROFILE_MOUNT=()
PROFILE_STATUS="none"
if [[ -f "$PROFILE_FILE" && -r "$PROFILE_FILE" ]]; then
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
  PROFILE_STATUS="$PROFILE_FILE"
fi

DOCKER_TRUSTED_HARNESS_CONTAINER_DIR="/trusted-harness"
DOCKER_TRUSTED_HARNESS_MOUNT=(-v "$TRUSTED_HARNESS_DIR":"$DOCKER_TRUSTED_HARNESS_CONTAINER_DIR":ro)

AUTH_FILES=()
if [[ "$CODEX_HARNESS_AUTH_MODE" != "api-key" ]]; then
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(opencli_live_collect_auth_files_from_csv "openai-codex")
fi

AUTH_FILES_CSV=""
if ((${#AUTH_FILES[@]} > 0)); then
  AUTH_FILES_CSV="$(opencli_live_join_csv "${AUTH_FILES[@]}")"
fi

if [[ -n "${DOCKER_HOME_DIR:-}" ]]; then
  opencli_live_stage_auth_into_home "$DOCKER_HOME_DIR" --files "${AUTH_FILES[@]}"
  DOCKER_AUTH_PRESTAGED=1
fi

EXTERNAL_AUTH_MOUNTS=()
if ((${#AUTH_FILES[@]} > 0)); then
  for auth_file in "${AUTH_FILES[@]}"; do
    auth_file="$(opencli_live_validate_relative_home_path "$auth_file")"
    host_path="$HOME/$auth_file"
    if [[ -f "$host_path" ]]; then
      EXTERNAL_AUTH_MOUNTS+=(-v "$host_path":/host-auth-files/"$auth_file":ro)
    fi
  done
fi

DOCKER_AUTH_ENV=()
if [[ "$CODEX_HARNESS_AUTH_MODE" == "api-key" ]]; then
  docker_env_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/opencli-codex-harness-env.XXXXXX")"
  TEMP_DIRS+=("$docker_env_dir")
  docker_env_file="$docker_env_dir/openai.env"
  {
    printf 'OPENAI_API_KEY=%s\n' "${OPENAI_API_KEY}"
    if [[ -n "${OPENAI_BASE_URL:-}" ]]; then
      printf 'OPENAI_BASE_URL=%s\n' "${OPENAI_BASE_URL}"
    fi
  } >"$docker_env_file"
  DOCKER_EXTRA_ENV_FILES+=(--env-file "$docker_env_file")
fi

read -r -d '' LIVE_TEST_CMD <<'EOF' || true
set -euo pipefail
[ -f "$HOME/.profile" ] && [ -r "$HOME/.profile" ] && source "$HOME/.profile" || true
export NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$HOME/.npm-global}"
export npm_config_prefix="$NPM_CONFIG_PREFIX"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export COREPACK_HOME="${COREPACK_HOME:-$XDG_CACHE_HOME/node/corepack}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$XDG_CACHE_HOME/npm}"
export npm_config_cache="$NPM_CONFIG_CACHE"
# Force the Codex harness to use the staged `~/.codex` auth files. This lane
# is not meant to exercise raw OpenAI API-key routing unless the lane
# explicitly opts into API-key auth for CI.
if [ "${OPENCLI_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" != "api-key" ]; then
  unset OPENAI_API_KEY OPENAI_BASE_URL
fi
mkdir -p "$NPM_CONFIG_PREFIX" "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE"
chmod 700 "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE" || true
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
if [ "${OPENCLI_DOCKER_AUTH_PRESTAGED:-0}" != "1" ]; then
  IFS=',' read -r -a auth_files <<<"${OPENCLI_DOCKER_AUTH_FILES_RESOLVED:-}"
  if ((${#auth_files[@]} > 0)); then
    for auth_file in "${auth_files[@]}"; do
      [ -n "$auth_file" ] || continue
      if [ -f "/host-auth-files/$auth_file" ]; then
        mkdir -p "$(dirname "$HOME/$auth_file")"
        cp "/host-auth-files/$auth_file" "$HOME/$auth_file"
        chmod u+rw "$HOME/$auth_file" || true
      fi
    done
  fi
fi
if [ "${OPENCLI_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" != "api-key" ] && [ ! -s "$HOME/.codex/auth.json" ]; then
  echo "ERROR: missing ~/.codex/auth.json for Codex harness live test." >&2
  exit 1
fi
trusted_scripts_dir="${OPENCLI_LIVE_DOCKER_SCRIPTS_DIR:-/src/scripts}"
if [ "${OPENCLI_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" != "api-key" ]; then
  node --import tsx "$trusted_scripts_dir/prepare-codex-ci-auth.ts" "$HOME/.codex/auth.json"
fi
if [ ! -x "$NPM_CONFIG_PREFIX/bin/codex" ]; then
  npm install -g @openai/codex
fi
if [ "${OPENCLI_LIVE_CODEX_HARNESS_AUTH:-codex-auth}" = "api-key" ]; then
  printf '%s\n' "$OPENAI_API_KEY" | "$NPM_CONFIG_PREFIX/bin/codex" login --with-api-key >/dev/null
fi
tmp_dir="$(mktemp -d)"
source "$trusted_scripts_dir/lib/live-docker-stage.sh"
opencli_live_stage_source_tree "$tmp_dir"
opencli_live_stage_node_modules "$tmp_dir"
opencli_live_link_runtime_tree "$tmp_dir"
opencli_live_stage_state_dir "$tmp_dir/.opencli-state"
if [ -n "${OPENCLI_LIVE_CODEX_TRUSTED_HARNESS_DIR:-}" ] && [ -d "$OPENCLI_LIVE_CODEX_TRUSTED_HARNESS_DIR" ]; then
  for harness_file in src/gateway/gateway-codex-harness.live-helpers.ts; do
    if [ -f "$OPENCLI_LIVE_CODEX_TRUSTED_HARNESS_DIR/$harness_file" ]; then
      mkdir -p "$(dirname "$tmp_dir/$harness_file")"
      cp "$OPENCLI_LIVE_CODEX_TRUSTED_HARNESS_DIR/$harness_file" "$tmp_dir/$harness_file"
    fi
  done
fi
opencli_live_prepare_staged_config
cd "$tmp_dir"
if [ "${OPENCLI_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG:-1}" = "1" ]; then
  node --import tsx "$trusted_scripts_dir/prepare-codex-ci-config.ts" "$HOME/.codex/config.toml" "$tmp_dir"
fi
codex_preflight_log="$tmp_dir/codex-preflight.log"
codex_preflight_token="CODEX-PREFLIGHT-OK"
if ! "$NPM_CONFIG_PREFIX/bin/codex" exec \
  --json \
  --color never \
  --skip-git-repo-check \
  "Reply exactly: $codex_preflight_token" >"$codex_preflight_log" 2>&1; then
  if grep -q "Failed to extract accountId from token" "$codex_preflight_log"; then
    echo "SKIP: Codex auth cannot extract accountId from the available token; skipping live Codex harness lane."
    exit 0
  fi
  cat "$codex_preflight_log" >&2
  exit 1
fi
pnpm test:live ${OPENCLI_LIVE_CODEX_TEST_FILES:-src/gateway/gateway-codex-harness.live.test.ts}
EOF

opencli_live_codex_harness_append_build_extension codex
OPENCLI_LIVE_DOCKER_REPO_ROOT="$ROOT_DIR" "$TRUSTED_HARNESS_DIR/scripts/test-live-build-docker.sh"

echo "==> Run Codex harness live test in Docker"
echo "==> Model: ${OPENCLI_LIVE_CODEX_HARNESS_MODEL:-codex/gpt-5.5}"
echo "==> Image probe: ${OPENCLI_LIVE_CODEX_HARNESS_IMAGE_PROBE:-1}"
echo "==> MCP probe: ${OPENCLI_LIVE_CODEX_HARNESS_MCP_PROBE:-1}"
echo "==> Subagent probe: ${OPENCLI_LIVE_CODEX_HARNESS_SUBAGENT_PROBE:-1}"
echo "==> Subagent-only fast path: ${OPENCLI_LIVE_CODEX_HARNESS_SUBAGENT_ONLY:-auto}"
echo "==> Guardian probe: ${OPENCLI_LIVE_CODEX_HARNESS_GUARDIAN_PROBE:-1}"
echo "==> Auth mode: $CODEX_HARNESS_AUTH_MODE"
echo "==> Profile file: $PROFILE_STATUS"
echo "==> CI-safe Codex config: ${OPENCLI_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG:-1}"
echo "==> Test files: ${OPENCLI_LIVE_CODEX_TEST_FILES:-src/gateway/gateway-codex-harness.live.test.ts}"
echo "==> Harness fallback: none"
echo "==> Auth files: ${AUTH_FILES_CSV:-none}"
DOCKER_RUN_ARGS=(docker run --rm -t \
  -u "$DOCKER_USER" \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  -e OPENCLI_AGENT_HARNESS_FALLBACK=none \
  -e OPENCLI_DOCKER_AUTH_PRESTAGED="$DOCKER_AUTH_PRESTAGED" \
  -e OPENCLI_CODEX_APP_SERVER_BIN="${OPENCLI_CODEX_APP_SERVER_BIN:-codex}" \
  -e OPENCLI_DOCKER_AUTH_FILES_RESOLVED="$AUTH_FILES_CSV" \
  -e OPENCLI_LIVE_DOCKER_SOURCE_STAGE_MODE="${OPENCLI_LIVE_DOCKER_SOURCE_STAGE_MODE:-copy}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_AUTH="$CODEX_HARNESS_AUTH_MODE" \
  -e OPENCLI_LIVE_CODEX_HARNESS=1 \
  -e OPENCLI_LIVE_CODEX_HARNESS_DEBUG="${OPENCLI_LIVE_CODEX_HARNESS_DEBUG:-}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_GUARDIAN_PROBE="${OPENCLI_LIVE_CODEX_HARNESS_GUARDIAN_PROBE:-1}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_IMAGE_PROBE="${OPENCLI_LIVE_CODEX_HARNESS_IMAGE_PROBE:-1}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_MCP_PROBE="${OPENCLI_LIVE_CODEX_HARNESS_MCP_PROBE:-1}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_MODEL="${OPENCLI_LIVE_CODEX_HARNESS_MODEL:-codex/gpt-5.5}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_REQUIRE_GUARDIAN_EVENTS="${OPENCLI_LIVE_CODEX_HARNESS_REQUIRE_GUARDIAN_EVENTS:-1}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_REQUEST_TIMEOUT_MS="${OPENCLI_LIVE_CODEX_HARNESS_REQUEST_TIMEOUT_MS:-}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_SUBAGENT_ONLY="${OPENCLI_LIVE_CODEX_HARNESS_SUBAGENT_ONLY:-}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_SUBAGENT_PROBE="${OPENCLI_LIVE_CODEX_HARNESS_SUBAGENT_PROBE:-1}" \
  -e OPENCLI_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG="${OPENCLI_LIVE_CODEX_HARNESS_USE_CI_SAFE_CODEX_CONFIG:-1}" \
  -e OPENCLI_CLI_BACKEND_LOG_OUTPUT="${OPENCLI_CLI_BACKEND_LOG_OUTPUT:-}" \
  -e OPENCLI_TEST_CONSOLE="${OPENCLI_TEST_CONSOLE:-}" \
  -e OPENCLI_LIVE_DOCKER_SCRIPTS_DIR="${DOCKER_TRUSTED_HARNESS_CONTAINER_DIR}/scripts" \
  -e OPENCLI_LIVE_DOCKER_TRUSTED_HARNESS_DIR="$DOCKER_TRUSTED_HARNESS_CONTAINER_DIR" \
  -e OPENCLI_LIVE_CODEX_TRUSTED_HARNESS_DIR="$DOCKER_TRUSTED_HARNESS_CONTAINER_DIR" \
  -e OPENCLI_LIVE_CODEX_BIND="${OPENCLI_LIVE_CODEX_BIND:-}" \
  -e OPENCLI_LIVE_CODEX_BIND_MODEL="${OPENCLI_LIVE_CODEX_BIND_MODEL:-}" \
  -e OPENCLI_LIVE_CODEX_TEST_FILES="${OPENCLI_LIVE_CODEX_TEST_FILES:-}" \
  -e OPENCLI_LIVE_TEST=1 \
  -e OPENCLI_VITEST_FS_MODULE_CACHE=0)
opencli_live_append_array DOCKER_RUN_ARGS DOCKER_AUTH_ENV
opencli_live_append_array DOCKER_RUN_ARGS DOCKER_EXTRA_ENV_FILES
opencli_live_append_array DOCKER_RUN_ARGS DOCKER_HOME_MOUNT
opencli_live_append_array DOCKER_RUN_ARGS DOCKER_TRUSTED_HARNESS_MOUNT
DOCKER_RUN_ARGS+=(\
  -v "$CACHE_HOME_DIR":/home/node/.cache \
  -v "$ROOT_DIR":/src:ro \
  -v "$CONFIG_DIR":/home/node/.opencli \
  -v "$WORKSPACE_DIR":/home/node/.opencli/workspace \
  -v "$CLI_TOOLS_DIR":/home/node/.npm-global)
opencli_live_append_array DOCKER_RUN_ARGS EXTERNAL_AUTH_MOUNTS
opencli_live_append_array DOCKER_RUN_ARGS PROFILE_MOUNT
DOCKER_RUN_ARGS+=(\
  "$LIVE_IMAGE_NAME" \
  -lc "$LIVE_TEST_CMD")
"${DOCKER_RUN_ARGS[@]}"
