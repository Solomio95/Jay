# Bentop HR System

Payroll, commission, leave, and approvals for Bentop's ~120-person consignment workforce across Malaysia.

## Stack

- **Mobile + Web**: Expo (React Native) + EAS — one codebase for iOS / Android / web.
- **Backend + DB**: Supabase (Postgres + RLS + Edge Functions + Storage + Auth).
- **Language**: TypeScript end-to-end.

## Layout

```
apps/
  mobile/            Expo app — promoter + manager (role-gated)
  admin-web/         Expo Web — HR admin dashboard
packages/
  domain/            Shared TS types
  commission/        Commission rule engine (pure functions)
  payroll-my/        Malaysian EPF/SOCSO/EIS/PCB calculators
  pdf/               Payslip + EA form templates
  ui/                Shared component library
supabase/
  migrations/        SQL schema + RLS
  functions/         Edge functions (erp-sync, commission-run, payroll-run, ...)
docs/                Module documentation
```

## Getting started

```bash
pnpm install
pnpm supabase start
pnpm db:reset
pnpm test
```

## Phased roadmap

See `docs/roadmap.md`. Phase 1 ships salary + statutory deductions + single-tier personal commission to one pilot state before broader rollout.
