import { type Sen } from "@bentop/domain";
import { EPF_RATES_2026, type EpfRateInputs } from "./tables/epf-rates.js";

export interface EpfInput {
    wageSen: Sen;             // gross subject to EPF (salary + allowances; not commission by default)
    ageYears: number;
    rates?: EpfRateInputs;
}

export interface EpfOutput {
    employeeSen: Sen;
    employerSen: Sen;
}

// KWSP rounds wages up to the nearest ringgit before computation.
const roundUpToRinggit = (sen: Sen): Sen => {
    const remainder = sen % 100;
    if (remainder === 0) return sen;
    return ((sen - remainder) + 100) as Sen;
};

export const computeEpf = (input: EpfInput): EpfOutput => {
    const rates = input.rates ?? EPF_RATES_2026;
    const wage = roundUpToRinggit(input.wageSen);
    if (wage <= 0) return { employeeSen: 0 as Sen, employerSen: 0 as Sen };

    const isSenior = input.ageYears >= 60;
    const employeeRate = isSenior ? rates.employeeAbove60 : rates.employeeBelow60;

    const wageInRinggit = wage / 100;
    const belowThreshold = wageInRinggit <= rates.wageThreshold;
    const employerRate = isSenior
        ? (belowThreshold ? rates.employerLowBandAbove60 : rates.employerHighBandAbove60)
        : (belowThreshold ? rates.employerLowBandBelow60 : rates.employerHighBandBelow60);

    const employeeSen = Math.round(wage * employeeRate) as Sen;
    const employerSen = Math.round(wage * employerRate) as Sen;
    return { employeeSen, employerSen };
};
