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
    password TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    force_change_password BOOLEAN DEFAULT TRUE,
    language TEXT DEFAULT 'en',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
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
    storage_location TEXT,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS public.user_sharing (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES public.materials(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );
"

# Check if the tables were created
for TABLE in users manufacturers materials colors diameters storage_locations filaments user_sharing; do
  EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$TABLE')")
  echo "Table $TABLE created: $EXISTS"
done

echo "Database schema created!"

# Add language column if it doesn't exist
LANGUAGE_COLUMN_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'language')")
if [ "$LANGUAGE_COLUMN_EXISTS" = "f" ]; then
  echo "Adding language column to users table..."
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -v ON_ERROR_STOP=0 -c "ALTER TABLE public.users ADD COLUMN language TEXT DEFAULT 'en';"
  echo "Language column added."
else
  echo "Language column already exists."
fi

# Insert sample data, but only if explicitly requested via INIT_SAMPLE_DATA environment variable
echo "Checking for existing data..."

# Create a lock file to prevent data from being initialized multiple times
LOCK_FILE="/app/.init_done"

if [ -f "$LOCK_FILE" ]; then
  echo "Initialization already completed (lock file exists). Skipping data insertion."
else
  COUNT=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM public.manufacturers" 2>/dev/null | tr -d ' ' || echo "0")

  if [ "$COUNT" = "0" ]; then
    # Only add sample data if INIT_SAMPLE_DATA is set to "true"
    if [ "${INIT_SAMPLE_DATA}" = "true" ]; then
      echo "INIT_SAMPLE_DATA is set to true. Adding sample data..."
      PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -v ON_ERROR_STOP=0 -c "
        INSERT INTO public.manufacturers (name) VALUES ('Bambu Lab') ON CONFLICT DO NOTHING;
        INSERT INTO public.materials (name) VALUES ('PLA') ON CONFLICT DO NOTHING;
        INSERT INTO public.materials (name) VALUES ('PETG') ON CONFLICT DO NOTHING;
        INSERT INTO public.materials (name) VALUES ('ABS') ON CONFLICT DO NOTHING;
        INSERT INTO public.materials (name) VALUES ('TPU') ON CONFLICT DO NOTHING;
        INSERT INTO public.diameters (value) VALUES ('1.75') ON CONFLICT DO NOTHING;
        INSERT INTO public.storage_locations (name) VALUES ('Keller') ON CONFLICT DO NOTHING;
      "
      echo "Basic data inserted!"

      echo "Adding sample colors..."
      PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d "$PGDATABASE" -v ON_ERROR_STOP=0 -c "
        INSERT INTO public.colors (name, code) VALUES ('Dark Gray (Bambu Lab)', '#545454') ON CONFLICT DO NOTHING;
        INSERT INTO public.colors (name, code) VALUES ('Black (Bambu Lab)', '#000000') ON CONFLICT DO NOTHING;
        INSERT INTO public.colors (name, code) VALUES ('White (Bambu Lab)', '#FFFFFF') ON CONFLICT DO NOTHING;
        INSERT INTO public.colors (name, code) VALUES ('Red (Bambu Lab)', '#C12E1F') ON CONFLICT DO NOTHING;
        INSERT INTO public.colors (name, code) VALUES ('Blue (Bambu Lab)', '#0A2989') ON CONFLICT DO NOTHING;
      "
      echo "Sample colors inserted!"
    else
      echo "INIT_SAMPLE_DATA is not set to true. Skipping sample data insertion."
    fi

    # Create the lock file after initialization
    touch "$LOCK_FILE"
    echo "Initialization completed and lock file created."
  else
    echo "Data already exists, skipping initialization."
    touch "$LOCK_FILE"
  fi
fi

# Run the migration to add user_id column
echo "Running migration to add user_id column to filaments table..."
node run-migration.js || echo "Migration failed, but continuing..."

# Start the application
echo "Starting application..."
exec "$@"
