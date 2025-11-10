#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL environment variable is required" >&2
  exit 1
fi

PSQL=${PSQL:-psql}

if ! command -v "$PSQL" >/dev/null 2>&1; then
  echo "psql command not found; install PostgreSQL client tools" >&2
  exit 1
fi

has_extension=$("$PSQL" "$DATABASE_URL" -Atqc "SELECT 1 FROM pg_available_extensions WHERE name = 'plpgsql_check';" || echo "")

if [[ "$has_extension" == "1" ]]; then
  supabase db lint --db-url "$DATABASE_URL" --fail-on error
else
  cat <<'MSG'
Skipping `supabase db lint`: the `plpgsql_check` extension is not available on the target database.
Install the extension to enable linting, or run this script against an environment where it is installed.
MSG
fi
