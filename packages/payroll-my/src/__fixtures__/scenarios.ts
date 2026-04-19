// Payroll scenarios used by the snapshot tests in run.test.ts.
//
// These mirror the classes of worked example LHDN publishes (single, married,
// married-with-children, bonus month, etc.). The expected output is captured
// as snapshots in __snapshots__/*.snap on first run; the test fails if
// subsequent runs drift.
//
// ⚠️  Before PRODUCTION use, each scenario must be cross-checked against the
// equivalent LHDN / KWSP / PERKESO published worked example and the
// `verifiedAgainst` field updated. See docs/malaysia-statutory.md §
// "Verification checklist" for the source documents to use.

import { toSen } from "@bentop/domain";
import type { EmployeePayrollInput } from "../run.js";

export interface Scenario {
    id: string;
    description: string;
    verifiedAgainst: string | null;   // e.g. "LHDN MTD Guide 2024 Example 3"
    input: EmployeePayrollInput;
}

const commonYtd = {
    ytdNormalTaxableSen: toSen(0),
    ytdAdditionalTaxableSen: toSen(0),
    ytdEpfEmployeeSen: toSen(0),
    ytdSocsoEmployeeSen: toSen(0),
    ytdZakatSen: toSen(0),
    ytdMtdPaidSen: toSen(0),
} as const;

export const scenarios: Scenario[] = [
    {
        id: "single-k-rm3200-jan",
        description: "Single promoter (K), RM 3,000 basic + RM 200 allowance, January, no YTD",
        verifiedAgainst: null,
        input: {
            employeeId: "emp-1",
            payrollRunId: "run-1",
            periodMonth: "2026-01-01",
            monthIndex: 1,
            ageYears: 28,
            pcbCategory: "K",
            grossBasic: toSen(3000),
            grossAllowances: toSen(200),
            grossOt: toSen(0),
            grossCommission: toSen(0),
            grossKpiBonus: toSen(0),
            grossOtherAdditional: toSen(0),
            ...commonYtd,
        },
    },
    {
        id: "married-ka2-rm5000-jan",
        description: "Married (KA2) area manager, RM 5,000 basic, January, no YTD",
        verifiedAgainst: null,
        input: {
            employeeId: "emp-2",
            payrollRunId: "run-1",
            periodMonth: "2026-01-01",
            monthIndex: 1,
            ageYears: 35,
            pcbCategory: "KA2",
            grossBasic: toSen(5000),
            grossAllowances: toSen(0),
            grossOt: toSen(0),
            grossCommission: toSen(0),
            grossKpiBonus: toSen(0),
            grossOtherAdditional: toSen(0),
            ...commonYtd,
        },
    },
    {
        id: "promoter-with-commission-apr",
        description:
            "Single promoter with RM 1,470 commission + bonus, April (month 4), Q1 YTD loaded",
        verifiedAgainst: null,
        input: {
            employeeId: "emp-3",
            payrollRunId: "run-1",
            periodMonth: "2026-04-01",
            monthIndex: 4,
            ageYears: 29,
            pcbCategory: "K",
            grossBasic: toSen(1800),
            grossAllowances: toSen(0),
            grossOt: toSen(0),
            grossCommission: toSen(1220),
            grossKpiBonus: toSen(250),
            grossOtherAdditional: toSen(0),
            // YTD: 3 months × RM 1,800 basic (no commission Jan-Mar).
            ytdNormalTaxableSen: toSen(5400),
            ytdAdditionalTaxableSen: toSen(0),
            ytdEpfEmployeeSen: toSen(594),       // 11% × 5,400 (below threshold)
            ytdSocsoEmployeeSen: toSen(27),      // 3 × ~9
            ytdZakatSen: toSen(0),
            ytdMtdPaidSen: toSen(0),
        },
    },
    {
        id: "senior-ka0-rm4000-jan",
        description: "Age 62, married no kids (KA0), RM 4,000 — EPF senior rate + EIS exempt",
        verifiedAgainst: null,
        input: {
            employeeId: "emp-4",
            payrollRunId: "run-1",
            periodMonth: "2026-01-01",
            monthIndex: 1,
            ageYears: 62,
            pcbCategory: "KA0",
            grossBasic: toSen(4000),
            grossAllowances: toSen(0),
            grossOt: toSen(0),
            grossCommission: toSen(0),
            grossKpiBonus: toSen(0),
            grossOtherAdditional: toSen(0),
            ...commonYtd,
        },
    },
    {
        id: "high-earner-ka3-rm15000-dec",
        description: "State manager, married 3 kids (KA3), RM 15,000 gross, December, Jan-Nov YTD loaded",
        verifiedAgainst: null,
        input: {
            employeeId: "emp-5",
            payrollRunId: "run-1",
            periodMonth: "2026-12-01",
            monthIndex: 12,
            ageYears: 45,
            pcbCategory: "KA3",
            grossBasic: toSen(12000),
            grossAllowances: toSen(1000),
            grossOt: toSen(0),
            grossCommission: toSen(2000),
            grossKpiBonus: toSen(0),
            grossOtherAdditional: toSen(0),
            // 11 months at RM 13,000 = 143,000 taxable
            ytdNormalTaxableSen: toSen(143000),
            ytdAdditionalTaxableSen: toSen(22000),   // 11 × 2,000 commission
            ytdEpfEmployeeSen: toSen(17600),         // approx 11% × 160k capped-ish
            ytdSocsoEmployeeSen: toSen(270),         // 11 × ~24.5 (capped)
            ytdZakatSen: toSen(0),
            ytdMtdPaidSen: toSen(15000),             // approximation — snapshot will pin exact
        },
    },
];
