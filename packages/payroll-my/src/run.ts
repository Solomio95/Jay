import { type Payslip, type Sen, addSen, subSen } from "@bentop/domain";
import { computeEpf } from "./epf.js";
import { computeSocso } from "./socso.js";
import { computeEis } from "./eis.js";
import { computePcb } from "./pcb/formula.js";
import type { PcbReliefs } from "./pcb/reliefs.js";
import type { TaxBand } from "./pcb/tax-bands.js";

export interface EmployeePayrollInput {
    employeeId: string;
    payrollRunId: string;
    periodMonth: string;                // ISO first-of-month, e.g. "2026-04-01"
    monthIndex: number;                 // 1..12
    ageYears: number;
    firstRegisteredSocsoAgeYears?: number;

    pcbCategory: string;                // "K", "KA1", ...
    childrenInTertiary?: number;

    // Earnings this month (in sen).
    grossBasic: Sen;                    // contractual monthly salary
    grossAllowances: Sen;               // regular fixed allowances (EPF-liable)
    grossOt: Sen;                       // OT pay (subject to EPF; not PCB-additional by default)
    grossCommission: Sen;               // one-off additional remuneration (PCB-additional)
    grossKpiBonus: Sen;                 // one-off additional remuneration (PCB-additional)
    grossOtherAdditional: Sen;          // any other one-off payments

    // Year-to-date figures as of start of THIS month (i.e. Jan through month-1).
    ytdNormalTaxableSen: Sen;
    ytdAdditionalTaxableSen: Sen;
    ytdEpfEmployeeSen: Sen;
    ytdSocsoEmployeeSen: Sen;
    ytdZakatSen: Sen;
    ytdMtdPaidSen: Sen;

    // Optional overrides.
    zakatThisMonthSen?: Sen;
    additionalReliefSen?: number;       // from TP1
    otherDeductions?: { label: string; amount: Sen }[];
    reliefs?: PcbReliefs;
    taxBands?: TaxBand[];
}

// Compute a single employee's payslip for one month.
// EPF-liable wage: basic + regular allowances + OT (per Employment Act).
// Additional remuneration for PCB: commission + KPI bonus + other one-offs.
export const computePayslip = (input: EmployeePayrollInput): Payslip => {
    const normalWage = addSen(input.grossBasic, input.grossAllowances, input.grossOt);
    const additionalWage = addSen(
        input.grossCommission,
        input.grossKpiBonus,
        input.grossOtherAdditional,
    );
    const fullGross = addSen(normalWage, additionalWage);

    // EPF, SOCSO, EIS all apply to normal+additional gross (the "wages" definition in
    // the EPF Act includes commission). Some employers exclude commission from EPF
    // — configurable in future; for now we use the statutory default.
    const epf = computeEpf({ wageSen: fullGross, ageYears: input.ageYears });
    const socso = computeSocso({
        wageSen: fullGross,
        ageYears: input.ageYears,
        firstRegisteredAgeYears: input.firstRegisteredSocsoAgeYears,
    });
    const eis = computeEis({ wageSen: fullGross, ageYears: input.ageYears });

    const pcb = computePcb({
        category: input.pcbCategory,
        childrenInTertiary: input.childrenInTertiary,
        monthIndex: input.monthIndex,
        currentMonthNormalSen: normalWage,
        currentMonthAdditionalSen: additionalWage,
        currentMonthEpfEmployeeSen: epf.employeeSen,
        currentMonthSocsoEmployeeSen: socso.employeeSen,
        currentMonthZakatSen: input.zakatThisMonthSen ?? (0 as Sen),
        ytdNormalTaxableSen: input.ytdNormalTaxableSen,
        ytdAdditionalTaxableSen: input.ytdAdditionalTaxableSen,
        ytdEpfEmployeeSen: input.ytdEpfEmployeeSen,
        ytdSocsoEmployeeSen: input.ytdSocsoEmployeeSen,
        ytdZakatSen: input.ytdZakatSen,
        ytdMtdPaidSen: input.ytdMtdPaidSen,
        additionalReliefSen: input.additionalReliefSen ?? 0,
        reliefs: input.reliefs,
        taxBands: input.taxBands,
    });

    const otherDeductionTotal = addSen(
        ...(input.otherDeductions?.map((d) => d.amount) ?? []),
    );
    const totalDeductions = addSen(
        epf.employeeSen,
        socso.employeeSen,
        eis.employeeSen,
        pcb.totalMtdSen,
        input.zakatThisMonthSen ?? (0 as Sen),
        otherDeductionTotal,
    );
    const netPay = subSen(fullGross, totalDeductions);

    return {
        employeeId: input.employeeId,
        payrollRunId: input.payrollRunId,
        periodMonth: input.periodMonth,
        grossBasic: input.grossBasic,
        grossAllowances: input.grossAllowances,
        grossCommission: input.grossCommission,
        grossOt: input.grossOt,
        grossKpiBonus: input.grossKpiBonus,
        grossTotal: fullGross,
        epfEmployee: epf.employeeSen,
        epfEmployer: epf.employerSen,
        socsoEmployee: socso.employeeSen,
        socsoEmployer: socso.employerSen,
        eisEmployee: eis.employeeSen,
        eisEmployer: eis.employerSen,
        pcb: pcb.totalMtdSen,
        otherDeductions: input.otherDeductions ?? [],
        netPay,
    };
};
