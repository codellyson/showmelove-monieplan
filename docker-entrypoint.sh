#!/bin/sh
set -e

# Ensure the SQLite directory exists (mounted as an empty volume on first boot).
mkdir -p /app/tmp

echo "→ Running Lucid migrations..."
node ace migration:run --force

echo "→ Running Better Auth migrations..."
node bin/migrate-auth.js

echo "→ Starting server..."
exec "$@"
