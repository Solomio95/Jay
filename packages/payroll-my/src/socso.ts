import { type Sen } from "@bentop/domain";
import { SOCSO_TABLE_2026, type SocsoBand } from "./tables/socso-table.js";

export interface SocsoInput {
    wageSen: Sen;
    table?: SocsoBand[];
}

export interface SocsoOutput {
    employeeSen: Sen;
    employerSen: Sen;
}

export const computeSocso = (input: SocsoInput): SocsoOutput => {
    const table = input.table ?? SOCSO_TABLE_2026;
    if (input.wageSen <= 0) return { employeeSen: 0 as Sen, employerSen: 0 as Sen };

    const band = table.find(
        (b) => input.wageSen >= b.wageMinSen && input.wageSen <= b.wageMaxSen,
    );
    // Wages above the top band fall back to the top band's rate (cap).
    const chosen = band ?? table[table.length - 1]!;
    return {
        employeeSen: chosen.employeeSen as Sen,
        employerSen: chosen.employerSen as Sen,
    };
};
