import type { Sen } from "./money.js";

export type PayrollRunStatus =
    | "draft"
    | "previewed"
    | "approved"
    | "paid"
    | "closed";

export interface PayslipLine {
    label: string;
    amount: Sen;
}

export interface Payslip {
    employeeId: string;
    payrollRunId: string;
    periodMonth: string;       // ISO first-of-month
    grossBasic: Sen;
    grossAllowances: Sen;
    grossCommission: Sen;
    grossOt: Sen;
    grossKpiBonus: Sen;
    grossTotal: Sen;
    epfEmployee: Sen;
    epfEmployer: Sen;
    socsoEmployee: Sen;
    socsoEmployer: Sen;
    eisEmployee: Sen;
    eisEmployer: Sen;
    pcb: Sen;
    otherDeductions: PayslipLine[];
    netPay: Sen;
}
