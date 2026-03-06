#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-dir>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ADAPTER_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
BACKUP_DIR="$1"
SAFETY_DIR="${BACKUP_SAFETY_DIR:-$ROOT_DIR/backups/_safety}"

run_hook() {
  local command="${1:-}"
  if [[ -z "$command" ]]; then
    return 0
  fi
  bash -lc "$command"
}

run_hook "${ADAPTER_STOP_CMD:-}"

node "$ROOT_DIR/dist/src/ops/backup/backup-cli.js" restore \
  --root "$ROOT_DIR" \
  --backup "$BACKUP_DIR" \
  --safety-dir "$SAFETY_DIR" \
  --service-stopped

run_hook "${ADAPTER_START_CMD:-}"
run_hook "${ADAPTER_HEALTHCHECK_CMD:-}"
