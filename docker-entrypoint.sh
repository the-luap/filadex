#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

# The image runs the server as an unprivileged user (defaulting to node:node 1000:1000,
# or PUID:PGID on environments like Synology DSM). Mounted volumes arrive owned by root
# or the NAS user, so when started as root take ownership of the data paths first,
# ensure permissions (chmod -R 775), then re-run this script as PUID:PGID. Started as
# any other user - `docker run --user`, or a compose `user:` line - this block is skipped
# and the paths are assumed to be writable already.
if [ "$(id -u)" = "0" ]; then
  echo "Using PUID: ${PUID}, PGID: ${PGID}"
  DATA_PATHS="/data ${BACKUP_DIR:-/data/backups}"
  case "${DATABASE_URL}" in
    file:*)
      DB_FILE="${DATABASE_URL#file:}"
      DATA_PATHS="${DATA_PATHS} $(dirname "${DB_FILE%%\?*}")"
      ;;
  esac
  for p in ${DATA_PATHS}; do
    mkdir -p "${p}"
    chown -R "$PUID:$PGID" "${p}"
    chmod -R 775 "${p}"
  done
  exec su-exec "$PUID:$PGID" "$0" "$@"
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
  case "${DATABASE_URL}" in
    file:*|sqlite:*)
      DB_FILE="${DATABASE_URL#file:}"
      DB_DIR="$(dirname "${DB_FILE%%\?*}")"
      if ! touch "${DB_DIR}/.filadex_write_test" 2>/dev/null; then
        echo "====================================================================" >&2
        echo "ERROR: Data directory '${DB_DIR}' is not writable by current user (UID $(id -u), GID $(id -g))." >&2
        echo "This causes SQLite to fail with SQLITE_READONLY." >&2
        echo "" >&2
        echo "To fix this on Synology NAS:" >&2
        echo "1. Set PUID and PGID in your compose environment matching your DSM user" >&2
        echo "   (typically PUID=1026, PGID=100)." >&2
        echo "2. In File Station, right-click the folder mapped to '${DB_DIR}' -> Properties -> Permission." >&2
        echo "   Ensure your user (or Everyone) has Read & Write permissions," >&2
        echo "   and check 'Apply to this folder, sub-folders and files'." >&2
        echo "====================================================================" >&2
        exit 1
      fi
      rm -f "${DB_DIR}/.filadex_write_test"
      ;;
  esac

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
