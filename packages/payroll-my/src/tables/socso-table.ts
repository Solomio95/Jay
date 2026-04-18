// PERKESO SOCSO contribution band table (partial, illustrative only).
// Production loads the official table from `statutory_rate_tables` keyed by
// effective_from date. Bands are wage brackets; each band has fixed sen amounts.
// wageMin/wageMax are inclusive in sen; contributions are in sen.
export interface SocsoBand {
    wageMinSen: number;
    wageMaxSen: number;
    employeeSen: number;
    employerSen: number;
}

// A short illustrative slice. Full production table has ~40+ rows up to RM 5,000.
export const SOCSO_TABLE_2026: SocsoBand[] = [
    { wageMinSen:      0, wageMaxSen:   3000000, employeeSen:  10, employerSen:  40 },
    { wageMinSen:  30001, wageMaxSen:   5000000, employeeSen:  30, employerSen:  70 },
    { wageMinSen:  50001, wageMaxSen:  70000_00, employeeSen:  70, employerSen: 130 },
    { wageMinSen: 700001, wageMaxSen: 100000_00, employeeSen: 150, employerSen: 380 },
    { wageMinSen: 1000001, wageMaxSen: 500000_00, employeeSen: 250, employerSen: 660 },
];
