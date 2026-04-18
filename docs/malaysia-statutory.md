# Malaysian statutory payroll

Implementation lives in `packages/payroll-my`. **The current code is a
scaffold.** Before running production payroll, every calculator must be
replaced with the official LHDN / KWSP / PERKESO tables and formulae, with a
golden-file test suite.

## Statutory components

| Component | Scope | Rate driver |
|---|---|---|
| **EPF** (KWSP) | Retirement savings | Employee 11%, employer 13% (wage ≤ RM5,000) / 12% (wage > RM5,000). Halved when age ≥ 60. Wage rounded up to the nearest ringgit. |
| **SOCSO** (PERKESO) | Employment Injury + Invalidity | Fixed sen per wage band. Capped at RM5,000. Tables published by PERKESO. |
| **EIS** (SIP) | Unemployment insurance | 0.2% each side, capped at RM5,000 wage. |
| **PCB** (LHDN MTD) | Monthly income tax deduction | Progressive formula with personal relief by category (K, KA1…), EPF relief, dependents relief, etc. |

## Loading rates into the system

Rates live in the `statutory_rate_tables` table, keyed by `(kind, effective_from)`.

The HR admin web has a dedicated upload screen that:

1. Accepts a CSV or structured JSON.
2. Validates the schema.
3. Writes a new row with `effective_from`.
4. Requires a second approver before the row becomes live.

**Hard block**: `payroll-run` refuses to execute if no row covers the pay date.

## To-do before production

- [ ] Replace `epf.ts` with the official KWSP Third Schedule band-lookup for
      wages ≤ RM20,000.
- [ ] Replace `socso-table.ts` with the full PERKESO table (40+ bands).
- [ ] Replace `pcb-formula.ts` with the full LHDN MTD formula per the latest
      _Garis Panduan Potongan Cukai Bulanan_ (include all reliefs, rebates,
      bonus averaging, mid-year joiner adjustments).
- [ ] Write golden-file tests that reproduce LHDN's published worked examples
      to the sen.
- [ ] Build the "update statutory rates" admin screen.
- [ ] Set a November + December reminder job that pings HR if the next year's
      rate row is not yet loaded.

## Submission files

Payroll generates these end-of-month exports:

- **Bank payroll file** — Maybank2u CSV format to start. Other banks later.
- **KWSP contribution** — CSV for iAkaun upload.
- **PERKESO** — Borang 8A via Assist Portal CSV.
- **LHDN PCB** — CP39 format.
- **EA form** — per-employee PDF at year-end.

## References

- LHDN MTD formula (Bil. 1/2023 or later — check LHDN website for current version)
- KWSP Third Schedule
- PERKESO SOCSO contribution table
- Employment Act 1955 (OT: 1.5× normal day, 2× rest day, 3× public holiday)
