#!/bin/sh
set -e

# The image runs the server as the unprivileged `node` user. Mounted volumes
# arrive owned by root, so when started as root take ownership of the data
# paths first, then re-run this script as `node`. Started as any other user -
# `docker run --user`, or a compose `user:` line - this block is skipped and
# the paths are assumed to be writable already.
if [ "$(id -u)" = "0" ]; then
  DATA_PATHS="/data ${BACKUP_DIR:-/data/backups}"
  case "${DATABASE_URL}" in
    file:*)
      DB_FILE="${DATABASE_URL#file:}"
      DATA_PATHS="${DATA_PATHS} $(dirname "${DB_FILE%%\?*}")"
      ;;
  esac
  for p in ${DATA_PATHS}; do
    mkdir -p "${p}"
    chown -R node:node "${p}"
  done
  exec su-exec node:node "$0" "$@"
fi

# Decide dialect from DATABASE_URL scheme.
#
# The scheme selects which of the two bundles runs, so an unrecognised one must
# not fall through to a default: `sqlite3:/data/filadex.db` parses as a Postgres
# URL with an empty host, picks up PGHOST/PGUSER/PGPASSWORD, and quietly creates
# and migrates a Postgres database named after the file path. The install comes
# up healthy and completely empty, with nothing in the log naming the database
# it opened. Refusing here is what turns that into a startup failure.
case "${DATABASE_URL}" in
  postgres:*|postgresql:*)
    MIGRATOR="dist/migrate.pg.js"
    SEEDER="dist/seed.pg.js"
    APP="dist/index.pg.js"
    echo "Database: PostgreSQL"
    ;;
  file:*|sqlite:*)
    MIGRATOR="dist/migrate.sqlite.js"
    SEEDER="dist/seed.sqlite.js"
    APP="dist/index.sqlite.js"
    echo "Database: SQLite"
    ;;
  "")
    echo "DATABASE_URL is not set. Set it to a postgres:// or file: URL." >&2
    exit 1
    ;;
  *)
    echo "Unrecognised DATABASE_URL scheme: ${DATABASE_URL}" >&2
    echo "Expected postgres://, postgresql://, file: or sqlite:." >&2
    exit 1
    ;;
esac

# If the command is to start the server (default), run migrations and optional
# seed. Any extra arguments after the entrypoint spelling are kept and passed
# through, so `node dist/index.js --inspect` still gets --inspect.
MANAGED=""
if [ "$#" -eq 0 ]; then
  MANAGED=1
elif [ "$1" = "node" ] && { [ "$2" = "dist/index.js" ] || [ "$2" = "dist/index.pg.js" ] || [ "$2" = "dist/index.sqlite.js" ]; }; then
  MANAGED=1
  shift 2
fi

if [ -n "${MANAGED}" ]; then
  echo "Applying database migrations..."
  node "${MIGRATOR}"

  if [ "${INIT_SAMPLE_DATA}" = "true" ]; then
    echo "Seeding starter data..."
    node "${SEEDER}" --starter
  fi

  echo "Starting application..."
  exec node "${APP}" "$@"
fi

exec "$@"
