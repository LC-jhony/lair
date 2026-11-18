#!/usr/bin/env bash
# Crea el release v1.0.0 de Lair en LC-jhony/lair con todos los campos y assets.
# Requiere GitHub CLI autenticado: gh auth login (o GITHUB_TOKEN en el entorno).
set -euo pipefail

readonly REPO="LC-jhony/lair"
readonly TAG="v1.0.0"
readonly TITLE="Lair v1.0.0"
readonly NOTES="RELEASE_NOTES.md"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ASSETS=(
  "dist/SHA256SUMS"
  "dist/lair_1.0.0_amd64.deb"
  "dist/lair_1.0.0_arm64.deb"
  "dist/lair_1.0.0_darwin_amd64.tar.gz"
  "dist/lair_1.0.0_darwin_arm64.tar.gz"
  "dist/lair_1.0.0_linux_amd64.tar.gz"
  "dist/lair_1.0.0_linux_arm64.tar.gz"
  "dist/lair_1.0.0_windows_amd64.zip"
  "dist/lair_1.0.0_windows_arm64.zip"
)

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: se necesita GitHub CLI (gh). Instálalo y ejecuta 'gh auth login'." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI no está autenticado. Ejecuta 'gh auth login' o exporta GITHUB_TOKEN." >&2
  exit 1
fi

if [ "$(git rev-parse "$TAG^{commit}")" != "$(git rev-parse HEAD)" ]; then
  echo "ERROR: el tag $TAG no apunta a HEAD. Recrea el tag antes de publicar." >&2
  exit 1
fi

for asset in "${ASSETS[@]}"; do
  if [ ! -f "$asset" ]; then
    echo "ERROR: falta el asset $asset" >&2
    exit 1
  fi
done

echo "==> Verificando hashes de los assets"
(cd dist && sha256sum -c SHA256SUMS)

echo "==> Subiendo rama y tag a $REPO"
git push origin main
git push origin "$TAG"

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "==> El release ya existe: actualizando notas y reemplazando assets"
  gh release edit "$TAG" --repo "$REPO" --title "$TITLE" --notes-file "$NOTES"
  for asset in "${ASSETS[@]}"; do
    name="$(basename "$asset")"
    if gh release view "$TAG" --repo "$REPO" --json assets --jq ".assets[].name" | grep -qx "$name"; then
      gh release delete-asset "$TAG" "$name" --repo "$REPO" --yes
    fi
  done
  gh release upload "$TAG" "${ASSETS[@]}" --repo "$REPO" --clobber
else
  echo "==> Creando el release $TAG"
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "$TITLE" \
    --notes-file "$NOTES" \
    --verify-tag \
    "${ASSETS[@]}"
fi

echo "Listo: https://github.com/$REPO/releases/tag/$TAG"
