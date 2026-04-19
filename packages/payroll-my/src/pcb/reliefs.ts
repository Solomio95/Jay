// Annual personal reliefs used in the PCB (MTD) computation.
//
// Amounts are in sen. These are the headline reliefs LHDN allows the MTD
// formula to assume automatically, WITHOUT the employee submitting a TP1.
// (TP1 lets the employee declare additional reliefs like medical, lifestyle,
// education, donations — those flow in as `additionalReliefSen` on PcbInputs.)
//
// Values here need verification against the latest LHDN publication for the
// assessment year in question. Each constant is tagged with the year it was
// last verified so HR can spot-check. HR can override at runtime by passing
// a `reliefsOverride` object.

import { type Sen, toSen } from "@bentop/domain";
import { childCountFromCategory, isMarried, type PcbCategory } from "./categories.js";

export interface PcbReliefs {
    // Baseline personal relief — everyone gets this.
    personalSen: Sen;

    // Spouse relief (only if spouse is not working / has no income > threshold).
    spouseSen: Sen;

    // Per qualifying child under 18 (or over 18 and not in tertiary ed).
    childUnder18Sen: Sen;

    // Per qualifying child over 18 in full-time tertiary education.
    // (Not modelled yet in the employee record; treated as under-18 by default.)
    childInTertiarySen: Sen;

    // EPF + life insurance combined cap.
    epfLifeInsuranceCapSen: Sen;

    // SOCSO relief cap (applied to employee's SOCSO contribution).
    socsoCapSen: Sen;
}

// Year-assessment 2024 amounts — verify against LHDN guide before production.
export const RELIEFS_YA2024: PcbReliefs = {
    personalSen: toSen(9000),
    spouseSen: toSen(4000),
    childUnder18Sen: toSen(2000),
    childInTertiarySen: toSen(8000),
    epfLifeInsuranceCapSen: toSen(7000),
    socsoCapSen: toSen(350),
};

export interface ReliefInputs {
    category: PcbCategory;
    childrenInTertiary?: number;          // subset of category's child count in tertiary ed
    epfYtdEmployeeSen: number;
    socsoYtdEmployeeSen: number;
    additionalReliefSen?: number;         // from TP1
    reliefs?: PcbReliefs;
}

export const computeAnnualReliefSen = (input: ReliefInputs): Sen => {
    const r = input.reliefs ?? RELIEFS_YA2024;
    let total: number = r.personalSen;

    if (isMarried(input.category)) total += r.spouseSen;

    const totalChildren = childCountFromCategory(input.category);
    const inTertiary = Math.min(totalChildren, input.childrenInTertiary ?? 0);
    const under18 = Math.max(0, totalChildren - inTertiary);
    total += under18 * r.childUnder18Sen;
    total += inTertiary * r.childInTertiarySen;

    // EPF + life insurance is capped; we don't know life insurance so we use EPF only.
    total += Math.min(input.epfYtdEmployeeSen, r.epfLifeInsuranceCapSen);

    total += Math.min(input.socsoYtdEmployeeSen, r.socsoCapSen);

    if (input.additionalReliefSen) total += input.additionalReliefSen;

    return total as Sen;
};
