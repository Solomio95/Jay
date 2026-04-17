@AGENTS.md

# Bentop Collection ERP — Claude Code Guide

## What this project is
A full-stack ERP web application for **Bentop Collection**, a Malaysian apparel company. Built with Next.js 16, Prisma, PostgreSQL, and shadcn/ui. Handles inventory, sales, consignment, multi-currency (MYR/USD/RMB), reports, and mobile PWA.

## Tech stack
- **Framework**: Next.js 16.2.3 (App Router, TypeScript strict)
- **Database**: PostgreSQL via Prisma 5.22.0
- **Auth**: NextAuth v5 beta (JWT, email+password)
- **UI**: shadcn/ui (Radix + Tailwind 4)
- **Package manager**: npm

## First-time setup (do these in order)

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Configure environment
Copy the example env file and fill in your values:
```bash
cp .env.example .env
```

Edit `.env` with:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/bentop_erp?schema=public"
AUTH_SECRET="<run: openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
```

**Free cloud database options** (no local Postgres needed):
- [Neon](https://neon.tech) — free tier, copy the connection string directly
- [Supabase](https://supabase.com) — free tier, use the "URI" connection string

### Step 3 — Push database schema
```bash
npx prisma db push
```
This creates all tables. No migrations needed.

### Step 4 — Seed sample data (recommended)
```bash
npx prisma db seed
```
Creates sample users, products, locations, customers, orders, and channels so the dashboard has data on first login.

### Step 5 — Run the app
```bash
npm run dev
```
Open http://localhost:3000

## Default login credentials (after seeding)
| Email | Password | Role |
|-------|----------|------|
| admin@bentop.com | admin123 | Admin (full access) |
| siti@bentop.com | staff123 | Manager |

## Common commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm start            # Run production build
npx prisma studio    # Browse database visually
npx prisma db push   # Sync schema to DB (after schema changes)
npx prisma db seed   # Re-seed sample data
```

## Project structure
```
src/
  app/
    (auth)/          # Login page
    (dashboard)/     # All ERP pages (inventory, sales, consignment, settings)
    api/v1/          # REST API routes
  components/
    layout/          # Sidebar, header, mobile nav
    inventory/       # Inventory forms and tables
    sales/           # Order forms, POS
    consignment/     # Consignment forms
    settings/        # Settings forms
    ui/              # shadcn/ui primitives
  lib/
    auth.ts          # NextAuth config
    db.ts            # Prisma client
    validators/      # Zod schemas
prisma/
  schema.prisma      # Database schema
  seed.ts            # Sample data
```

## Key conventions
- All API routes live under `src/app/api/v1/`
- Role checks: `ADMIN` > `MANAGER` > `VIEWER` (viewers are read-only)
- Soft deletes: records are set `isActive: false`, never hard deleted
- All mutations write to `AuditLog`
- Currency: MYR is base; USD/RMB use `exchangeRateToMyr` for conversion
- Next.js 16 params are Promises: always `await params` before accessing

## Troubleshooting
- **"Can't reach database"** — Check your DATABASE_URL is correct and the database exists
- **"Invalid AUTH_SECRET"** — Run `openssl rand -base64 32` and paste the result
- **Prisma type errors** — Run `npx prisma generate` to regenerate the client
- **Build fails** — Run `npx tsc --noEmit` to see TypeScript errors
