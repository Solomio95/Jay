// EPF (KWSP) contribution rates. Employee: 11% (age < 60) / 5.5% (age >= 60).
// Employer: 13% when monthly wage <= RM 5,000; 12% above; halved for age >= 60.
// Wages are rounded UP to the next RM1 before computation, and contributions
// follow KWSP's "Third Schedule" band tables for wages <= RM 20,000.
// For scaffolding purposes this file uses the percentage formulation; the
// production system replaces it with the exact KWSP band-lookup table.
export interface EpfRateInputs {
    employeeBelow60: number;      // 0.11
    employeeAbove60: number;      // 0.055
    employerLowBandBelow60: number;   // 0.13 when wage <= threshold
    employerHighBandBelow60: number;  // 0.12 when wage > threshold
    employerLowBandAbove60: number;   // 0.065
    employerHighBandAbove60: number;  // 0.06
    wageThreshold: number;        // 5000 (RM)
}

export const EPF_RATES_2026: EpfRateInputs = {
    employeeBelow60: 0.11,
    employeeAbove60: 0.055,
    employerLowBandBelow60: 0.13,
    employerHighBandBelow60: 0.12,
    employerLowBandAbove60: 0.065,
    employerHighBandAbove60: 0.06,
    wageThreshold: 5000,
};
