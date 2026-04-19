// LHDN MTD (Monthly Tax Deduction) formula — Computerised Calculation Method.
//
// This follows the structure in LHDN's "Spesifikasi Kaedah Pengiraan
// Berkomputer bagi PCB". There are TWO sub-formulae:
//
//   1. MTD for NORMAL REMUNERATION — applied each regular month.
//   2. MTD for ADDITIONAL REMUNERATION — applied when an unusual one-off
//      payment (bonus, arrears, commission larger than typical) is paid. It
//      computes "what would PCB be if this extra wasn't paid" vs "with it"
//      and charges the difference.
//
// Formula variables (LHDN notation):
//   P  = Total annual chargeable income (projected)
//   M  = Upper bound of the tax band P falls in
//   R  = Tax rate for band P
//   B  = Tax at band M (accumulated)
//   Z  = Accumulated zakat paid YTD via MTD
//   X  = MTD already paid YTD (including current month's CP38 directives)
//
// MTD for normal remuneration, month n of the year:
//   P = (Y × 12 + YTD_Y) − (reliefs) + current_month_taxable_equivalent
//   annual_tax = computeAnnualTaxSen(P) − rebate − Z
//   mtd_this_month = (annual_tax − X) / months_remaining
//
// The implementation below is faithful in STRUCTURE but the exact rounding
// conventions between the computerised and schedular methods diverge in edge
// cases; golden-file tests against LHDN's published examples pin down those
// conventions.

import { type Sen, addSen } from "@bentop/domain";
import { isMarried, parsePcbCategory, type PcbCategory } from "./categories.js";
import { computeAnnualReliefSen, type PcbReliefs, RELIEFS_YA2024 } from "./reliefs.js";
import {
    TAX_BANDS_YA2024,
    type TaxBand,
    computeAnnualTaxSen,
    computeRebateSen,
} from "./tax-bands.js";

export interface PcbInputs {
    category: PcbCategory | string;          // "K", "KA1", ...
    childrenInTertiary?: number;
    monthIndex: number;                      // 1 = January ... 12 = December

    // Current month figures (in sen).
    currentMonthNormalSen: Sen;              // basic + regular allowances for THIS month
    currentMonthAdditionalSen?: Sen;         // one-off additional pay (bonus, commission > typical)
    currentMonthEpfEmployeeSen: Sen;
    currentMonthSocsoEmployeeSen: Sen;
    currentMonthZakatSen?: Sen;

    // YTD figures as at start of this month (i.e. from Jan through previous month).
    ytdNormalTaxableSen: Sen;                // sum of normal taxable pay Jan..month-1
    ytdAdditionalTaxableSen: Sen;            // sum of additional taxable pay Jan..month-1
    ytdEpfEmployeeSen: Sen;
    ytdSocsoEmployeeSen: Sen;
    ytdZakatSen: Sen;
    ytdMtdPaidSen: Sen;                      // MTD already remitted Jan..month-1

    additionalReliefSen?: number;            // from TP1, if submitted
    reliefs?: PcbReliefs;
    taxBands?: TaxBand[];
}

export interface PcbOutputs {
    normalMtdSen: Sen;
    additionalMtdSen: Sen;
    totalMtdSen: Sen;
    intermediate: {
        chargeableIncomeSen: number;
        annualTaxSen: number;
        rebateSen: number;
        zakatAppliedSen: number;
        monthsRemaining: number;
    };
}

const monthsRemainingFrom = (monthIndex: number): number => 13 - monthIndex;

// Round MTD to the nearest 5 sen — LHDN convention.
const roundMtdSen = (valueSen: number): Sen => {
    if (valueSen <= 0) return 0 as Sen;
    return (Math.round(valueSen / 5) * 5) as Sen;
};

