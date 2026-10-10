#!/usr/bin/env bash
# ============================================================
#  СПРАВОЧНИК СН-МНГ — установка и запуск (Linux)
#  Все зависимости ставятся ВНУТРИ контейнера Docker.
#  Требуется: Docker Engine + docker compose plugin.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
    echo "[ОШИБКА] Docker не найден. Установка:"
    echo "  curl -fsSL https://get.docker.com | sh"
    exit 1
fi

echo "Сборка образа (установка внутри контейнера)..."
docker compose up -d --build

echo
echo "Готово! Откройте в браузере: http://localhost:8080"
echo "(для других ПК сети — http://ИМЯ-ИЛИ-IP-ЭТОГО-ПК:8080 )"
