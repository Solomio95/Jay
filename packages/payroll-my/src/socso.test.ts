import { describe, expect, it } from "vitest";
import { toSen } from "@bentop/domain";
import { categoryFor, computeSocso } from "./socso.js";

describe("SOCSO (PERKESO)", () => {
    it("category 1 for under 60 with no late registration", () => {
        expect(categoryFor(30)).toBe("category_1");
    });

    it("category 2 once employee turns 60", () => {
        expect(categoryFor(60)).toBe("category_2");
        expect(categoryFor(65)).toBe("category_2");
    });

    it("category 2 for employees first registered at 55+", () => {
        expect(categoryFor(58, 56)).toBe("category_2");
    });

    it("capped at RM 5,000 — wages above it contribute the same as at the cap", () => {
        const atCap = computeSocso({ wageSen: toSen(5000), ageYears: 30 });
        const above = computeSocso({ wageSen: toSen(8000), ageYears: 30 });
        expect(above.employeeSen).toBe(atCap.employeeSen);
        expect(above.employerSen).toBe(atCap.employerSen);
    });

    it("category 2 has no employee contribution", () => {
        const r = computeSocso({ wageSen: toSen(4000), ageYears: 62 });
        expect(r.employeeSen).toBe(0);
        expect(r.employerSen).toBeGreaterThan(0);
    });

    it("category 1 employer contribution exceeds employee (1.75% vs 0.5%)", () => {
        const r = computeSocso({ wageSen: toSen(3000), ageYears: 30 });
        expect(r.employerSen).toBeGreaterThan(r.employeeSen);
    });

    it("zero wage -> zero contribution", () => {
        const r = computeSocso({ wageSen: toSen(0), ageYears: 30 });
        expect(r.employeeSen).toBe(0);
        expect(r.employerSen).toBe(0);
    });
});
