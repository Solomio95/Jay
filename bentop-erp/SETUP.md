# Bentop ERP — Production Setup (Mac mini)

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Internet                                                       │
│  https://erp.bentoperp.com  ──→  Cloudflare DNS (proxied)       │
│                                         ↓                       │
│  Cloudflare Edge                                             │
│  (SSL termination, DDoS protection)                             │
│         ↓                                                       │
│  cloudflared tunnel (bentop-main, id: 267755ad-...)             │
│  LaunchAgent: homebrew.mxcl.cloudflared                         │
│         ↓                                                       │
│  localhost:3000                                                  │
│  ┌─────────────────────────────────────┐                        │
│  │  Next.js 16.2.3 production server   │                        │
│  │  Standalone build (output:standalone)│                       │
│  │  LaunchAgent: ai.oyenai.bentop-erp  │                        │
│  └──────────┬──────────────────────────┘                        │
│             ↓                                                   │
│  ┌─────────────────────┐     ┌──────────────────────┐           │
│  │  Prisma ORM v5.22   │────→│  PostgreSQL 16 Alpine │          │
│  │                     │     │  Docker container     │          │
│  │                     │     │  port 5434 (local)    │          │
│  └─────────────────────┘     │  No public exposure   │          │
│                              └──────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Repository Setup

```bash
# Working directory (own git repo)
cd /Users/oyenai/.openclaw/workspace/Jay/bentop-erp

# Pull latest
git stash            # stash local changes if any
git pull origin main # current: 359a718 "Add bulk SKU selection for stock operations"
```

## 2. Database (PostgreSQL — Docker)

```bash
# DB runs in Docker, local only (no port exposure beyond localhost)
docker ps | grep bentop-erp-db
# → bentop-erp-db-1  postgres:16-alpine  0.0.0.0:5434→5432

# Connection string (in .env):
# DATABASE_URL="postgresql://bentop:bentop_secret@localhost:5434/bentop_erp?schema=public"

# Verify local-only binding (no 0.0.0.0):
lsof -i -P | grep 5434
# → all connections are localhost:5434 → localhost:*
```

## 3. Prisma Schema Sync

```bash
cd /Users/oyenai/.openclaw/workspace/Jay/bentop-erp
npx prisma generate           # Generate Prisma Client (v5.22.0)
npx prisma db push            # Push schema → DB (idempotent; 44 models)
```

## 4. Production Build

```bash
npm run build
# Next.js 16.2.3, Turbopack, 86 routes compiled
# Output: .next/standalone/
```

## 5. Production Server

`next start` refuses to work with `output: "standalone"` in `next.config.ts`.  
Instead, run the standalone server directly with symlinked static assets.

### Wrapper script: `scripts/start-production.sh`

```bash
#!/bin/bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR/.next/standalone"

# Symlink static assets that standalone mode moves out-of-tree
ln -sf "$DIR/public" "$DIR/.next/standalone/public"
ln -sf "$DIR/.next/static" "$DIR/.next/standalone/.next/static"
ln -sf "$DIR/prisma" "$DIR/.next/standalone/prisma"
ln -sf "$DIR/node_modules/.prisma" "$DIR/.next/standalone/node_modules/.prisma"

export NODE_ENV=production
export PORT=3000
export HOSTNAME=127.0.0.1
exec node server.js
```

### Direct invocation (for testing):

```bash
bash scripts/start-production.sh
```

### Log file:

```
/opt/homebrew/var/log/bentop-erp.log
```

## 6. Cloudflare Tunnel

### Tunnel: `bentop-main`
- Tunnel ID: `267755ad-4f5e-454b-aa03-046f3da77055`
- Routes `erp.bentoperp.com` → `http://127.0.0.1:3000`

### Config file: `/Users/oyenai/.cloudflared/config.yml`

