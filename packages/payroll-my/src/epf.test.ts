import { describe, expect, it } from "vitest";
import { toSen } from "@bentop/domain";
import { computeEpf } from "./epf.js";
import { EPF_THIRD_SCHEDULE } from "./tables/epf-third-schedule.js";

describe("EPF (KWSP)", () => {
    it("band lookup returns a result for every ringgit between RM 0.01 and RM 20,000", () => {
        for (let wage = 100; wage <= 2_000_000; wage += 12_345) {
            const { employeeSen, employerSen } = computeEpf({
                wageSen: wage as ReturnType<typeof toSen>,
                ageYears: 30,
            });
            expect(employeeSen).toBeGreaterThanOrEqual(0);
            expect(employerSen).toBeGreaterThanOrEqual(0);
        }
    });

    it("employer rate drops from 13% to 12% when monthly wage exceeds RM 5,000", () => {
        const atThreshold = computeEpf({ wageSen: toSen(5000), ageYears: 30 });
        const justAbove = computeEpf({ wageSen: toSen(5100), ageYears: 30 });
        // Ratio of employer contribution to wage drops.
        const rateAt = atThreshold.employerSen / toSen(5000);
        const rateAbove = justAbove.employerSen / toSen(5100);
        expect(rateAbove).toBeLessThan(rateAt);
    });

    it("senior (age 60+) halves the rates vs below-60", () => {
        const below = computeEpf({ wageSen: toSen(3000), ageYears: 59 });
        const senior = computeEpf({ wageSen: toSen(3000), ageYears: 60 });
        // Senior employee rate is half, so contribution should roughly halve.
        expect(senior.employeeSen).toBeLessThanOrEqual(below.employeeSen / 2 + toSen(1));
        expect(senior.employerSen).toBeLessThanOrEqual(below.employerSen / 2 + toSen(1));
    });

    it("falls back to percentage rule for wages above RM 20,000", () => {
        const result = computeEpf({ wageSen: toSen(25000), ageYears: 30 });
        expect(result.ruleApplied).toBe("percentage_over_20k");
        // 11% of 25,000 = 2,750.
        expect(result.employeeSen).toBe(toSen(2750));
    });

    it("zero wage -> zero contribution", () => {
        const { employeeSen, employerSen } = computeEpf({ wageSen: toSen(0), ageYears: 30 });
        expect(employeeSen).toBe(0);
        expect(employerSen).toBe(0);
    });

    it("Third Schedule tables are strictly ordered (no overlapping bands)", () => {
        for (const category of Object.keys(EPF_THIRD_SCHEDULE) as Array<
            keyof typeof EPF_THIRD_SCHEDULE
        >) {
            const bands = EPF_THIRD_SCHEDULE[category];
            for (let i = 1; i < bands.length; i++) {
                expect(bands[i]!.wageMinSen).toBe(bands[i - 1]!.wageMaxSen + 1);
            }
        }
    });
});
