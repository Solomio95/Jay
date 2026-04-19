import { type Sen } from "@bentop/domain";
import {
    type SocsoCategory,
    lookupSocsoBand,
} from "./tables/socso-categories.js";

export interface SocsoInput {
    wageSen: Sen;
    ageYears: number;
    firstRegisteredAgeYears?: number;  // age when first registered with SOCSO
}

export interface SocsoOutput {
    employeeSen: Sen;
    employerSen: Sen;
    category: SocsoCategory;
}

// PERKESO rule: employee moves to Category 2 when they turn 60, OR when they
// are first registered with SOCSO at age 55 or older.
export const categoryFor = (
    ageYears: number,
    firstRegisteredAgeYears?: number,
): SocsoCategory => {
    if (ageYears >= 60) return "category_2";
    if (firstRegisteredAgeYears !== undefined && firstRegisteredAgeYears >= 55) {
        return "category_2";
    }
    return "category_1";
};

export const computeSocso = (input: SocsoInput): SocsoOutput => {
    const category = categoryFor(input.ageYears, input.firstRegisteredAgeYears);
    const band = lookupSocsoBand(input.wageSen, category);
    return {
        employeeSen: band.employeeSen as Sen,
        employerSen: band.employerSen as Sen,
        category,
    };
};
