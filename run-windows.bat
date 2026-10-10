@echo off
rem ============================================================
rem  СПРАВОЧНИК СН-МНГ — установка и запуск (Windows)
rem  Все зависимости ставятся ВНУТРИ контейнера Docker.
rem  Требуется: Docker Desktop для Windows.
rem ============================================================
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Docker не найден. Установите Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo Сборка образа (установка внутри контейнера)...
docker compose up -d --build
if errorlevel 1 (
    echo [ОШИБКА] Не удалось собрать/запустить контейнер.
    pause
    exit /b 1
)

echo.
echo Готово! Откройте в браузере: http://localhost:8080
echo (для других ПК сети — http://ИМЯ-ЭТОГО-ПК:8080 )
pause
