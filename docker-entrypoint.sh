#!/bin/sh
set -e

# Wait for database readiness
echo "Waiting for the database..."
MAX_RETRIES=30
RETRY_COUNT=0

# Check if all required environment variables are set
echo "Checking DB environment variables..."
echo "PGHOST: ${PGHOST:-not set}"
echo "PGPORT: ${PGPORT:-not set}"
echo "PGUSER: ${PGUSER:-not set}"
echo "PGDATABASE: ${PGDATABASE:-not set}"
echo "DATABASE_URL: ${DATABASE_URL:-not set}"

# Test connection with nc
while ! nc -z ${PGHOST:-db} ${PGPORT:-5432}; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Timeout waiting for the database!"
    exit 1
  fi
  echo "Waiting for the database... Attempt $RETRY_COUNT of $MAX_RETRIES"
  sleep 1
done
echo "Database is accessible!"

# Check the environment variables for the database
echo "Database connection: $PGHOST:$PGPORT $PGDATABASE"

# Explicitly export PGHOST and other PG* variables
export PGHOST=${PGHOST:-db}
export PGPORT=${PGPORT:-5432}
export PGUSER=${PGUSER:-filadex}
export PGPASSWORD=${PGPASSWORD:-filadex}
export PGDATABASE=${PGDATABASE:-filadex}

# Try to see if the database exists
echo "Checking if database $PGDATABASE exists..."
DB_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" postgres)
if [ -z "$DB_EXISTS" ]; then
  echo "Database $PGDATABASE does not exist, trying to create..."
  PGPASSWORD=$PGPASSWORD createdb -h $PGHOST -p $PGPORT -U $PGUSER "$PGDATABASE" || echo "Could not create database, trying to continue anyway..."
else
  echo "Database $PGDATABASE already exists."
fi

# Create the schema directly - with additional verification
echo "Creating database schema directly with SQL..."

# Check if we are using the correct database
CURRENT_DB=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -tAc "SELECT current_database()" $PGDATABASE)
echo "Current database: $CURRENT_DB, Target database: $PGDATABASE"

# Check permissions
echo "Checking database permissions..."
HAS_PERMISSION=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -tAc "SELECT has_schema_privilege(current_user, 'public', 'CREATE')" $PGDATABASE)
echo "User has CREATE permission: $HAS_PERMISSION"

# Create tables with explicit schema
PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -v ON_ERROR_STOP=0 -c "
  CREATE SCHEMA IF NOT EXISTS public;

  -- Only create tables if they don't exist
  -- DO NOT execute DROP commands to preserve data

  -- Create tables

  CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public.manufacturers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public.materials (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public.colors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public.diameters (
    id SERIAL PRIMARY KEY,
    value NUMERIC NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public.storage_locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public.filaments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    manufacturer TEXT,
    material TEXT NOT NULL,
    color_name TEXT,
    color_code TEXT,
    diameter NUMERIC,
    print_temp TEXT,
    total_weight NUMERIC NOT NULL,
    remaining_percentage NUMERIC NOT NULL,
    purchase_date DATE,
    purchase_price NUMERIC,
    status TEXT,
    spool_type TEXT,
    dryer_count INTEGER DEFAULT 0 NOT NULL,
    last_drying_date DATE,
    storage_location TEXT
  );
"

# Überprüfe, ob die Tabellen erstellt wurden
for TABLE in users manufacturers materials colors diameters storage_locations filaments; do
  EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$TABLE')")
  echo "Tabelle $TABLE erstellt: $EXISTS"
done

echo "Datenbankschema erstellt!"

# Füge Beispieldaten ein, aber nur wenn die Tabelle leer ist und die Datei /app/.init_done nicht existiert
echo "Überprüfe auf vorhandene Daten..."

# Erstelle eine Lock-Datei, um zu verhindern, dass Daten mehrfach initialisiert werden
LOCK_FILE="/app/.init_done"

if [ -f "$LOCK_FILE" ]; then
  echo "Initialisierung bereits abgeschlossen (Lock-Datei existiert). Überspringe Dateneinfügung."
else
  COUNT=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM public.manufacturers" 2>/dev/null | tr -d ' ' || echo "0")

  if [ "$COUNT" = "0" ]; then
    echo "Füge grundlegende Daten ein..."
    PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -v ON_ERROR_STOP=0 -c "
      INSERT INTO public.manufacturers (name) VALUES ('Bambu Lab') ON CONFLICT DO NOTHING;
      INSERT INTO public.materials (name) VALUES ('PLA') ON CONFLICT DO NOTHING;
      INSERT INTO public.materials (name) VALUES ('PETG') ON CONFLICT DO NOTHING;
      INSERT INTO public.materials (name) VALUES ('ABS') ON CONFLICT DO NOTHING;
      INSERT INTO public.materials (name) VALUES ('TPU') ON CONFLICT DO NOTHING;
      INSERT INTO public.diameters (value) VALUES ('1.75') ON CONFLICT DO NOTHING;
      INSERT INTO public.storage_locations (name) VALUES ('Keller') ON CONFLICT DO NOTHING;
    "
    echo "Grundlegende Daten wurden eingefügt!"

    echo "Füge Beispiel-Farben ein..."
    PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -v ON_ERROR_STOP=0 -c "
      INSERT INTO public.colors (name, code) VALUES ('Dark Gray (Bambu Lab)', '#545454') ON CONFLICT DO NOTHING;
      INSERT INTO public.colors (name, code) VALUES ('Black (Bambu Lab)', '#000000') ON CONFLICT DO NOTHING;
      INSERT INTO public.colors (name, code) VALUES ('White (Bambu Lab)', '#FFFFFF') ON CONFLICT DO NOTHING;
      INSERT INTO public.colors (name, code) VALUES ('Red (Bambu Lab)', '#C12E1F') ON CONFLICT DO NOTHING;
      INSERT INTO public.colors (name, code) VALUES ('Blue (Bambu Lab)', '#0A2989') ON CONFLICT DO NOTHING;
    "
    echo "Beispiel-Farben wurden eingefügt!"

    # Erstelle die Lock-Datei nach erfolgreicher Initialisierung
    touch "$LOCK_FILE"
    echo "Initialisierung abgeschlossen und Lock-Datei erstellt."
  else
    echo "Daten bereits vorhanden, überspringe Initialisierung."
    touch "$LOCK_FILE"
  fi
fi

# Starte die Anwendung
echo "Starte Anwendung..."
exec "$@"
