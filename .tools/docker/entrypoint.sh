#!/usr/bin/env bash
#
# Container entrypoint: wait for Postgres, apply migrations, seed once, then
# hand off to the CMD. Runs in both dev and prod images.

set -euo pipefail

log() { printf '\033[0;36m[neobank]\033[0m %s\n' "$1"; }
err() { printf '\033[0;31m[neobank]\033[0m %s\n' "$1" >&2; }

: "${DATABASE_URL:?DATABASE_URL must be set}"

# --- 1. Wait for the database ----------------------------------------------
# Compose health checks cover the normal path; this is the safety net for
# `docker run` and for a database that restarts under us.
log "Waiting for PostgreSQL..."
attempt=0
max_attempts=60

until node -e "
const net = require('node:net');
const url = new URL(process.env.DATABASE_URL);
const socket = net.connect(Number(url.port || 5432), url.hostname);
socket.on('connect', () => { socket.end(); process.exit(0); });
socket.on('error', () => process.exit(1));
socket.setTimeout(2000, () => { socket.destroy(); process.exit(1); });
" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    err "PostgreSQL unreachable after ${max_attempts} attempts. Giving up."
    exit 1
  fi
  sleep 1
done

log "PostgreSQL is accepting connections."

# --- 2. Apply migrations ----------------------------------------------------
# `migrate deploy` only replays committed migrations — it never generates or
# resets, so it is safe to run on every boot.
log "Applying database migrations..."
if ! npx prisma migrate deploy; then
  err "Migration failed."
  exit 1
fi

# --- 3. Seed (idempotent, first boot only) ----------------------------------
# The seed script upserts, so a re-run is harmless; SEED_ON_BOOT=false opts out
# entirely for environments with real data.
if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
  log "Seeding demo data..."
  if ! npx tsx prisma/seed.ts; then
    err "Seeding failed."
    exit 1
  fi
else
  log "SEED_ON_BOOT=false — skipping seed."
fi

log "Startup complete. Launching application."

exec "$@"
