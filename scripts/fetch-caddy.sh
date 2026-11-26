#!/usr/bin/env bash
# Download the official Caddy binary into bin/caddy (Linux/macOS).
set -euo pipefail

VERSION="${1:-2.9.0}"
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS:$ARCH" in
  Linux:x86_64) TARGET="linux_amd64" ;;
  Linux:aarch64|Linux:arm64) TARGET="linux_arm64" ;;
  Darwin:x86_64) TARGET="mac_amd64" ;;
  Darwin:arm64) TARGET="mac_arm64" ;;
  *) echo "Sistema no soportado: $OS/$ARCH" >&2; exit 1 ;;
esac

ARCHIVE="caddy_${VERSION}_${TARGET}.tar.gz"
URL="https://github.com/caddyserver/caddy/releases/download/v${VERSION}/${ARCHIVE}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p bin
echo "Descargando $URL"
curl -fsSL "$URL" -o "$TMP/$ARCHIVE"
tar -xzf "$TMP/$ARCHIVE" -C "$TMP" caddy
install -m 0755 "$TMP/caddy" bin/caddy
echo "Caddy $(bin/caddy version) instalado en bin/caddy"
