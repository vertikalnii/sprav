# ============================================================
# СПРАВОЧНИК СН-МНГ — готовое решение в контейнере
# Все установки (зависимости, сборка) выполняются ВНУТРИ контейнера.
# На хосте нужен только Docker: docker compose up -d
# Работает одинаково на Windows (Docker Desktop) и Linux (Docker Engine).
# ============================================================

# ---------- Стадия 1: сборка ----------
FROM node:20-alpine AS build

SHELL ["/bin/sh", "-eu", "-c"]

WORKDIR /app

# Копируем манифесты и ставим зависимости внутри контейнера
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Копируем исходники и собираем продакшн-бандл
COPY index.html vite.config.js tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---------- Стадия 2: запуск (лёгкий nginx) ----------
FROM nginx:1.27-alpine AS runtime

# Конфиг сервера: SPA + корректная отдача файлов + сжатие
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Готовая сборка из стадии build
COPY --from=build /app/dist /usr/share/nginx/html

# Экземпляры справочника (данные IndexedDB, экспорт и т.п.) — вне образа
VOLUME ["/usr/share/nginx/html/data"]

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
