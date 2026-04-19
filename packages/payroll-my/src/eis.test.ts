import { describe, expect, it } from "vitest";
import { toSen } from "@bentop/domain";
import { computeEis } from "./eis.js";

describe("EIS (SIP)", () => {
    it("employee and employer contributions are equal (0.2% each)", () => {
        for (const wage of [500, 1500, 3000, 4999, 5000, 8000]) {
            const r = computeEis({ wageSen: toSen(wage), ageYears: 30 });
            expect(r.employeeSen).toBe(r.employerSen);
        }
    });

    it("caps at RM 5,000 wage", () => {
        const atCap = computeEis({ wageSen: toSen(5000), ageYears: 30 });
        const above = computeEis({ wageSen: toSen(10000), ageYears: 30 });
        expect(above.employeeSen).toBe(atCap.employeeSen);
    });

    it("age 60+ is exempt", () => {
        const r = computeEis({ wageSen: toSen(4000), ageYears: 60 });
        expect(r.employeeSen).toBe(0);
        expect(r.employerSen).toBe(0);
        expect(r.exempt).toBe(true);
    });

    it("zero wage -> zero contribution", () => {
        const r = computeEis({ wageSen: toSen(0), ageYears: 30 });
        expect(r.employeeSen).toBe(0);
        expect(r.employerSen).toBe(0);
    });
});
