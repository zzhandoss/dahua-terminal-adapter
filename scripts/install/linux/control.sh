#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${2:-dahua-adapter}"
ACTION="${1:-}"

if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <start|stop|restart|status|logs> [service-name]" >&2
  exit 1
fi

case "$ACTION" in
  start)
    systemctl start "$SERVICE_NAME"
    ;;
  stop)
    systemctl stop "$SERVICE_NAME"
    ;;
  restart)
    systemctl restart "$SERVICE_NAME"
    ;;
  status)
    systemctl status "$SERVICE_NAME" --no-pager
    ;;
  logs)
    journalctl -u "$SERVICE_NAME" -f
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
