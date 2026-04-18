import { describe, expect, it } from "vitest";
import {
    type CommissionRule,
    type Employee,
    type KpiMetricValue,
    type KpiRule,
    type SalesRecord,
    toSen,
} from "@bentop/domain";
import { runCommissionPipeline } from "./pipeline.js";

// Worked example from the implementation plan.
// Promoter Aishah reports to Area Manager Faizal (Klang Valley), who reports to
// State Manager Hooi (Selangor + KL). April 2026.
describe("commission pipeline — worked example", () => {
    const aishah: Employee = {
        id: "emp-aishah",
        profileId: "p-aishah",
        employeeNo: "E001",
        fullName: "Aishah",
        role: "promoter",
        wageType: "monthly",
        baseSalary: toSen(1800),
        dependents: 0,
    };
    const faizal: Employee = {
        id: "emp-faizal",
        profileId: "p-faizal",
        employeeNo: "E050",
        fullName: "Faizal",
        role: "area_manager",
        wageType: "monthly",
        baseSalary: toSen(4200),
        dependents: 2,
    };
    const hooi: Employee = {
        id: "emp-hooi",
        profileId: "p-hooi",
        employeeNo: "E090",
        fullName: "Hooi",
        role: "state_manager",
        wageType: "monthly",
        baseSalary: toSen(7500),
        dependents: 1,
    };

    // One sales row per promoter is enough for the engine — the aggregator sums.
    const sales: SalesRecord[] = [
        {
            id: "s1", externalId: "ERP-1", counterId: "c-kl-pavilion",
            employeeId: "emp-aishah", saleDate: "2026-04-30",
            grossAmount: toSen(32400), returnsAmount: toSen(0),
            netAmount: toSen(32400), currency: "MYR", erpVersion: 1,
        },
        // Other 7 promoters reporting to Faizal — total RM 185,600 so team = RM 218,000.
        ...Array.from({ length: 7 }, (_, i) => ({
            id: `s-other-${i}`, externalId: `ERP-OTHER-${i}`,
            counterId: "c-kl-pavilion", employeeId: `emp-other-${i}`,
            saleDate: "2026-04-30",
            grossAmount: toSen(185600 / 7),
            returnsAmount: toSen(0),
            netAmount: toSen(185600 / 7),
            currency: "MYR" as const, erpVersion: 1,
        })),
    ];

    // Seven more "other" promoters so directReportsOf() has bodies to map to.
    const others: Employee[] = Array.from({ length: 7 }, (_, i) => ({
        id: `emp-other-${i}`,
        profileId: `p-other-${i}`,
        employeeNo: `E00${i + 2}`,
        fullName: `Other ${i}`,
        role: "promoter",
        wageType: "monthly",
        baseSalary: toSen(1800),
        dependents: 0,
    }));

    const commissionRules: CommissionRule[] = [
        {
            id: "r1", schemeId: "sch-1", appliesToRole: "promoter",
            ruleType: "tiered_personal", priority: 10,
            config: {
                basis: "personal_net_sales",
                tiers: [
                    { min: toSen(0), max: toSen(20000), pct: 3 },
                    { min: toSen(20000), max: toSen(40000), pct: 5 },
                    { min: toSen(40000), max: null, pct: 7 },
                ],
            },
        },
        {
            id: "r2", schemeId: "sch-1", appliesToRole: "area_manager",
            ruleType: "override_team", priority: 10,
            config: { basis: "team_net_sales", teamScope: "direct_reports", pct: 0.5 },
        },
        {
            id: "r3", schemeId: "sch-1", appliesToRole: "state_manager",
            ruleType: "override_region", priority: 10,
            config: { basis: "region_net_sales", pct: 0.2 },
        },
    ];

    const kpiRules: KpiRule[] = [
        {
            id: "k1", schemeId: "sch-1", appliesToRole: "promoter",
            name: "Attendance",
            config: {
                metric: "attendance_rate",
                bands: [{ gte: 0.95, bonus: toSen(150) }],
            },
        },
        {
            id: "k2", schemeId: "sch-1", appliesToRole: "promoter",
            name: "Low returns",
            config: {
                metric: "return_rate",
                bands: [{ lte: 0.03, bonus: toSen(100) }],
            },
        },
    ];

    const kpiMetrics: KpiMetricValue[] = [
        { employeeId: "emp-aishah", periodMonth: "2026-04-01", metric: "attendance_rate", value: 0.967 },
        { employeeId: "emp-aishah", periodMonth: "2026-04-01", metric: "return_rate", value: 0.021 },
    ];

    // Stub hierarchy resolvers. Faizal's direct reports are Aishah + 7 others.
    // Hooi's region is everyone above (8 promoters + Faizal — but the plan's
    // region net sales figure of RM 740,000 includes other areas too, so we
    // add synthetic padding).
    const aishahAndOthers = ["emp-aishah", ...others.map((o) => o.id)];
    const paddingSales: SalesRecord[] = [
        {
            id: "s-pad", externalId: "ERP-PAD", counterId: "c-other",
            employeeId: "emp-padding", saleDate: "2026-04-30",
            grossAmount: toSen(522000), returnsAmount: toSen(0),
            netAmount: toSen(522000), currency: "MYR", erpVersion: 1,
        },
    ];
    const paddingEmployee: Employee = {
        id: "emp-padding",
        profileId: "p-padding",
        employeeNo: "E999",
        fullName: "Padding",
        role: "promoter",
        wageType: "monthly",
        baseSalary: toSen(1800),
        dependents: 0,
    };
    const regionIds = [...aishahAndOthers, "emp-padding"];

    const input = {
        periodMonth: "2026-04-01",
        employees: [aishah, faizal, hooi, ...others, paddingEmployee],
        sales: [...sales, ...paddingSales],
        commissionRules,
        kpiRules,
        kpiMetrics,
        directReportsOf: (id: string) => (id === "emp-faizal" ? aishahAndOthers : []),
        allSubordinatesOf: (id: string) => (id === "emp-faizal" ? aishahAndOthers : []),
        employeesInRegionOf: (id: string) => (id === "emp-hooi" ? regionIds : []),
        regionNameOf: (id: string) => (id === "emp-hooi" ? "Selangor + KL" : "—"),
    };

    const { totalsByEmployee, lineItems } = runCommissionPipeline(input);

    it("Aishah earns tiered personal + both KPI bonuses = RM 1,470", () => {
        // 3% of 20k (RM 600) + 5% of 12.4k (RM 620) + RM 150 + RM 100 = RM 1,470.
        expect(totalsByEmployee.get("emp-aishah")).toBe(toSen(1470));
    });

    it("Aishah's tier breakdown is itemised for the payslip", () => {
        const aishahItems = lineItems.filter((i) => i.employeeId === "emp-aishah");
        const tierItems = aishahItems.filter((i) => i.ruleId === "r1");
        expect(tierItems).toHaveLength(2);
        expect(tierItems[0]!.computedAmount).toBe(toSen(600));
        expect(tierItems[1]!.computedAmount).toBe(toSen(620));
    });

    it("Faizal earns 0.5% override on the direct-report team (~RM 218k)", () => {
        // Team is Aishah's 32.4k + 185.6k = 218k. 0.5% = RM 1,090.
        expect(totalsByEmployee.get("emp-faizal")).toBe(toSen(1090));
    });

    it("Hooi earns 0.2% override on the region (~RM 740k)", () => {
        // Region = 218k + padding 522k = 740k. 0.2% = RM 1,480.
        expect(totalsByEmployee.get("emp-hooi")).toBe(toSen(1480));
    });
});
