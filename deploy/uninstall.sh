#!/usr/bin/env bash
# Remove the systemd unit and stop the stack. Volumes (DB, Caddy CA) are
# kept — pass --purge to also remove docker volumes.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Root yetkisi gerekir. sudo ile çalıştır." >&2
    exit 1
fi

UNIT_NAME="ailab-kiosk.service"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

systemctl stop "$UNIT_NAME" 2>/dev/null || true
systemctl disable "$UNIT_NAME" 2>/dev/null || true
rm -f "/etc/systemd/system/$UNIT_NAME"
systemctl daemon-reload

if [[ "${1:-}" == "--purge" ]]; then
    echo "Volume'leri de kaldırıyorum (--purge)."
    (cd "$PROJECT_DIR" && /usr/bin/docker compose down -v)
fi

echo "$UNIT_NAME kaldırıldı."
