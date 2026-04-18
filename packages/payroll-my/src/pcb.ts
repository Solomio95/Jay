import { type Sen } from "@bentop/domain";
import { estimateAnnualTaxSen, type PcbInputs } from "./tables/pcb-formula.js";

// SIMPLIFIED PCB implementation for scaffolding. The production version must
// implement LHDN's full MTD formula — see docs/malaysia-statutory.md for the
// list of categories, reliefs, and rebates still to add.
export const computePcb = (input: PcbInputs): Sen => {
    // Category-based personal relief (approximate, pending full LHDN formula).
    const personalReliefSen =
        input.category === "K"   ? 900000 :    // 9,000
        input.category === "KA1" ? 1300000 :   // 13,000 (spouse + 1 child)
        input.category === "KA2" ? 1500000 :   // 15,000
        input.category === "KA3" ? 1700000 :
        input.category === "KA4" ? 1900000 :
        2100000;

    // Project this month as if it's a typical month for the remaining period.
    const annualisedTaxableSen =
        input.ytdTaxableIncomeSen
        + input.currentMonthTaxableSen * input.monthsRemaining;
    const annualReliefSen = personalReliefSen + input.epfYtdSen * (12 / Math.max(1, 12 - input.monthsRemaining + 1));
    const annualNetSen = Math.max(0, annualisedTaxableSen - annualReliefSen);

    const annualTaxSen = estimateAnnualTaxSen(annualNetSen);
    const remainingTaxSen = Math.max(0, annualTaxSen - input.ytdPcbPaidSen);

    return Math.round(remainingTaxSen / Math.max(1, input.monthsRemaining)) as Sen;
};
