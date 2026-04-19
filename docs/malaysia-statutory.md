# Malaysian statutory payroll

Implementation lives in `packages/payroll-my`. The code structure is faithful
to the official formulae, but **every hard-coded numeric constant must be
cross-checked against the source documents listed below** before running
production payroll. Each fixture in `src/__fixtures__/scenarios.ts` carries a
`verifiedAgainst: null` flag that HR flips to the issuing document reference
once the snapshot is confirmed.

## Statutory components

| Component | Scope | Rate driver |
|---|---|---|
| **EPF** (KWSP) | Retirement savings | Third Schedule band lookup for monthly wage ≤ RM 20,000. Above that, 11% employee / 12% employer. Halved when age ≥ 60. |
| **SOCSO** (PERKESO) | Employment Injury + Invalidity | Category 1 (under 60): 0.5% employee + 1.75% employer. Category 2 (60+ or first registered at 55+): employer-only 1.25%. Capped at RM 5,000, rounded to nearest 5 sen. |
| **EIS** (SIP) | Unemployment insurance | 0.2% each side, capped at RM 5,000. Exempt for age ≥ 60. |
| **PCB** (LHDN MTD) | Monthly income tax deduction | Computerised Calculation Method. Separate formulae for normal and additional remuneration. Categories K and KA0..KA20. |

## Module map

```
packages/payroll-my/src/
  epf.ts                       EPF calculator (Third Schedule + >20k fallback)
  socso.ts                     SOCSO categoriser + calculator
  eis.ts                       EIS calculator with age exemption
  run.ts                       Composes EPF/SOCSO/EIS/PCB into a payslip
  tables/
    epf-third-schedule.ts      Band generator for below-60 and 60+
    socso-categories.ts        Category 1 / Category 2 rates + cap
    eis-table.ts               0.2% each side, RM 5,000 cap
  pcb/
    categories.ts              K, KA0..KA20 parser, isMarried, child count
    reliefs.ts                 Personal / spouse / child / EPF / SOCSO caps
    tax-bands.ts               YA 2024 progressive bands + § 6A rebate
    formula.ts                 MTD for normal + additional remuneration
  __fixtures__/scenarios.ts    Five payslip snapshots
  __snapshots__/               Vitest snapshots (HR verifies, flips flag)
```

## Verification checklist

Each row is one numeric constant that lives in code. Before production payroll,
HR + an accountant open the source document, compare to code, and record the
document identifier (Bil / revision / year) in the `verifiedAgainst` field.

### EPF — `tables/epf-third-schedule.ts`

Source: **KWSP Third Schedule**, published by the Employees Provident Fund of
Malaysia. Current version at kwsp.gov.my → Employer → Contribution → Third Schedule.

- [ ] Band structure: RM 0.01–10.00, then RM 20 bands up to RM 100, then RM 100 bands up to RM 20,000. Confirm boundary wage rounding (`roundUpSen`).
- [ ] Employee rate 11% below 60 / 5.5% at 60+. Confirm percentages, not the sen amounts, since bands round.
- [ ] Employer rate: 13% below 60 for wage ≤ RM 5,000; 12% below 60 for wage > RM 5,000; 6.5% or 4% at 60+. Confirm the RM 5,000 split threshold.
- [ ] Fallback above RM 20,000: 11% flat employee. Confirm that the Third Schedule tops out at RM 20,000 and that the formula method applies beyond.

### SOCSO — `tables/socso-categories.ts`

Source: **PERKESO Jadual Kadar Caruman (Contribution Rate Schedule)** under the
Employees' Social Security Act 1969, available at perkeso.gov.my.

- [ ] Category 1 rates: 0.5% employee + 1.75% employer. Confirm percentages.
- [ ] Category 2 rates: 0% employee + 1.25% employer.
- [ ] Cap at RM 5,000 — confirm wage ceiling.
- [ ] Rounding: nearest 5 sen. Confirm rounding convention (nearest vs up).
- [ ] Category 2 trigger: age ≥ 60 OR first registered at age ≥ 55. Confirm the "late registration" threshold.

### EIS — `tables/eis-table.ts`

Source: **PERKESO EIS Contribution Table** under the Employment Insurance
System Act 2017.

- [ ] 0.2% each side. Confirm percentages.
- [ ] Cap at RM 5,000.
- [ ] Age 60+ exemption (currently applied in `eis.ts`).
- [ ] Floor of 10 sen and 5-sen rounding — confirm the minimum contribution convention.

### PCB — `pcb/reliefs.ts`

Source: **Income Tax Act 1967 §§ 46–49** and the **LHDN MTD Guide** (Potongan
Cukai Bulanan Berkomputer) for YA 2024.

