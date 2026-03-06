#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ADAPTER_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
BACKUPS_DIR="${BACKUPS_DIR:-$ROOT_DIR/backups}"
NIGHTLY_KEEP="${BACKUP_NIGHTLY_KEEP:-7}"
PRE_UPDATE_KEEP="${BACKUP_PREUPDATE_KEEP:-5}"
LOG_KEEP="${BACKUP_LOG_KEEP:-1}"

node "$ROOT_DIR/dist/src/ops/backup/backup-cli.js" prune \
  --backups-dir "$BACKUPS_DIR" \
  --nightly-keep "$NIGHTLY_KEEP" \
  --pre-update-keep "$PRE_UPDATE_KEEP" \
  --log-backups-keep "$LOG_KEEP"
