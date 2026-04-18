import {
    type Payslip,
    type Sen,
    addSen,
    subSen,
} from "@bentop/domain";
import { computeEpf } from "./epf.js";
import { computeSocso } from "./socso.js";
import { computeEis } from "./eis.js";
import { computePcb } from "./pcb.js";

export interface EmployeePayrollInput {
    employeeId: string;
    payrollRunId: string;
    periodMonth: string;
    ageYears: number;
    pcbCategory: "K" | "KA1" | "KA2" | "KA3" | "KA4" | "KA5";
    grossBasic: Sen;
    grossAllowances: Sen;
    grossCommission: Sen;
    grossOt: Sen;
    grossKpiBonus: Sen;
    ytdTaxableIncomeSen: number;
    ytdPcbPaidSen: number;
    epfYtdSen: number;
    monthsRemaining: number;
}

export const computePayslip = (input: EmployeePayrollInput): Payslip => {
    // EPF statutory wage excludes commission/bonus by default; HR can override in-scheme.
    const epfWage = addSen(input.grossBasic, input.grossAllowances);
    const fullGross = addSen(
        input.grossBasic,
        input.grossAllowances,
        input.grossCommission,
        input.grossOt,
        input.grossKpiBonus,
    );

    const epf = computeEpf({ wageSen: epfWage, ageYears: input.ageYears });
    const socso = computeSocso({ wageSen: epfWage });
    const eis = computeEis({ wageSen: epfWage });
    const pcb = computePcb({
        category: input.pcbCategory,
        dependents: 0,
        ytdTaxableIncomeSen: input.ytdTaxableIncomeSen,
        ytdPcbPaidSen: input.ytdPcbPaidSen,
        currentMonthTaxableSen: fullGross,
        epfYtdSen: input.epfYtdSen + epf.employeeSen,
        monthsRemaining: input.monthsRemaining,
    });

    const totalDeductions = addSen(epf.employeeSen, socso.employeeSen, eis.employeeSen, pcb);
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
        pcb,
        otherDeductions: [],
        netPay,
    };
};
