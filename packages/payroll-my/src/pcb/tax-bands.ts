// LHDN resident individual income tax bands.
//
// Source: Malaysian Income Tax Act 1967, Schedule 1, Part I.
// Values below are the YA 2024 bands — verify against the latest LHDN
// publication for the assessment year in question.

import type { Sen } from "@bentop/domain";

export interface TaxBand {
    upperSen: number;               // upper bound of this band (inclusive, in sen)
    rate: number;                   // marginal rate for chargeable income in this band
    taxAtLowerBoundSen: number;     // tax already accumulated from all lower bands
}

// YA 2024 resident individual tax bands.
//   0 – 5,000            0%
//   5,001 – 20,000       1%
//   20,001 – 35,000      3%
//   35,001 – 50,000      6%
//   50,001 – 70,000      11%
//   70,001 – 100,000     19%
//   100,001 – 400,000    25%
//   400,001 – 600,000    26%
//   600,001 – 2,000,000  28%
//   above 2,000,000      30%
//
// `taxAtLowerBoundSen` is the cumulative tax paid at the LOWER bound of the band
// (i.e. the tax on all income in the lower bands). Used as:
//     tax(income) = taxAtLowerBoundSen + (income − lowerBound) × rate
export const TAX_BANDS_YA2024: TaxBand[] = [
    { upperSen:    500000, rate: 0.00, taxAtLowerBoundSen:          0 },      // 0–5,000
    { upperSen:   2000000, rate: 0.01, taxAtLowerBoundSen:          0 },      // 5,001–20,000 (lower=5k, tax at 5k = 0)
    { upperSen:   3500000, rate: 0.03, taxAtLowerBoundSen:      15000 },      // 20,001–35,000 (tax at 20k = 150)
    { upperSen:   5000000, rate: 0.06, taxAtLowerBoundSen:      60000 },      // 35,001–50,000 (tax at 35k = 600)
    { upperSen:   7000000, rate: 0.11, taxAtLowerBoundSen:     150000 },      // 50,001–70,000 (tax at 50k = 1,500)
    { upperSen:  10000000, rate: 0.19, taxAtLowerBoundSen:     370000 },      // 70,001–100,000 (tax at 70k = 3,700)
    { upperSen:  40000000, rate: 0.25, taxAtLowerBoundSen:     940000 },      // 100,001–400,000 (tax at 100k = 9,400)
    { upperSen:  60000000, rate: 0.26, taxAtLowerBoundSen:    8440000 },      // 400,001–600,000 (tax at 400k = 84,400)
    { upperSen: 200000000, rate: 0.28, taxAtLowerBoundSen:   13640000 },      // 600,001–2,000,000 (tax at 600k = 136,400)
    { upperSen: Number.MAX_SAFE_INTEGER, rate: 0.30, taxAtLowerBoundSen: 52840000 },  // > 2,000,000 (tax at 2M = 528,400)
];

export const computeAnnualTaxSen = (
    chargeableIncomeSen: Sen,
    bands: TaxBand[] = TAX_BANDS_YA2024,
): number => {
    if (chargeableIncomeSen <= 0) return 0;
    let lowerSen = 0;
    for (const band of bands) {
        if (chargeableIncomeSen <= band.upperSen) {
            const slice = chargeableIncomeSen - lowerSen;
            return Math.round(band.taxAtLowerBoundSen + slice * band.rate);
        }
        lowerSen = band.upperSen;
    }
    return 0;  // unreachable thanks to the MAX_SAFE_INTEGER upper band
};

// Rebate under § 6A ITA: RM 400 if chargeable income <= RM 35,000.
// Married individuals where spouse has no income get an additional RM 400.
export const computeRebateSen = (params: {
    chargeableIncomeSen: Sen;
    married: boolean;
}): number => {
    if (params.chargeableIncomeSen > 3500000) return 0;
    const base = 40000;                       // RM 400
    return params.married ? base * 2 : base;  // RM 800 married, RM 400 single
};
