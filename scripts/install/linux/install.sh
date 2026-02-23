#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="dahua-adapter"
INSTALL_DIR="/opt/dahua-adapter"
ZIP_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zip)
      ZIP_PATH="${2:-}"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --service-name)
      SERVICE_NAME="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ZIP_PATH" ]]; then
  echo "Usage: $0 --zip <path-to-linux-archive> [--dir <install-dir>] [--service-name <name>]" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "install.sh must be run as root" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 LTS is required but node command was not found" >&2
  exit 1
fi

NODE_BIN="$(command -v node)"
NODE_MAJOR="$("$NODE_BIN" -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" != "20" ]]; then
  echo "Node.js 20 LTS is required. Current major: $NODE_MAJOR" >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is required but not installed" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
unzip -oq "$ZIP_PATH" -d "$INSTALL_DIR"

if [[ ! -f "$INSTALL_DIR/.env" && -f "$INSTALL_DIR/.env.example" ]]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
fi

mkdir -p "$INSTALL_DIR/data"

UNIT_TEMPLATE="$INSTALL_DIR/scripts/install/linux/dahua-adapter.service"
if [[ ! -f "$UNIT_TEMPLATE" ]]; then
  echo "Service template not found: $UNIT_TEMPLATE" >&2
  exit 1
fi

UNIT_OUTPUT="/etc/systemd/system/${SERVICE_NAME}.service"
sed -e "s|__INSTALL_DIR__|$INSTALL_DIR|g" -e "s|__NODE_BIN__|$NODE_BIN|g" "$UNIT_TEMPLATE" >"$UNIT_OUTPUT"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager
