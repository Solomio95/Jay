import { type Sen } from "@bentop/domain";
import { EIS_RATES_2026 } from "./tables/eis-table.js";

export interface EisInput {
    wageSen: Sen;
    rates?: typeof EIS_RATES_2026;
}

export interface EisOutput {
    employeeSen: Sen;
    employerSen: Sen;
}

export const computeEis = (input: EisInput): EisOutput => {
    const rates = input.rates ?? EIS_RATES_2026;
    if (input.wageSen <= 0) return { employeeSen: 0 as Sen, employerSen: 0 as Sen };

    const capped = Math.min(input.wageSen, rates.wageCapSen) as Sen;
    return {
        employeeSen: Math.round(capped * rates.employee) as Sen,
        employerSen: Math.round(capped * rates.employer) as Sen,
    };
};
