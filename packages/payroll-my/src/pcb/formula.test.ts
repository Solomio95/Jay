import { describe, expect, it } from "vitest";
import { toSen } from "@bentop/domain";
import { computePcb } from "./formula.js";
import { computeAnnualTaxSen, computeRebateSen } from "./tax-bands.js";
import { parsePcbCategory, childCountFromCategory } from "./categories.js";
import { computeAnnualReliefSen } from "./reliefs.js";

describe("PCB categories", () => {
    it("parses K and KA0..KA20", () => {
        expect(parsePcbCategory("K")).toBe("K");
        expect(parsePcbCategory("ka0")).toBe("KA0");
        expect(parsePcbCategory("KA20")).toBe("KA20");
        expect(() => parsePcbCategory("KA21")).toThrow();
        expect(() => parsePcbCategory("Z")).toThrow();
    });

    it("extracts child count", () => {
        expect(childCountFromCategory("K")).toBe(0);
        expect(childCountFromCategory("KA0")).toBe(0);
        expect(childCountFromCategory("KA3")).toBe(3);
        expect(childCountFromCategory("KA20")).toBe(20);
    });
});

describe("annual income tax", () => {
    it("returns 0 for income at or below RM 5,000", () => {
        expect(computeAnnualTaxSen(toSen(5000))).toBe(0);
        expect(computeAnnualTaxSen(toSen(3000))).toBe(0);
    });

    it("matches the published YA2024 bracket cumulatives at boundaries", () => {
        // Tax at exactly RM 20,000 = RM 150 (from 1% of 15k)
        expect(computeAnnualTaxSen(toSen(20000))).toBe(toSen(150));
        // Tax at exactly RM 35,000 = RM 600 (150 + 3% of 15k)
        expect(computeAnnualTaxSen(toSen(35000))).toBe(toSen(600));
        // Tax at exactly RM 50,000 = RM 1,500 (600 + 6% of 15k)
        expect(computeAnnualTaxSen(toSen(50000))).toBe(toSen(1500));
        // Tax at exactly RM 70,000 = RM 3,700 (1,500 + 11% of 20k)
        expect(computeAnnualTaxSen(toSen(70000))).toBe(toSen(3700));
        // Tax at exactly RM 100,000 = RM 9,400 (3,700 + 19% of 30k)
        expect(computeAnnualTaxSen(toSen(100000))).toBe(toSen(9400));
    });

    it("is strictly non-decreasing as income grows", () => {
        let prev = 0;
        for (let rm = 0; rm <= 500_000; rm += 1_000) {
            const t = computeAnnualTaxSen(toSen(rm));
            expect(t).toBeGreaterThanOrEqual(prev);
            prev = t;
        }
    });
});

describe("rebate (§ 6A)", () => {
    it("RM 400 single when chargeable <= RM 35,000", () => {
        expect(computeRebateSen({ chargeableIncomeSen: toSen(30000), married: false })).toBe(
            toSen(400),
        );
    });

    it("RM 800 married when chargeable <= RM 35,000", () => {
        expect(computeRebateSen({ chargeableIncomeSen: toSen(30000), married: true })).toBe(
            toSen(800),
        );
    });

    it("zero when chargeable > RM 35,000", () => {
        expect(computeRebateSen({ chargeableIncomeSen: toSen(36000), married: true })).toBe(0);
    });
});

describe("annual reliefs", () => {
    it("K category gets only personal + EPF + SOCSO", () => {
        const r = computeAnnualReliefSen({
            category: "K",
            epfYtdEmployeeSen: toSen(4000),
            socsoYtdEmployeeSen: toSen(300),
        });
        // 9,000 + 4,000 + 300 = 13,300
        expect(r).toBe(toSen(13300));
    });

    it("KA2 adds spouse + 2 × child", () => {
        const r = computeAnnualReliefSen({
            category: "KA2",
            epfYtdEmployeeSen: toSen(0),
            socsoYtdEmployeeSen: toSen(0),
        });
        // 9,000 + 4,000 + 2×2,000 = 17,000
        expect(r).toBe(toSen(17000));
    });

    it("EPF relief is capped at RM 7,000", () => {
        const r = computeAnnualReliefSen({
            category: "K",
            epfYtdEmployeeSen: toSen(10000),
            socsoYtdEmployeeSen: toSen(0),
        });
        // Personal 9,000 + EPF cap 7,000 = 16,000
        expect(r).toBe(toSen(16000));
    });

    it("SOCSO relief is capped at RM 350", () => {
        const r = computeAnnualReliefSen({
            category: "K",
            epfYtdEmployeeSen: toSen(0),
            socsoYtdEmployeeSen: toSen(500),
        });
        // Personal 9,000 + SOCSO cap 350 = 9,350
        expect(r).toBe(toSen(9350));
    });

    it("child in tertiary gets RM 8,000 instead of RM 2,000", () => {
        const r = computeAnnualReliefSen({
            category: "KA2",
            childrenInTertiary: 1,
            epfYtdEmployeeSen: toSen(0),
            socsoYtdEmployeeSen: toSen(0),
        });
        // 9,000 + 4,000 + 1×2,000 (under 18) + 1×8,000 (tertiary) = 23,000
        expect(r).toBe(toSen(23000));
    });
});

describe("computePcb", () => {
    it("returns zero MTD when annual income falls under total reliefs", () => {
        const r = computePcb({
            category: "K",
            monthIndex: 1,
            currentMonthNormalSen: toSen(1500),
            currentMonthEpfEmployeeSen: toSen(165),
            currentMonthSocsoEmployeeSen: toSen(8),
            ytdNormalTaxableSen: toSen(0),
            ytdAdditionalTaxableSen: toSen(0),
            ytdEpfEmployeeSen: toSen(0),
            ytdSocsoEmployeeSen: toSen(0),
            ytdZakatSen: toSen(0),
            ytdMtdPaidSen: toSen(0),
        });
        expect(r.totalMtdSen).toBe(0);
    });

    it("additional remuneration (bonus) increases MTD", () => {
        const base = {
            category: "K" as const,
            monthIndex: 6,
            currentMonthNormalSen: toSen(6000),
            currentMonthEpfEmployeeSen: toSen(660),
            currentMonthSocsoEmployeeSen: toSen(25),
            ytdNormalTaxableSen: toSen(30000),
            ytdAdditionalTaxableSen: toSen(0),
            ytdEpfEmployeeSen: toSen(3300),
            ytdSocsoEmployeeSen: toSen(125),
            ytdZakatSen: toSen(0),
            ytdMtdPaidSen: toSen(500),
        };
        const withoutBonus = computePcb({ ...base, currentMonthAdditionalSen: toSen(0) });
        const withBonus = computePcb({ ...base, currentMonthAdditionalSen: toSen(5000) });
        expect(withBonus.totalMtdSen).toBeGreaterThan(withoutBonus.totalMtdSen);
    });

    it("rounds MTD to the nearest 5 sen", () => {
        const r = computePcb({
            category: "K",
            monthIndex: 4,
            currentMonthNormalSen: toSen(8000),
            currentMonthEpfEmployeeSen: toSen(880),
            currentMonthSocsoEmployeeSen: toSen(25),
            ytdNormalTaxableSen: toSen(24000),
            ytdAdditionalTaxableSen: toSen(0),
            ytdEpfEmployeeSen: toSen(2640),
            ytdSocsoEmployeeSen: toSen(75),
            ytdZakatSen: toSen(0),
            ytdMtdPaidSen: toSen(0),
        });
        expect(r.totalMtdSen % 5).toBe(0);
    });
});