export const computePcb = (input: PcbInputs): PcbOutputs => {
    const category = parsePcbCategory(
        typeof input.category === "string" ? input.category : input.category,
    );
    const reliefs = input.reliefs ?? RELIEFS_YA2024;
    const bands = input.taxBands ?? TAX_BANDS_YA2024;
    const additional = input.currentMonthAdditionalSen ?? (0 as Sen);
    const zakatThis = input.currentMonthZakatSen ?? (0 as Sen);

    const monthsLeftIncl = monthsRemainingFrom(input.monthIndex);

    // --- Step 1: projected annual chargeable income, in two scenarios.
    // Project remaining months by assuming normal pay stays level.
    const projectedRemainingNormal = (input.currentMonthNormalSen * monthsLeftIncl) as Sen;
    const annualNormalSen = addSen(input.ytdNormalTaxableSen, projectedRemainingNormal);
    // "Without additional" = annual normal + YTD additional only.
    // "With additional" = that + this month's additional.
    const annualExclAdditionalSen = addSen(annualNormalSen, input.ytdAdditionalTaxableSen);
    const annualTotalSen = addSen(annualExclAdditionalSen, additional);

    // Project EPF + SOCSO the same way.
    const projectedEpf = (input.currentMonthEpfEmployeeSen * monthsLeftIncl) as Sen;
    const totalEpfForYear = (input.ytdEpfEmployeeSen + projectedEpf) as Sen;
    const projectedSocso = (input.currentMonthSocsoEmployeeSen * monthsLeftIncl) as Sen;
    const totalSocsoForYear = (input.ytdSocsoEmployeeSen + projectedSocso) as Sen;

    const reliefSen = computeAnnualReliefSen({
        category,
        ...(input.childrenInTertiary !== undefined
            ? { childrenInTertiary: input.childrenInTertiary }
            : {}),
        epfYtdEmployeeSen: totalEpfForYear,
        socsoYtdEmployeeSen: totalSocsoForYear,
        additionalReliefSen: input.additionalReliefSen ?? 0,
        reliefs,
    });

    const chargeableExclAdditional = Math.max(0, annualExclAdditionalSen - reliefSen);
    const chargeableInclAdditional = Math.max(0, annualTotalSen - reliefSen);

    // --- Step 2: annual tax at each scenario.
    const taxExclAdditional = computeAnnualTaxSen(
        chargeableExclAdditional as Sen,
        bands,
    );
    const taxInclAdditional = computeAnnualTaxSen(
        chargeableInclAdditional as Sen,
        bands,
    );

    // --- Step 3: rebate (RM 400 single / RM 800 married) if chargeable <= RM 35,000.
    const rebateSen = computeRebateSen({
        chargeableIncomeSen: chargeableExclAdditional as Sen,
        married: isMarried(category),
    });
    const annualZakatProjected = input.ytdZakatSen + zakatThis * monthsLeftIncl;
    const adjustedTaxExcl = Math.max(
        0,
        taxExclAdditional - rebateSen - annualZakatProjected,
    );
    const adjustedTaxIncl = Math.max(
        0,
        taxInclAdditional - rebateSen - annualZakatProjected,
    );

    // --- Step 4: MTD for NORMAL remuneration.
    //   (adjustedTaxExcl - ytdMtdPaid) spread over remaining months including current.
    const normalMtdRaw = Math.max(
        0,
        (adjustedTaxExcl - input.ytdMtdPaidSen) / monthsLeftIncl,
    );
    const normalMtdSen = roundMtdSen(normalMtdRaw);

    // --- Step 5: MTD for ADDITIONAL remuneration.
    //   Difference in annual tax with vs without the additional, less what MTD
    //   has already absorbed for it YTD.
    const additionalMtdRaw = Math.max(0, adjustedTaxIncl - adjustedTaxExcl);
    const additionalMtdSen = roundMtdSen(
        additional > 0 ? additionalMtdRaw : 0,
    );

    const totalMtdSen = addSen(normalMtdSen, additionalMtdSen);

    return {
        normalMtdSen,
        additionalMtdSen,
        totalMtdSen,
        intermediate: {
            chargeableIncomeSen: chargeableInclAdditional,
            annualTaxSen: taxInclAdditional,
            rebateSen,
            zakatAppliedSen: annualZakatProjected,
            monthsRemaining: monthsLeftIncl,
        },
    };
};
