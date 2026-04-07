#!/bin/sh

# Copy default logo to the frontend public folder if it doesn't exist
cp -rn /tmp/img/* /opt/app/frontend/public/img

# Auto-rename legacy Pingvin Share database on upgrade
DB_DIR="/opt/app/backend/data"
NEW_DB="$DB_DIR/gnome-share.db"
LEGACY_DB="$DB_DIR/pingvin-share.db"

if [ -z "$DATABASE_URL" ] && [ ! -f "$NEW_DB" ] && [ -f "$LEGACY_DB" ]; then
  echo "[entrypoint] Renaming pingvin-share.db -> gnome-share.db"
  for suffix in "" "-wal" "-shm" "-journal"; do
    if [ -f "${LEGACY_DB}${suffix}" ]; then
      if ! mv "${LEGACY_DB}${suffix}" "${NEW_DB}${suffix}"; then
        echo "[entrypoint] Warning: failed to rename ${LEGACY_DB}${suffix} -> ${NEW_DB}${suffix}" >&2
      fi
    fi
  done
fi

if [ "$CADDY_DISABLED" != "true" ]; then
  # Start Caddy
  echo "Starting Caddy..."
  if [ "$TRUST_PROXY" = "true" ]; then
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile.trust-proxy &
  else
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile &
  fi
else
  echo "Caddy is disabled. Skipping..."
fi

# Run the frontend server
PORT=3333 HOSTNAME=0.0.0.0 node frontend/server.js &

# Run the backend server
cd backend && npm run prod

# Wait for all processes to finish
wait -n
