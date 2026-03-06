#!/usr/bin/env bash
set -euo pipefail

adapter_root_dir() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/../.." && pwd
}

run_backup_cli() {
  local root_dir
  root_dir="$(adapter_root_dir)"
  node "$root_dir/dist/src/ops/backup/backup-cli.js" "$@"
}

run_external_command() {
  local command_value="${1:-}"
  if [[ -z "$command_value" ]]; then
    return 0
  fi
  bash -lc "$command_value"
}

wait_for_health() {
  local url="${1:-}"
  local timeout_sec="${2:-60}"
  if [[ -z "$url" ]]; then
    return 0
  fi
  local started_at
  started_at="$(date +%s)"
  while true; do
    if curl --silent --fail --max-time 5 "$url" >/dev/null; then
      return 0
    fi
    if (( "$(date +%s)" - started_at >= timeout_sec )); then
      echo "healthcheck timeout: $url" >&2
      return 1
    fi
    sleep 2
  done
}
