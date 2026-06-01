#!/usr/bin/env bash
# Install the systemd unit that brings the docker compose stack up at boot.
# Run from the project root: sudo ./deploy/install.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Bu script systemd unit'i kurar; root yetkisi gerekir. sudo ile çalıştır." >&2
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_NAME="ailab-kiosk.service"
UNIT_SRC="$PROJECT_DIR/deploy/$UNIT_NAME"
UNIT_DEST="/etc/systemd/system/$UNIT_NAME"

if [[ ! -f "$UNIT_SRC" ]]; then
    echo "Unit dosyası bulunamadı: $UNIT_SRC" >&2
    exit 1
fi
if [[ ! -f "$PROJECT_DIR/docker-compose.yml" ]]; then
    echo "docker-compose.yml bulunamadı: $PROJECT_DIR" >&2
    exit 1
fi

# Sanity: docker compose plugin?
if ! /usr/bin/docker compose version >/dev/null 2>&1; then
    echo "/usr/bin/docker compose çalışmıyor. Docker Engine + compose plugin kurulu mu?" >&2
    exit 1
fi

echo "Project dir: $PROJECT_DIR"
echo "Installing $UNIT_NAME -> $UNIT_DEST"
sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$UNIT_SRC" > "$UNIT_DEST"
chmod 644 "$UNIT_DEST"

systemctl daemon-reload
systemctl enable "$UNIT_NAME"
systemctl start "$UNIT_NAME"

echo
echo "Kurulum tamam. Durum:"
systemctl --no-pager status "$UNIT_NAME" || true
echo
echo "Logları izlemek için:  journalctl -u $UNIT_NAME -f"
echo "Servisleri görmek için: cd $PROJECT_DIR && docker compose ps"
