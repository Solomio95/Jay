// Pure payroll-run orchestrator.
//
// The edge function wraps this with a real Supabase data provider; tests wrap
// it with an in-memory provider. The orchestrator itself is I/O-free: it asks
// the provider for data, computes payslips via `computePayslip`, renders PDFs
// via `@bentop/pdf`, and hands results back to the provider to persist.
//
// Contract (what the provider guarantees the orchestrator):
//   - statutory rates that cover pay_date are loaded for EPF, SOCSO, EIS, PCB
//   - the commission run for this period is `approved` (amounts folded in)
//   - all employees passed in are `active` on pay_date
//
// Anything else — missing rates, unapproved commission, terminated staff —
// the provider rejects up front and the orchestrator never sees it.

import type { Payslip, Sen } from "@bentop/domain";
import {
    type PayslipPdfCompany,
    type PayslipPdfEmployee,
    renderPayslipPdf,
} from "@bentop/pdf";
import { type EmployeePayrollInput, computePayslip } from "./run.js";

export interface PayrollRunMeta {
    id: string;
    periodMonth: string;   // "YYYY-MM-01"
    payDate: string;       // "YYYY-MM-DD"
    cutoffDate: string;
    monthIndex: number;    // 1..12
}

// The orchestrator receives pre-assembled employee inputs; the provider is
// responsible for joining sales/commission/KPI/OT totals into these numbers.
export interface EmployeeRunContext {
    input: EmployeePayrollInput;
    employee: PayslipPdfEmployee;
}

export interface OrchestrationProvider {
    assertRatesCoverPayDate(payDate: string): Promise<void>;
    assertCommissionRunApproved(periodMonth: string): Promise<void>;
    listEmployeeContexts(run: PayrollRunMeta): Promise<EmployeeRunContext[]>;
    getCompany(): Promise<PayslipPdfCompany>;
    upsertPayslip(payslip: Payslip, employeeId: string): Promise<string>; // returns payslip row id
    uploadPayslipPdf(
        payslipId: string,
        run: PayrollRunMeta,
        employee: PayslipPdfEmployee,
        bytes: Uint8Array,
    ): Promise<string>; // returns pdf_url
    setPayslipPdfUrl(payslipId: string, pdfUrl: string): Promise<void>;
    transitionRunStatus(runId: string, status: "previewed" | "approved"): Promise<void>;
}

export interface OrchestrationResult {
    runId: string;
    status: "previewed";
    payslipCount: number;
    grossTotalSen: Sen;
    netPayTotalSen: Sen;
    pcbTotalSen: Sen;
    epfEmployerTotalSen: Sen;
}

export const orchestratePayrollRun = async (
    run: PayrollRunMeta,
    provider: OrchestrationProvider,
): Promise<OrchestrationResult> => {
    // Fail fast: rates + commission dependencies must be ready.
    await provider.assertRatesCoverPayDate(run.payDate);
    await provider.assertCommissionRunApproved(run.periodMonth);

    const [contexts, company] = await Promise.all([
        provider.listEmployeeContexts(run),
        provider.getCompany(),
    ]);

    let grossTotal = 0;
    let netTotal = 0;
    let pcbTotal = 0;
    let epfEmployerTotal = 0;

    for (const ctx of contexts) {
        const payslip = computePayslip(ctx.input);

        const payslipId = await provider.upsertPayslip(payslip, ctx.input.employeeId);
        const pdfBytes = await renderPayslipPdf({
            payslip,
            company,
            employee: ctx.employee,
        });
        const pdfUrl = await provider.uploadPayslipPdf(
            payslipId,
            run,
            ctx.employee,
            pdfBytes,
        );
        await provider.setPayslipPdfUrl(payslipId, pdfUrl);

        grossTotal += payslip.grossTotal;
        netTotal += payslip.netPay;
        pcbTotal += payslip.pcb;
        epfEmployerTotal += payslip.epfEmployer;
    }

    await provider.transitionRunStatus(run.id, "previewed");

    return {
        runId: run.id,
        status: "previewed",
        payslipCount: contexts.length,
        grossTotalSen: grossTotal as Sen,
        netPayTotalSen: netTotal as Sen,
        pcbTotalSen: pcbTotal as Sen,
        epfEmployerTotalSen: epfEmployerTotal as Sen,
    };
};
