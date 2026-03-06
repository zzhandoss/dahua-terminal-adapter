#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ADAPTER_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
BACKUPS_DIR="${BACKUPS_DIR:-$ROOT_DIR/backups}"
MODE="${BACKUP_MODE:-nightly}"
MAX_LOG_FILES="${BACKUP_LOG_FILES:-5}"

ARGS=(
  "$ROOT_DIR/dist/src/ops/backup/backup-cli.js"
  create
  --root "$ROOT_DIR"
  --backups-dir "$BACKUPS_DIR"
  --mode "$MODE"
  --max-log-files "$MAX_LOG_FILES"
)

if [[ "${BACKUP_INCLUDE_LOGS:-false}" == "true" ]]; then
  ARGS+=(--include-logs)
fi

if [[ -n "${BACKUP_LICENSE_DIR:-}" ]]; then
  ARGS+=(--license-dir "$BACKUP_LICENSE_DIR")
fi

if [[ -n "${BACKUP_RESTORE_POINT_ID:-}" ]]; then
  ARGS+=(--restore-point-id "$BACKUP_RESTORE_POINT_ID")
fi

node "${ARGS[@]}"