```yaml
tunnel: 267755ad-4f5e-454b-aa03-046f3da77055
credentials-file: /Users/oyenai/.cloudflared/267755ad-4f5e-454b-aa03-046f3da77055.json
ingress:
  - hostname: erp.bentoperp.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

### Test tunnel status:

```bash
/opt/homebrew/opt/cloudflared/bin/cloudflared tunnel info bentop-main
```

## 7. Auto-Start on Reboot (LaunchAgents)

### Cloudflared: `~/Library/LaunchAgents/homebrew.mxcl.cloudflared.plist`

- Runs: `/opt/homebrew/opt/cloudflared/bin/cloudflared tunnel run`
- Loaded at boot via `RunAtLoad`, kept alive via `KeepAlive`

### ERP App: `~/Library/LaunchAgents/ai.oyenai.bentop-erp.plist`

```xml
<key>EnvironmentVariables</key>
<dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PORT</key>
    <string>3000</string>
    <key>HOSTNAME</key>
    <string>127.0.0.1</string>
</dict>
<key>ProgramArguments</key>
<array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/oyenai/.openclaw/workspace/Jay/bentop-erp/.next/standalone/server.js</string>
</array>
```

### Load/unload commands:

```bash
# Load
launchctl load ~/Library/LaunchAgents/ai.oyenai.bentop-erp.plist
launchctl load ~/Library/LaunchAgents/homebrew.mxcl.cloudflared.plist

# Verify loaded
launchctl list | grep -E "bentop|cloudflared"

# Restart
launchctl kickstart gui/501/ai.oyenai.bentop-erp
launchctl kickstart gui/501/homebrew.mxcl.cloudflared
```

## 8. Verify Pages

### Login page (SSL):

```bash
curl -s -o /dev/null -w "%{http_code}" https://erp.bentoperp.com/login
# → 200
```

### Authenticated session:

```bash
# Get CSRF token
CSRF=$(curl -s -c /tmp/cookies.txt https://erp.bentoperp.com/api/auth/csrf | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# Sign in
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST https://erp.bentoperp.com/api/auth/callback/credentials \
  -d "csrfToken=$CSRF&email=admin@bentop.com&password=admin123" > /dev/null

# Check session
curl -s -b /tmp/cookies.txt https://erp.bentoperp.com/api/auth/session
# → {"user":{"name":"Ahmad Razak","email":"admin@bentop.com","role":"ADMIN",...},"expires":"..."}
```

### All pages respond (authenticated):

| Page | Status |
|---|---|
| `/` (Dashboard) | 200 |
| `/inventory` | 200 |
| `/inventory/stock/in` | 200 |
| `/inventory/stock/out` | 200 |
| `/inventory/adjustments` | 200 |
| `/inventory/locations` | 200 |
| `/inventory/categories` | 200 |
| `/inventory/products` | 200 |
| `/inventory/reports` | 200 |
| `/purchases/orders` | 200 |
| `/purchases/orders/new` | 200 |
| `/purchases/suppliers` | 200 |
| `/consignment` | 200 |
| `/consignment/reports` | 200 |
| `/sales/orders` | 200 |
| `/sales/reports` | 200 |
| `/promoter/sales` | 200 |
| `/settings/users` | 200 |

## 9. Login Credentials (Demo)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bentop.com` | `admin123` |
| Manager | `siti@bentop.com` | (same hash) `admin123` |
| Manager | `james@bentop.com` | `admin123` |
| Promoter | `promoter@bentop.com` | `promoter123` |

> **Note:** The seeded users (`siti`, `james`, `mei`, `viewer`) all share the same password hash as `admin@bentop.com` except `promoter` and `supervisor` who have unique hashes.

## 10. Architecture Summary

```
Service        Port   Type              Auto-start  Public?
───────        ────   ────              ──────────  ──────
Next.js (ERP)  3000   Node.js process   ✅ LaunchAgt  Via Cloudflare Tunnel
PostgreSQL     5434   Docker            ✅ Docker     ❌ Localhost only
Cloudflared    —      Tunnel daemon     ✅ LaunchAgt  Edge → localhost
OpenClaw       18789  Gateway process   ✅ LaunchAgt  ❌ Localhost only
```

## Key Commands Cheatsheet

```bash
# Deploy latest code
cd /Users/oyenai/.openclaw/workspace/Jay/bentop-erp
git stash
git pull origin main
npx prisma generate && npx prisma db push
npm run build
launchctl kickstart gui/501/ai.oyenai.bentop-erp

# View server logs
tail -f /opt/homebrew/var/log/bentop-erp.log

# Check tunnel status
/opt/homebrew/opt/cloudflared/bin/cloudflared tunnel info bentop-main
```
