import { describe, expect, it } from "vitest";
import { type Payslip, type Sen, toSen } from "@bentop/domain";
import type {
    PayslipPdfCompany,
    PayslipPdfEmployee,
} from "@bentop/pdf";
import {
    type EmployeeRunContext,
    type OrchestrationProvider,
    type PayrollRunMeta,
    orchestratePayrollRun,
} from "./orchestrate.js";
import type { EmployeePayrollInput } from "./run.js";

const COMPANY: PayslipPdfCompany = {
    name: "Bentop Sdn Bhd",
    registrationNo: "202301012345 (1234567-A)",
    addressLines: ["Lot 12 Jalan Kilang 3", "47500 Subang Jaya"],
};

const baseRun: PayrollRunMeta = {
    id: "run_2026_04",
    periodMonth: "2026-04-01",
    payDate: "2026-05-07",
    cutoffDate: "2026-04-30",
    monthIndex: 4,
};

const makeInput = (
    overrides: Partial<EmployeePayrollInput> & { employeeId: string },
): EmployeePayrollInput => ({
    payrollRunId: baseRun.id,
    periodMonth: baseRun.periodMonth,
    monthIndex: baseRun.monthIndex,
    ageYears: 30,
    pcbCategory: "K",
    grossBasic: toSen(3200),
    grossAllowances: toSen(0),
    grossOt: toSen(0),
    grossCommission: toSen(0),
    grossKpiBonus: toSen(0),
    grossOtherAdditional: toSen(0),
    ytdNormalTaxableSen: toSen(9600),
    ytdAdditionalTaxableSen: toSen(0),
    ytdEpfEmployeeSen: toSen(1056),
    ytdSocsoEmployeeSen: toSen(150),
    ytdZakatSen: toSen(0),
    ytdMtdPaidSen: toSen(0),
    ...overrides,
});

const makeEmployee = (no: string): PayslipPdfEmployee => ({
    fullName: `Employee ${no}`,
    employeeNo: no,
});

class FakeProvider implements OrchestrationProvider {
    public ratesChecked = false;
    public commissionChecked = false;
    public payslipsStored: Array<{ id: string; payslip: Payslip; employeeId: string }> = [];
    public pdfUploads: Array<{ id: string; bytes: Uint8Array; pdfUrl: string }> = [];
    public urlUpdates: Array<{ id: string; url: string }> = [];
    public finalStatus: string | null = null;

    constructor(private contexts: EmployeeRunContext[]) {}

    async assertRatesCoverPayDate(_payDate: string): Promise<void> {
        this.ratesChecked = true;
    }
    async assertCommissionRunApproved(_periodMonth: string): Promise<void> {
        this.commissionChecked = true;
    }
    async listEmployeeContexts(_run: PayrollRunMeta): Promise<EmployeeRunContext[]> {
        return this.contexts;
    }
    async getCompany(): Promise<PayslipPdfCompany> {
        return COMPANY;
    }
    async upsertPayslip(payslip: Payslip, employeeId: string): Promise<string> {
        const id = `payslip_${employeeId}`;
        this.payslipsStored.push({ id, payslip, employeeId });
        return id;
    }
    async uploadPayslipPdf(
        payslipId: string,
        _run: PayrollRunMeta,
        _employee: PayslipPdfEmployee,
        bytes: Uint8Array,
    ): Promise<string> {
        const pdfUrl = `storage://payslips/${payslipId}.pdf`;
        this.pdfUploads.push({ id: payslipId, bytes, pdfUrl });
        return pdfUrl;
    }
    async setPayslipPdfUrl(payslipId: string, pdfUrl: string): Promise<void> {
        this.urlUpdates.push({ id: payslipId, url: pdfUrl });
    }
    async transitionRunStatus(
        _runId: string,
        status: "previewed" | "approved",
    ): Promise<void> {
        this.finalStatus = status;
    }
}

describe("orchestratePayrollRun", () => {
    it("asserts rates + commission, computes payslips, uploads PDFs, flips to previewed", async () => {
        const contexts: EmployeeRunContext[] = [
            {
                input: makeInput({ employeeId: "emp_001" }),
                employee: makeEmployee("BP-00001"),
            },
            {
                input: makeInput({
                    employeeId: "emp_002",
                    grossBasic: toSen(5000),
                    grossCommission: toSen(800),
                    ytdNormalTaxableSen: toSen(15000),
                    ytdEpfEmployeeSen: toSen(1650),
                    ytdSocsoEmployeeSen: toSen(225),
                }),
                employee: makeEmployee("BP-00002"),
            },
        ];
        const provider = new FakeProvider(contexts);

        const result = await orchestratePayrollRun(baseRun, provider);

        expect(provider.ratesChecked).toBe(true);
        expect(provider.commissionChecked).toBe(true);
        expect(result.payslipCount).toBe(2);
        expect(result.status).toBe("previewed");
        expect(provider.finalStatus).toBe("previewed");

        expect(provider.payslipsStored).toHaveLength(2);
        expect(provider.pdfUploads).toHaveLength(2);
        expect(provider.urlUpdates).toHaveLength(2);
        for (const upload of provider.pdfUploads) {
            expect(upload.bytes).toBeInstanceOf(Uint8Array);
            expect(upload.bytes.length).toBeGreaterThan(1000);
            expect(upload.pdfUrl).toMatch(/^storage:\/\/payslips\//);
        }

        // Totals are non-negative and reflect the 2 employees summed.
        expect(result.grossTotalSen).toBeGreaterThan(0);
        expect(result.netPayTotalSen).toBeGreaterThan(0);
        expect(result.netPayTotalSen).toBeLessThanOrEqual(result.grossTotalSen);
    });

    it("short-circuits when rates are missing", async () => {
        const provider = new FakeProvider([]);
        provider.assertRatesCoverPayDate = async () => {
            throw new Error("no statutory rate row covers pay_date 2026-05-07");
        };
        await expect(orchestratePayrollRun(baseRun, provider)).rejects.toThrow(
            /no statutory rate row/,
        );
        expect(provider.finalStatus).toBeNull();
    });

    it("short-circuits when commission run is not approved", async () => {
        const provider = new FakeProvider([]);
        provider.assertCommissionRunApproved = async () => {
            throw new Error("commission run for 2026-04-01 is not approved");
        };
        await expect(orchestratePayrollRun(baseRun, provider)).rejects.toThrow(
            /commission run/,
        );
        expect(provider.finalStatus).toBeNull();
    });

    it("produces no payslips when the contexts list is empty", async () => {
        const provider = new FakeProvider([]);
        const result = await orchestratePayrollRun(baseRun, provider);
        expect(result.payslipCount).toBe(0);
        expect(result.grossTotalSen).toBe(0 as Sen);
        expect(provider.finalStatus).toBe("previewed");
    });
});
