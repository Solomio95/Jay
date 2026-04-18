# Commission & KPI rule schema

Rules are stored as rows in `commission_rules` (sales-driven) and `kpi_rules`
(behaviour-driven), each carrying a `config` JSONB. The engine lives in
`packages/commission` and is invoked by the `commission-run` edge function.

## `commission_rules.config`

### `tiered_personal`
```json
{
  "basis": "personal_net_sales",
  "tiers": [
    { "min": 0,       "max": 2000000,  "pct": 3 },
    { "min": 2000000, "max": 4000000,  "pct": 5 },
    { "min": 4000000, "max": null,     "pct": 7 }
  ]
}
```
- Amounts are in **sen**.
- Each tier earns only on the slice of sales that falls inside the tier.
- The engine emits one `commission_line_item` per tier that contributed so the
  payslip can show the breakdown.

### `override_team`
```json
{ "basis": "team_net_sales", "teamScope": "direct_reports", "pct": 0.5 }
```
- `teamScope`: `direct_reports` (one level) or `all_subordinates` (transitive).
- Applied to managers whose role matches `applies_to_role`.

### `override_region`
```json
{ "basis": "region_net_sales", "pct": 0.2 }
```
- Sums sales of every employee whose assignment maps to the same region as the
  manager, for each sale_date in the period.

### `flat`
```json
{ "amount": 5000, "perUnit": "signup" }
```
- `perUnit` is informational; if set to `"sale"`/`"customer"`/`"signup"`, the
  amount multiplies by the number of such events recorded for the period.

## `kpi_rules.config`

```json
{
  "metric": "attendance_rate",
  "bands": [
    { "gte": 0.98, "bonus": 25000 },
    { "gte": 0.95, "bonus": 15000 }
  ]
}
```
- Bands are evaluated top-to-bottom; first match wins.
- Use `gte` for "higher is better" metrics, `lte` for "lower is better"
  (e.g. return rate).

## Worked example

See `packages/commission/src/pipeline.test.ts` for the Aishah / Faizal / Hooi
April 2026 example that matches the figures in the implementation plan
(Aishah RM 1,470, Faizal RM 1,090, Hooi RM 1,480).

## Scheme safety

- Schemes are **versioned**, not edited in place.
- The admin web runs a shadow simulation against the last 3 months on every
  save and shows the delta vs the currently active scheme.
- Activation requires a second approver. The `approved_by` + `approved_at`
  columns capture the record.