- [ ] Personal relief RM 9,000 (§ 46(1)(a))
- [ ] Spouse relief RM 4,000 (§ 47)
- [ ] Child under 18 RM 2,000 (§ 48(2)(a))
- [ ] Child in tertiary education RM 8,000 (§ 48(3))
- [ ] EPF + life insurance combined cap RM 7,000 (§ 49, post-YA-2023)
- [ ] SOCSO cap RM 350 (§ 46(1)(r))

Note: additional reliefs (medical, lifestyle, PRS etc.) are passed via
`additionalReliefSen` from TP1; they are not hard-coded here.

### PCB — `pcb/tax-bands.ts`

Source: **Income Tax Act 1967 Schedule 1 Part I** for YA 2024.

- [ ] Band structure (lower bound → rate):
  - RM 0 → 0%
  - RM 5,001 → 1%
  - RM 20,001 → 3%
  - RM 35,001 → 6%
  - RM 50,001 → 11%
  - RM 70,001 → 19%
  - RM 100,001 → 25%
  - RM 400,001 → 26%
  - RM 600,001 → 28%
  - RM 2,000,001 → 30%
- [ ] Cumulative tax at each lower bound (`taxAtLowerBoundSen`): 0, 0, 150, 600, 1500, 3700, 9400, 84400, 136400, 528400.
- [ ] § 6A rebate: RM 400 single / RM 800 married when chargeable income ≤ RM 35,000.

### PCB — `pcb/formula.ts`

Source: **LHDN Spesifikasi Kaedah Pengiraan Berkomputer bagi PCB** (Computerised
Calculation Method specification). Current Bil. expected 1/2024 or later.

- [ ] Normal remuneration formula: projected annual chargeable income = YTD + current × months remaining. Confirm whether LHDN projects on current month or averages YTD ÷ months elapsed.
- [ ] Additional remuneration formula: tax _with_ additional minus tax _without_, both net of rebate and zakat.
- [ ] Months remaining = 13 − monthIndex (i.e. includes current month). Confirm against LHDN's "n" definition.
- [ ] MTD rounding to nearest 5 sen; negative MTD clamped to 0.
- [ ] Zakat handling: YTD zakat subtracted from annual tax; current month zakat projected across remaining months.
- [ ] § 6A rebate applied before zakat subtraction, and only when chargeable income ≤ RM 35,000.

## Fixture verification

Each fixture in `src/__fixtures__/scenarios.ts` is a full employee-month input
that feeds `computePayslip` and snapshots the entire output. HR verifies the
snapshot once and sets `verifiedAgainst`:

| Fixture | Verified against |
|---|---|
| `single-k-rm3200-jan` | _null — to confirm_ |
| `married-ka2-rm5000-jan` | _null — to confirm_ |
| `promoter-with-commission-apr` | _null — to confirm_ |
| `senior-ka0-rm4000-jan` | _null — to confirm_ |
| `high-earner-ka3-rm15000-dec` | _null — to confirm_ |

A good verification workflow:

1. Open the LHDN _e-PCB_ portal (or a payroll SaaS with a verified MTD engine).
2. Enter the fixture inputs.
3. Compare against the snapshot numbers for EPF, SOCSO, EIS, and PCB.
4. If they match, set `verifiedAgainst: "LHDN e-PCB 2024-04-19"` (or similar).
5. If they differ, raise an issue with the delta and the reference document.

## Loading rates into the system

Rates live in the `statutory_rate_tables` table, keyed by `(kind, effective_from)`.

The HR admin web has a dedicated upload screen that:

1. Accepts a CSV or structured JSON.
2. Validates the schema.
3. Writes a new row with `effective_from`.
4. Requires a second approver before the row becomes live.

**Hard block**: `payroll-run` refuses to execute if no row covers the pay date.

## Submission files

Payroll generates these end-of-month exports:

- **Bank payroll file** — Maybank2u CSV format to start. Other banks later.
- **KWSP contribution** — CSV for iAkaun upload.
- **PERKESO** — Borang 8A via Assist Portal CSV.
- **LHDN PCB** — CP39 format.
- **EA form** — per-employee PDF at year-end.

## References

- LHDN **Spesifikasi Kaedah Pengiraan Berkomputer bagi Potongan Cukai Bulanan** — current Bil. at hasil.gov.my
- LHDN **e-PCB Calculator** — for fixture cross-checks
- KWSP **Third Schedule** — kwsp.gov.my → Employer → Contribution
- PERKESO **Jadual Kadar Caruman SOCSO & EIS** — perkeso.gov.my
- **Income Tax Act 1967**, Schedule 1 Part I (tax bands); §§ 6A (rebate), 46–49 (reliefs)
- **Employment Act 1955** (OT: 1.5× normal day, 2× rest day, 3× public holiday)
