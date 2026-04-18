// PCB (MTD — Potongan Cukai Bulanan) per LHDN formula method.
// This is a SIMPLIFIED scaffold. Before running production payroll, replace
// with the full LHDN MTD formula (see docs/malaysia-statutory.md) including:
//   * Category K, KA1, KA2, KA3 ...
//   * Disabled dependents relief
//   * Medical / parental / life-insurance relief caps
//   * Zakat/rebates
//   * Bonus tax averaging
// The production calculator lives behind loadPcbFormula(asOf) which reads the
// effective formula JSON from `statutory_rate_tables`.

export interface PcbInputs {
    category: "K" | "KA1" | "KA2" | "KA3" | "KA4" | "KA5";
    dependents: number;
    ytdTaxableIncomeSen: number;
    ytdPcbPaidSen: number;
    currentMonthTaxableSen: number;
    epfYtdSen: number;
    monthsRemaining: number;  // months left in the year incl. current
}

// Progressive band structure stand-in — replace with LHDN's official formula.
const BANDS: { upperSen: number; rate: number; accumSen: number }[] = [
    { upperSen:  500000, rate: 0.00, accumSen:      0 },   // 0 - 5k @ 0%
    { upperSen: 2000000, rate: 0.01, accumSen:      0 },   // 5k - 20k @ 1%
    { upperSen: 3500000, rate: 0.03, accumSen:  15000 },   // 20k - 35k @ 3%
    { upperSen: 5000000, rate: 0.06, accumSen:  60000 },   // 35k - 50k @ 6%
    { upperSen: 7000000, rate: 0.11, accumSen: 150000 },   // 50k - 70k @ 11%
    { upperSen: 10000000, rate: 0.19, accumSen: 370000 },  // 70k - 100k @ 19%
    { upperSen: Number.MAX_SAFE_INTEGER, rate: 0.25, accumSen: 940000 },
];

export const estimateAnnualTaxSen = (annualTaxableSen: number): number => {
    if (annualTaxableSen <= 0) return 0;
    let lowerSen = 0;
    for (const band of BANDS) {
        if (annualTaxableSen <= band.upperSen) {
            const slice = annualTaxableSen - lowerSen;
            return Math.round(band.accumSen + slice * band.rate);
        }
        lowerSen = band.upperSen;
    }
    return 0;
};
