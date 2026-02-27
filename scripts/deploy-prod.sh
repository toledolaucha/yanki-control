#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "[deploy] Falta .env. Copiá .env.example y configurá secretos primero."
  exit 1
fi

echo "[deploy] Build + up"
docker compose up -d --build

echo "[deploy] Estado de servicios"
docker compose ps

echo "[deploy] Health endpoint"
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
  echo "[deploy] OK /api/health"
else
  echo "[deploy] WARNING: /api/health no respondió todavía. Revisá logs: docker compose logs -f app"
fi
