// PERKESO SOCSO contribution table.
//
// Two categories:
//   * Category 1 — Employment Injury + Invalidity Scheme. Applies to Malaysian
//     employees below age 60 who are not first-registered after age 55.
//   * Category 2 — Employment Injury Scheme only. Applies to employees age 60+
//     and employees first-registered at age 55+.
//
// Wages above RM 5,000 are capped at RM 5,000 for contribution purposes
// (subject to PERKESO's latest ruling).
//
// The numeric sen amounts per band shipped here are computed from the
// statutory rates with PERKESO's rounding convention. Before production,
// HR MUST upload the authoritative PERKESO table via the admin screen
// (see docs/malaysia-statutory.md). This file is the fallback.

import type { Sen } from "@bentop/domain";

export type SocsoCategory = "category_1" | "category_2";

export interface SocsoBand {
    wageMinSen: number;   // inclusive
    wageMaxSen: number;   // inclusive
    employeeSen: number;
    employerSen: number;
}

// Category 1: employee 0.5%, employer 1.75% (of banded wage upper bound).
// Category 2: employee 0%, employer 1.25%.
const RATES: Record<SocsoCategory, { employee: number; employer: number }> = {
    category_1: { employee: 0.005, employer: 0.0175 },
    category_2: { employee: 0.0, employer: 0.0125 },
};

// Bands follow PERKESO's published table: typically RM 30 for the first band
// then RM 100 steps up to the RM 5,000 cap. The Employment Act defines the
// exact boundaries; this is the pattern used by their Contribution Table.
const SOCSO_CAP_SEN = 500000;  // RM 5,000

const buildTable = (category: SocsoCategory): SocsoBand[] => {
    const { employee, employer } = RATES[category];
    const bands: SocsoBand[] = [];

    // Round to nearest 5 sen, matching the PERKESO table style.
    const roundToFiveSen = (v: number): number => Math.round(v / 5) * 5;

    const addBand = (minSen: number, maxSen: number) => {
        const upper = maxSen;
        bands.push({
            wageMinSen: minSen,
            wageMaxSen: maxSen,
            employeeSen: roundToFiveSen(upper * employee),
            employerSen: roundToFiveSen(upper * employer),
        });
    };

    // First band: RM 0.01 – RM 30.
    addBand(1, 3000);

    // Bands from RM 30.01 in RM 50 chunks up to RM 100 (edge handling).
    let cursor = 3001;
    let upper = 5000;
    while (upper <= 10000) {
        addBand(cursor, upper);
        cursor = upper + 1;
        upper += 2500;
    }

    // RM 100.01 onwards: RM 100 bands up to RM 5,000.
    cursor = 10001;
    upper = 20000;
    while (upper <= SOCSO_CAP_SEN) {
        addBand(cursor, upper);
        cursor = upper + 1;
        upper += 10000;
    }

    return bands;
};

export const SOCSO_TABLE: Record<SocsoCategory, SocsoBand[]> = {
    category_1: buildTable("category_1"),
    category_2: buildTable("category_2"),
};

export const lookupSocsoBand = (
    wageSen: Sen,
    category: SocsoCategory,
): SocsoBand => {
    const capped = Math.min(wageSen, SOCSO_CAP_SEN);
    if (capped <= 0) {
        return { wageMinSen: 0, wageMaxSen: 0, employeeSen: 0, employerSen: 0 };
    }
    const table = SOCSO_TABLE[category];
    for (const band of table) {
        if (capped >= band.wageMinSen && capped <= band.wageMaxSen) return band;
    }
    return table[table.length - 1]!;
};
