#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  prisma migrate deploy --schema=./prisma/schema.prisma
else
  echo "Skipping database migrations."
fi

echo "Starting Next.js..."
exec node server.js