#!/bin/bash
# Runs the admin query tests (test/db/*.test.ts) against a THROWAWAY MySQL: a fresh server in a temp directory on a
# spare local port, loaded with the backend's base schema plus every migration, then deleted. Nothing here touches
# your .env.local, staging or production.
#
#   npm run test:db
#
# Needs `mysqld` and `mysql` on PATH (Homebrew: brew install mysql@8.0). Known noise: plugio.schema.sql stops at
# the content_publications table on MySQL 8.0.46 (a NOT NULL column with ON DELETE SET NULL), and many migrations
# report "duplicate column": both are expected and ignored (--force); the tests check what they actually need.
set -uo pipefail

ADMIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ADMIN_DIR/../plugio-backend"
SCHEMA="$BACKEND_DIR/database/plugio.schema.sql"
MIGRATIONS="$BACKEND_DIR/src/main/resources/db/migration"
DB=plugio_test

command -v mysqld >/dev/null || { echo "mysqld not found on PATH" >&2; exit 2; }
[[ -f "$SCHEMA" && -d "$MIGRATIONS" ]] || { echo "backend schema or migrations not found next to plugio-admin" >&2; exit 2; }

WORK="$(mktemp -d)"
PORT="${TEST_DB_PORT:-$((33000 + RANDOM % 900))}"
SOCK="$WORK/s"
BASEDIR="$(dirname "$(dirname "$(readlink -f "$(command -v mysqld)" 2>/dev/null || command -v mysqld)")")"

cleanup() {
  [[ -f "$WORK/pid" ]] && kill "$(cat "$WORK/pid")" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do [[ -f "$WORK/pid" ]] && kill -0 "$(cat "$WORK/pid")" 2>/dev/null && sleep 1; done
  rm -rf "$WORK"
}
trap cleanup EXIT

mysqld --no-defaults --initialize-insecure --datadir="$WORK/data" --basedir="$BASEDIR" >"$WORK/init.log" 2>&1 \
  || { echo "could not initialise a temporary MySQL:"; tail -5 "$WORK/init.log"; exit 2; }
mysqld --no-defaults --datadir="$WORK/data" --basedir="$BASEDIR" --port="$PORT" --bind-address=127.0.0.1 \
  --mysqlx=OFF --socket="$SOCK" --pid-file="$WORK/pid" >"$WORK/mysqld.log" 2>&1 &

ready=0
for _ in $(seq 1 40); do
  mysql -uroot -h127.0.0.1 -P"$PORT" -e "select 1" >/dev/null 2>&1 && { ready=1; break; }
  sleep 1
done
[[ $ready == 1 ]] || { echo "temporary MySQL did not start:"; tail -5 "$WORK/mysqld.log"; exit 2; }

sql() { mysql -uroot -h127.0.0.1 -P"$PORT" "$@"; }
sql -e "create database $DB character set utf8mb4"
sed "s/plugio_db/$DB/g" "$SCHEMA" | sql "$DB" --force >/dev/null 2>&1
for f in $(ls "$MIGRATIONS"/*.sql | sed -E 's/.*V([0-9]+)__.*/\1 &/' | sort -n | cut -d' ' -f2); do
  sql "$DB" --force <"$f" >/dev/null 2>&1
done

# The app refuses an empty DB_PASSWORD, so give the throwaway root a throwaway password.
sql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'throwaway'"

cd "$ADMIN_DIR"
DB_HOST=127.0.0.1 DB_PORT="$PORT" DB_NAME="$DB" DB_USERNAME=root DB_PASSWORD=throwaway NEXT_PUBLIC_ENVIRONMENT=development \
  node --import ./test/stub-server-only.mjs --test --test-timeout=60000 "test/db/*.test.ts"
