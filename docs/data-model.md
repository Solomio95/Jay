# Data model

The authoritative definition lives in `supabase/migrations/0001_init_schema.sql`.
This doc explains **why** the shape is what it is and points out the handful of
invariants that aren't obvious from the SQL alone.

## Principles

- **Every employee-visible table has RLS on.** Policies live in `0002_rls_policies.sql`.
- **Monetary amounts are `numeric(12,2)` in the database** and integer sen
  (`Sen` brand type) in TypeScript. Conversion happens at the edge.
- **Hierarchy is time-sliced**, not a static parent pointer. `employee_assignments`
  carries `effective_from` / `effective_to` so that a mid-month counter move
  or manager change is resolved correctly when commission runs.
- **Audit first, reporting second.** Commission and payroll write one row per
  rule fired per employee (`commission_line_items`, `payslips.other_deductions`)
  so the "why did I get paid this?" question is always answerable.

## Core relationships

```
profiles (1) ── (1) employees (1) ── (n) employee_assignments (n) ── (1) counters
                           │
                           ├── (n) sales_records
                           ├── (n) leave_requests
                           ├── (n) ot_records
                           └── (n) payslips ── (n) payroll_runs
```

## Commission snapshot strategy

Once a `payroll_run` references a `commission_scheme`, the scheme row is
considered frozen. Edits create a new scheme row (new `id`, new `effective_from`).
This is what lets historical reruns reproduce exactly.

## Sales amendments

If the ERP sends a higher `version` for the same `external_id`:

1. Insert a new `sales_records` row with `external_id = "<orig>#v<new_version>"`.
2. Set the old row's `superseded_by = new_row.id`.
3. Commission pipelines filter on `superseded_by IS NULL` so only the latest row counts.

If the amendment lands **after** a payroll run is locked, the delta is booked
into `commission_adjustments` (to be added in 0003) for the next month.

## Things we deliberately didn't model

- **Expense claims** — deferred to a later phase.
- **Training records** — deferred.
- **Multi-entity / multi-country** — the `currency` column is in place on
  `sales_records` but there is no `entities` table yet. MY-only for now.
