#!/bin/bash
# Compila, assina e instala o Solar Control no iPhone pelo xtool (WSL).
# Uso, no Ubuntu:  bash instalar.sh          (compila e instala)
#                  bash instalar.sh build    (só compila, sem iPhone)
#                  bash instalar.sh test     (testes do SolarCore)
# Pré-requisitos: guia "instalar-app-ios-xtool.md" (Swift, xtool, SDK, login)
# e, para instalar, iTunes aberto com a ponte da seção 5 ativa.
set -uo pipefail
export PATH=/opt/swift/usr/bin:$PATH
export USBMUXD_SOCKET_ADDRESS="$(ip route list default | awk '{print $3}'):27015"

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="$HOME/solarcontrol"
MODO="${1:-run}"

# Compila no disco do Ubuntu: /mnt/c é bem mais lento.
mkdir -p "$DESTINO"
find "$DESTINO" -mindepth 1 -maxdepth 1 ! -name .build ! -name xtool -exec rm -rf {} +
tar -C "$ORIGEM" --exclude=.build --exclude=xtool --exclude='SolarCore/.build' -cf - . | tar -C "$DESTINO" -xf -
cd "$DESTINO"

case "$MODO" in
  test)
    (cd SolarCore && swift test 2>&1 | grep -E "error|failed|Executed" | tail -15)
    ;;
  build)
    timeout 900 xtool dev build > "$HOME/solarcontrol-build.log" 2>&1
    echo "exit=$?"
    tr '\r' '\n' < "$HOME/solarcontrol-build.log" | grep -vE '\] +[0-9]{1,2}%$' | awk 'NF' | uniq | tail -30
    ;;
  *)
    timeout 900 xtool dev run > "$HOME/solarcontrol-instalar.log" 2>&1
    echo "exit=$?"
    tr '\r' '\n' < "$HOME/solarcontrol-instalar.log" | grep -vE '\] +[0-9]{1,2}%$' | awk 'NF' | uniq | tail -20
    timeout 20 ideviceinstaller list --user | grep -i solarcontrol
    ;;
esac
