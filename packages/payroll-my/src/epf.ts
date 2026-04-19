import { type Sen } from "@bentop/domain";
import {
    EPF_EMPLOYER_THRESHOLD_SEN,
    type EpfCategory,
    lookupEpfBand,
} from "./tables/epf-third-schedule.js";

export interface EpfInput {
    wageSen: Sen;            // EPF-liable wage (basic + allowances by default; commission excluded unless policy says otherwise)
    ageYears: number;
}

export interface EpfOutput {
    employeeSen: Sen;
    employerSen: Sen;
    ruleApplied: "third_schedule" | "percentage_over_20k";
}

// KWSP splits the world at age 60 (employee drops to 5.5%, employer halves).
// Foreign workers have a different scheme entirely — that's a separate employee
// category not yet modelled. See docs/malaysia-statutory.md § "Foreign workers".
const categoryFor = (ageYears: number): EpfCategory =>
    ageYears >= 60 ? "age_60_plus" : "below_60";

export const computeEpf = (input: EpfInput): EpfOutput => {
    if (input.wageSen <= 0) {
        return { employeeSen: 0 as Sen, employerSen: 0 as Sen, ruleApplied: "third_schedule" };
    }
    const category = categoryFor(input.ageYears);

    const band = lookupEpfBand(input.wageSen, category);
    if (band) {
        const employerSen =
            input.wageSen <= EPF_EMPLOYER_THRESHOLD_SEN
                ? band.employerLowBandSen
                : band.employerHighBandSen;
        return {
            employeeSen: band.employeeSen as Sen,
            employerSen: employerSen as Sen,
            ruleApplied: "third_schedule",
        };
    }

    // Wage > RM 20,000 → percentage rule on the actual wage.
    const employeeRate = category === "below_60" ? 0.11 : 0.055;
    const employerRate = category === "below_60" ? 0.12 : 0.06;
    return {
        employeeSen: Math.ceil(input.wageSen * employeeRate) as Sen,
        employerSen: Math.ceil(input.wageSen * employerRate) as Sen,
        ruleApplied: "percentage_over_20k",
    };
};
