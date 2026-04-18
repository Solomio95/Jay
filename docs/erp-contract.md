# Bentop ERP ↔ HR integration contract

The HR system is downstream of the existing Bentop ERP. Sales data flows one
way: ERP → HR. No writes go back.

## Endpoints (to confirm with ERP maintainer)

```
GET /api/v1/sales?from=YYYY-MM-DD&to=YYYY-MM-DD&counter_code=...&page=N
GET /api/v1/sales/{external_id}
GET /api/v1/counters
GET /api/v1/returns?from=...&to=...
```

Authentication: `Authorization: Bearer <token>` using a service account token
held in the `BENTOP_ERP_TOKEN` edge-function secret.

## Sale payload

```json
{
  "external_id": "INV-2026-04-000123",
  "counter_code": "KL-PAV-01",
  "employee_code": "E001",
  "sale_date": "2026-04-30",
  "gross": 1234.50,
  "returns": 0.00,
  "currency": "MYR",
  "version": 1,
  "last_modified_at": "2026-04-30T18:20:01Z"
}
```

Fields the HR system relies on:

- `external_id` — uniquely identifies the sale across its lifetime. Must not
  be reused even after a voided sale.
- `version` + `last_modified_at` — incremented whenever the sale is amended.
  The HR system uses these to detect and apply amendments.
- `employee_code` — matches `employees.employee_no`. May be `null` if the
  ERP has no promoter attribution at the time of writing; the HR system will
  not compute commission for unattributed sales.

## Sync schedule

| Trigger | Window | Purpose |
|---|---|---|
| pg_cron hourly | last 48h | Catch fresh sales + amendments quickly |
| pg_cron nightly 03:00 MYT | last 7 days | Full reconcile |
| Manual (HR admin) | any range | Forced re-sync around month-end |
| Payroll cutoff day | full closing month | Final freeze before the payroll run |

## Idempotency and amendments

1. `sales_records.external_id` is `UNIQUE`. Repeat inserts are no-ops.
2. When the ERP returns a higher `version`, the HR system inserts a new row
   with `external_id = "<orig>#v<version>"` and sets the previous row's
   `superseded_by` to the new id.
3. Commission pipelines read only rows where `superseded_by IS NULL`.

## What must NOT happen on the ERP side

- Deleting a sale row. Mark it as `voided = true`, bump `version`,
  `last_modified_at`.
- Changing the `external_id` after the first publication.
- Silent employee reassignment. Amendments that move a sale to a different
  promoter MUST bump `version` so the HR system recomputes.

## Failure modes

- Sync fails → row written to `sales_sync_runs` with `error_message`.
  Admin dashboard shows a red banner. **Payroll cannot be finalised while an
  unresolved sync error exists.**
- Unknown `counter_code` → sale is skipped and logged; HR needs to create the
  counter in the admin web.
- Unknown `employee_code` → sale is inserted with `employee_id = null` and
  does not earn commission until reassigned.
