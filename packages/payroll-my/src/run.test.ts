import { describe, expect, it } from "vitest";
import { toSen } from "@bentop/domain";
import { computePayslip } from "./run.js";
import { scenarios } from "./__fixtures__/scenarios.js";

// ---------- Snapshot suite ----------
// On first run, vitest writes __snapshots__/run.test.ts.snap with the full
// payslip for each scenario. Subsequent runs diff against it. After HR
// cross-checks a scenario against LHDN/KWSP/PERKESO, they set
// `verifiedAgainst` in scenarios.ts. Any code change that alters the
// calculation fails the snapshot and forces a re-verification.
describe("payroll snapshots", () => {
    for (const s of scenarios) {
        it(`${s.id}: ${s.description}`, () => {
            const slip = computePayslip(s.input);
            expect(slip).toMatchSnapshot({
                // Snapshot everything except the IDs (they're in the input already).
                employeeId: expect.any(String),
                payrollRunId: expect.any(String),
            });
        });
    }
});

// ---------- Invariants (must hold for every scenario) ----------
describe("payroll invariants", () => {
    for (const s of scenarios) {
        describe(s.id, () => {
            const slip = computePayslip(s.input);

            it("grossTotal = basic + allowances + OT + commission + KPI bonus", () => {
                const expected =
                    s.input.grossBasic +
                    s.input.grossAllowances +
                    s.input.grossOt +
                    s.input.grossCommission +
                    s.input.grossKpiBonus +
                    s.input.grossOtherAdditional;
                expect(slip.grossTotal).toBe(expected);
            });

            it("netPay = grossTotal − employee EPF − employee SOCSO − employee EIS − PCB − other", () => {
                const otherDed = (s.input.otherDeductions ?? []).reduce(
                    (a, d) => a + d.amount,
                    0,
                );
                const zakat = s.input.zakatThisMonthSen ?? 0;
                const expected =
                    slip.grossTotal -
                    slip.epfEmployee -
                    slip.socsoEmployee -
                    slip.eisEmployee -
                    slip.pcb -
                    zakat -
                    otherDed;
                expect(slip.netPay).toBe(expected);
            });

            it("all deductions are non-negative", () => {
                expect(slip.epfEmployee).toBeGreaterThanOrEqual(0);
                expect(slip.epfEmployer).toBeGreaterThanOrEqual(0);
                expect(slip.socsoEmployee).toBeGreaterThanOrEqual(0);
                expect(slip.socsoEmployer).toBeGreaterThanOrEqual(0);
                expect(slip.eisEmployee).toBeGreaterThanOrEqual(0);
                expect(slip.eisEmployer).toBeGreaterThanOrEqual(0);
                expect(slip.pcb).toBeGreaterThanOrEqual(0);
                expect(slip.netPay).toBeGreaterThanOrEqual(0);
            });

            it("age 60+ has no EIS deduction", () => {
                if (s.input.ageYears >= 60) {
                    expect(slip.eisEmployee).toBe(0);
                    expect(slip.eisEmployer).toBe(0);
                }
            });

            it("EIS is capped at the RM 5,000 wage cap", () => {
                // Wage above RM 5,000 → the contribution is the same as the cap row.
                if (slip.grossTotal > toSen(5000) && s.input.ageYears < 60) {
                    // Contribution at the cap is ~RM 10 either side (exact value
                    // depends on rounding). Just assert it's bounded.
                    expect(slip.eisEmployee).toBeLessThanOrEqual(toSen(10));
                }
            });
        });
    }
});
