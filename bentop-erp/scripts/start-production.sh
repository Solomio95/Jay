#!/usr/bin/env bash
# Bentop ERP Production Starter
# Symlinks static assets into the standalone build output and starts the server.
set -euo pipefail

APP_DIR="/Users/oyenai/.openclaw/workspace/Jay/bentop-erp"
STANDALONE_DIR="$APP_DIR/.next/standalone"
LOG="/opt/homebrew/var/log/bentop-erp.log"

cd "$APP_DIR"

# Ensure standalone static assets exist
mkdir -p "$STANDALONE_DIR/.next"
ln -sfn "$APP_DIR/.next/static" "$STANDALONE_DIR/.next/static"
ln -sfn "$APP_DIR/public" "$STANDALONE_DIR/public"
ln -sfn "$APP_DIR/prisma" "$STANDALONE_DIR/prisma"
mkdir -p "$STANDALONE_DIR/node_modules"
ln -sfn "$APP_DIR/node_modules/.prisma" "$STANDALONE_DIR/node_modules/.prisma"

export NODE_ENV=production
export PORT=3000
export HOSTNAME=127.0.0.1

exec /opt/homebrew/bin/node "$STANDALONE_DIR/server.js" >> "$LOG" 2>&1
