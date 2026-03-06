#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

BACKUP_DIR=""
ROOT_DIR=""
ALLOW_VERSION_MISMATCH="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) BACKUP_DIR="${2:?}"; shift 2 ;;
    --root) ROOT_DIR="${2:?}"; shift 2 ;;
    --allow-version-mismatch) ALLOW_VERSION_MISMATCH="true"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$BACKUP_DIR" ]]; then
  echo "missing --backup" >&2
  exit 1
fi

ARGS=(verify --backup "$BACKUP_DIR")
if [[ -n "$ROOT_DIR" ]]; then ARGS+=(--root "$ROOT_DIR"); fi
if [[ "$ALLOW_VERSION_MISMATCH" == "true" ]]; then ARGS+=(--allow-version-mismatch); fi

run_backup_cli "${ARGS[@]}"
