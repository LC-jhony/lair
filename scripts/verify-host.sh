#!/usr/bin/env bash
# Verificación del host (README §19). Exit code 0 = todo OK.
set -uo pipefail

failures=0
check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'OK   %s\n' "$label"
  else
    printf 'FAIL %s\n' "$label"
    failures=$((failures + 1))
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

caddy_bin="$(have caddy && printf 'caddy' || printf './bin/caddy')"
if [ -x "$caddy_bin" ]; then
  check "caddy version >= 2.7" bash -c '"$1" version | grep -Eq "v2\.(7|8|9|[0-9]+)"' _ "$caddy_bin"
  check "módulo reverse_proxy" bash -c '"$1" list-modules | grep -q http.handlers.reverse_proxy' _ "$caddy_bin"
  check "módulo file_server" bash -c '"$1" list-modules | grep -q http.handlers.file_server' _ "$caddy_bin"
else
  echo "FAIL Caddy no encontrado (ejecuta scripts/fetch-caddy.sh)"
  failures=$((failures + 1))
fi

check "admin API :2019" bash -c 'curl -sSI http://localhost:2019/config/ | grep -q " 200"'

if have getent; then
  check "resolución *.test" bash -c 'getent hosts foo.test'
elif have Resolve-DnsName; then
  check "resolución *.test" bash -c 'Resolve-DnsName foo.test'
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures comprobación(es) fallaron"
  exit 1
fi
echo "Verificación del host correcta"
