#!/usr/bin/env bash
# Set up this workspace's .env files with a random, free set of ports, so it
# can run docker compose + `pnpm dev` alongside other conductor workspaces
# without host port collisions.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

random_free_port() {
  local port
  while true; do
    port=$((RANDOM % 20000 + 20000))
    ! (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && { echo "$port"; return; }
  done
}

DB_PORT=$(random_free_port)
DB_TEST_PORT=$(random_free_port)
API_PORT=$(random_free_port)
WEB_PORT=$(random_free_port)

set_env_var() {
  perl -i -pe "s/^$2=.*/$2=$3/" "$1"
}

cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
set_env_var "$REPO_ROOT/.env" DATABASE_PORT "$DB_PORT"
set_env_var "$REPO_ROOT/.env" DATABASE_TEST_PORT "$DB_TEST_PORT"

cp "$REPO_ROOT/apps/api/.env.example" "$REPO_ROOT/apps/api/.env"
set_env_var "$REPO_ROOT/apps/api/.env" PORT "$API_PORT"
perl -i -pe "s#^(DATABASE_URL=postgres://postgres:postgres\@localhost:)\d+(/nestjs)#\${1}${DB_PORT}\${2}#" \
  "$REPO_ROOT/apps/api/.env"

cp "$REPO_ROOT/apps/web/.env.example" "$REPO_ROOT/apps/web/.env"
set_env_var "$REPO_ROOT/apps/web/.env" WEB_PORT "$WEB_PORT"
perl -i -pe "s#^(VITE_API_URL=http://localhost:)\d+#\${1}${API_PORT}#" \
  "$REPO_ROOT/apps/web/.env"

# .env.e2e is a tracked fixture; override its port for this workspace via an
# untracked .env.e2e.local instead of editing it in place.
echo "DATABASE_URL=postgres-test://postgres-test:postgres-test@localhost:${DB_TEST_PORT}/nestjs" \
  > "$REPO_ROOT/apps/api/.env.e2e.local"

cat <<EOF
Workspace ports:
  Postgres:       $DB_PORT
  Postgres test:  $DB_TEST_PORT
  API:            $API_PORT
  Web dev server: $WEB_PORT
EOF
