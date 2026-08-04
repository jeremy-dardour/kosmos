#!/bin/sh
set -e

#######################################
# 1. Validate required environment vars
#######################################
REQUIRED_VARS="DATABASE_URL NODE_ENV"
for var in $REQUIRED_VARS; do
  if [ -z "$(eval echo \$$var)" ]; then
    echo "Missing env var: $var"
    exit 1
  fi
done

#######################################
# 2. Run database migrations (idempotent)
#######################################
echo "Running MikroORM migrations..."
cd /app/apps/api && MIKRO_ORM_CLI_PREFER_TS=false pnpm mikro-orm migration:up \
  --config dist/src/database/mikro-orm.cli.config.js || {
  echo "Migration failed"
  exit 1
}
echo "Migrations completed"

#######################################
# 3. Start the API application
#######################################
echo "Starting NestJS..."
cd /app && exec node apps/api/dist/src/main.js
