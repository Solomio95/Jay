// EIS (Employment Insurance System / SIP) contribution table.
//
// Rate: employee 0.2% + employer 0.2% of wage, capped at RM 5,000.
// Applies to Malaysian employees aged 18–60 (age 60+ are exempt).
// PERKESO publishes a band table with integer sen amounts similar to SOCSO;
// rounding follows the same RM 100 wage-band convention above RM 100.

import type { Sen } from "@bentop/domain";

export interface EisBand {
    wageMinSen: number;
    wageMaxSen: number;
    employeeSen: number;
    employerSen: number;
}

const RATE = 0.002;
const WAGE_CAP_SEN = 500000;  // RM 5,000

const roundToFiveSen = (v: number): number => Math.round(v / 5) * 5;

const buildTable = (): EisBand[] => {
    const bands: EisBand[] = [];
    const addBand = (minSen: number, maxSen: number) => {
        const upper = maxSen;
        const sen = Math.max(10, roundToFiveSen(upper * RATE));  // floor at 10 sen
        bands.push({
            wageMinSen: minSen,
            wageMaxSen: maxSen,
            employeeSen: sen,
            employerSen: sen,
        });
    };

    // First band covers small wages up to RM 30.
    addBand(1, 3000);

    // RM 30.01 – RM 100 in RM 50 chunks.
    let cursor = 3001;
    let upper = 5000;
    while (upper <= 10000) {
        addBand(cursor, upper);
        cursor = upper + 1;
        upper += 2500;
    }

    // RM 100.01 – RM 5,000 in RM 100 chunks.
    cursor = 10001;
    upper = 20000;
    while (upper <= WAGE_CAP_SEN) {
        addBand(cursor, upper);
        cursor = upper + 1;
        upper += 10000;
    }
    return bands;
};

export const EIS_TABLE: EisBand[] = buildTable();
export const EIS_WAGE_CAP_SEN = WAGE_CAP_SEN;

export const lookupEisBand = (wageSen: Sen): EisBand => {
    const capped = Math.min(wageSen, WAGE_CAP_SEN);
    if (capped <= 0) return { wageMinSen: 0, wageMaxSen: 0, employeeSen: 0, employerSen: 0 };
    for (const band of EIS_TABLE) {
        if (capped >= band.wageMinSen && capped <= band.wageMaxSen) return band;
    }
    return EIS_TABLE[EIS_TABLE.length - 1]!;
};
