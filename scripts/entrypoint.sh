#!/bin/sh
set -eu

required_vars="DATABASE_URL NEXTAUTH_SECRET NEXTAUTH_URL"
for v in $required_vars; do
  eval "val=\${$v:-}"
  if [ -z "$val" ]; then
    echo "[entrypoint] Missing required env var: $v" >&2
    exit 1
  fi
done

echo "[entrypoint] Running migrations..."
npx prisma migrate deploy

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "[entrypoint] RUN_DB_SEED=true -> running seed"
  npm run db:seed
fi

echo "[entrypoint] Starting app on port ${PORT:-3000}"
exec npm run start -- -p "${PORT:-3000}"
