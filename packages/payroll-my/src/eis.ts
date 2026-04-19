import { type Sen } from "@bentop/domain";
import { lookupEisBand } from "./tables/eis-table.js";

export interface EisInput {
    wageSen: Sen;
    ageYears: number;
}

export interface EisOutput {
    employeeSen: Sen;
    employerSen: Sen;
    exempt: boolean;
}

// Employees aged 60+ are exempt from EIS per PERKESO guidance.
export const computeEis = (input: EisInput): EisOutput => {
    if (input.ageYears >= 60 || input.wageSen <= 0) {
        return { employeeSen: 0 as Sen, employerSen: 0 as Sen, exempt: true };
    }
    const band = lookupEisBand(input.wageSen);
    return {
        employeeSen: band.employeeSen as Sen,
        employerSen: band.employerSen as Sen,
        exempt: false,
    };
};
