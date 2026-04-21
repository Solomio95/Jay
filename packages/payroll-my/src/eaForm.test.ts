import { describe, expect, it } from "vitest";
import { type Payslip, toSen } from "@bentop/domain";
import { aggregateEaForm, type EaFormInput } from "./eaForm.js";

const base: Payslip = {
    employeeId: "emp-1",
    payrollRunId: "run-1",
    periodMonth: "2026-01-01",
    grossBasic: 300_000,
    grossAllowances: 20_000,
    grossCommission: 50_000,
    grossOt: 10_000,
    grossKpiBonus: 0,
    grossTotal: 380_000,
    epfEmployee: 30_000,
    epfEmployer: 50_000,
    socsoEmployee: 800,
    socsoEmployer: 2_800,
    eisEmployee: 200,
    eisEmployer: 200,
    pcb: 1_500,
    otherDeductions: [],
    netPay: 347_500,
} as unknown as Payslip;

const slip = (patch: Partial<Payslip>): Payslip => ({ ...base, ...patch });

const employee: EaFormInput["employee"] = {
    employeeNo: "E001",
    fullName: "Aishah binti Ahmad",
    icNo: "890101105566",
    taxNo: "SG12345678",
    epfNo: "12345678",
    socsoNo: "890101105566",
    position: "Promoter",
    hiredOn: "2022-03-01",
    terminatedOn: null,
};

const employer: EaFormInput["employer"] = {
    name: "Bentop Sdn Bhd",
    employerE: "E 1234567890",
    address: ["No. 1, Jalan Ampang", "50450 Kuala Lumpur"],
};

describe("aggregateEaForm", () => {
    it("aggregates 12 months into a single EA payload in ringgit", () => {
        const payslips = Array.from({ length: 12 }, (_, i) =>
            slip({ periodMonth: `2026-${String(i + 1).padStart(2, "0")}-01` }),
        );
        const ea = aggregateEaForm({ year: 2026, employee, employer, payslips });

        expect(ea.months).toBe(12);
        // 12 × (3000 + 200 + 100) basic/allow/ot = 39600
        expect(ea.income.b1_salary_and_leave).toBe(39_600);
        // 12 × (500 + 0) commission/kpi = 6000
        expect(ea.income.b2_commissions_bonuses).toBe(6_000);
        expect(ea.income.gross_total).toBe(45_600);
        expect(ea.deductions.d1_pcb).toBe(180);
        expect(ea.contributions.e1_epf_employee).toBe(3_600);
        expect(ea.socso.f1_socso_employee).toBe(96);
        expect(ea.socso.f2_eis_employee).toBe(24);
    });

    it("ignores payslips that belong to other years", () => {
        const payslips = [
            slip({ periodMonth: "2025-12-01" }),
            slip({ periodMonth: "2026-01-01" }),
            slip({ periodMonth: "2027-01-01" }),
        ];
        const ea = aggregateEaForm({ year: 2026, employee, employer, payslips });
        expect(ea.months).toBe(1);
        expect(ea.income.gross_total).toBe(3_800);
    });

    it("counts distinct months even if there are multiple payslips per month (amendments)", () => {
        const payslips = [
            slip({ periodMonth: "2026-01-01" }),
            slip({
                periodMonth: "2026-01-01",
                grossBasic: toSen(0),
                grossAllowances: toSen(0),
                grossCommission: toSen(0),
                grossOt: toSen(0),
            }),
            slip({ periodMonth: "2026-02-01" }),
        ];
        const ea = aggregateEaForm({ year: 2026, employee, employer, payslips });
        expect(ea.months).toBe(2);
    });

    it("returns zeros for an employee with no payslips in the year", () => {
        const ea = aggregateEaForm({ year: 2026, employee, employer, payslips: [] });
        expect(ea.months).toBe(0);
        expect(ea.income.gross_total).toBe(0);
        expect(ea.deductions.d1_pcb).toBe(0);
    });
});
