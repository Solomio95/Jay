// KWSP Third Schedule — contribution bands for wages up to RM 20,000.
//
// Source: KWSP (Employees Provident Fund Act 1991), Third Schedule,
// Part A (Below age 60) and Part B (Age 60 and above).
//
// Rules encoded:
//   * Bands are by exact wage range (not straight percentage).
//   * For wages > RM 20,000, KWSP applies the STATUTORY RATE to the full wage.
//   * Employer pays 13% for monthly wage ≤ RM 5,000, otherwise 12% (below 60).
//   * For age 60+: employee 5.5%, employer 6.5% / 6.0% (same threshold).
//   * Each band specifies the INTEGER sen amount for employee and employer.
//
// The concrete numeric table shipped here is a faithful computation from the
// percentage rules with the same rounding convention KWSP uses (round up to
// the next ringgit for employee, then derive employer by the appropriate
// rate). Before production, HR must upload the authoritative Third Schedule
// CSV via the admin screen — see docs/malaysia-statutory.md — and the
// `statutory_rate_tables` row will override these defaults.

import type { Sen } from "@bentop/domain";

export type EpfCategory = "below_60" | "age_60_plus";

export interface EpfBand {
    wageMinSen: number;              // inclusive
    wageMaxSen: number;              // inclusive
    employeeSen: number;
    employerLowBandSen: number;      // employer share when this wage <= RM 5,000
    employerHighBandSen: number;     // employer share when this wage > RM 5,000
}

// Generate the band table computationally so the rounding is transparent.
// Bands:
//   * 0.01 – 10.00 in RM 10 steps (edge case)
//   * 10.01 – 20.00 etc. until RM 100 in RM 20 steps
//   * Above RM 100 up to RM 20,000 in RM 100 steps
// Each band's contribution is computed off the UPPER bound of the band and
// rounded UP to the next ringgit for the employee portion. The employer
// portion is rounded UP to the next ringgit separately.
const roundUpSen = (valueSen: number): number => {
    const mod = valueSen % 100;
    if (mod === 0) return valueSen;
    return valueSen - mod + 100;
};

const buildTable = (category: EpfCategory): EpfBand[] => {
    const employeeRate = category === "below_60" ? 0.11 : 0.055;
    const employerLowRate = category === "below_60" ? 0.13 : 0.065;
    const employerHighRate = category === "below_60" ? 0.12 : 0.06;

    const bands: EpfBand[] = [];
    const addBand = (minSen: number, maxSen: number) => {
        const upper = maxSen;
        bands.push({
            wageMinSen: minSen,
            wageMaxSen: maxSen,
            employeeSen: roundUpSen(Math.round(upper * employeeRate)),
            employerLowBandSen: roundUpSen(Math.round(upper * employerLowRate)),
            employerHighBandSen: roundUpSen(Math.round(upper * employerHighRate)),
        });
    };

    let cursor = 1; // sen
    // 0.01 – 10.00 → single band
    addBand(cursor, 1000);
    cursor = 1001;

    // 10.01 – 20.00 and subsequent RM 20 bands up to RM 100
    let upper = 2000;
    while (cursor <= 10000) {
        addBand(cursor, upper);
        cursor = upper + 1;
        upper += 2000;
    }

    // Above RM 100 in RM 100 bands up to RM 20,000
    upper = 20000;
    while (cursor <= 2000000) {
        addBand(cursor, upper);
        cursor = upper + 1;
        upper += 10000;
    }
    return bands;
};

export const EPF_THIRD_SCHEDULE: Record<EpfCategory, EpfBand[]> = {
    below_60: buildTable("below_60"),
    age_60_plus: buildTable("age_60_plus"),
};

// Wage threshold for the low-band vs high-band employer rate (in sen).
export const EPF_EMPLOYER_THRESHOLD_SEN = 500000; // RM 5,000

export const lookupEpfBand = (
    wageSen: Sen,
    category: EpfCategory,
): EpfBand | null => {
    if (wageSen <= 0) return null;
    const table = EPF_THIRD_SCHEDULE[category];
    // Binary-search would be nicer; linear is fine at ~200 rows.
    for (const band of table) {
        if (wageSen >= band.wageMinSen && wageSen <= band.wageMaxSen) return band;
    }
    return null;  // wage exceeds RM 20,000 — caller uses percentage rule
};
