#!/usr/bin/env bash
# ============================================================
#  СПРАВОЧНИК СН-МНГ — запуск БЕЗ Docker и без установки чего-либо
#  Требуется только Python 3 (обычно уже есть в Linux) или Node.js.
#  Использование: ./launch-linux.sh [порт]   (по умолчанию 8080)
# ============================================================
set -e
cd "$(dirname "$0")"
PORT="${1:-8080}"

# ищем dist/ рядом со скриптом или в ./dist
if [ -f "index.html" ] && [ -d "assets" ]; then
  DIR="."
elif [ -f "dist/index.html" ]; then
  DIR="dist"
else
  echo "ОШИБКА: не найден index.html (распакуйте архив spravochnik-web.zip целиком)." >&2
  exit 1
fi

echo "=============================================="
echo " Справочник СН-МНГ запущен:"
echo "   http://localhost:${PORT}"
echo " Для сотрудников сети: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
echo " Остановка: Ctrl+C"
echo "=============================================="

if command -v python3 >/dev/null 2>&1; then
  cd "$DIR"
  exec python3 -m http.server "$PORT" --bind 0.0.0.0
elif command -v node >/dev/null 2>&1; then
  npx --yes serve "$DIR" -l "$PORT" -n
else
  echo "Не найдены python3 или node. Альтернатива: просто откройте ${DIR}/index.html в браузере (двойной клик)." >&2
  exit 1
fi
