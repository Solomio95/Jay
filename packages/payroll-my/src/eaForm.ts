// Form EA aggregator — turns 12 months of payslips into a single annual
// income statement that LHDN requires us to hand every employee by the end
// of February each year (Income Tax Act 1967, s.83(1A)).
//
// We keep this as a pure function over in-memory payslip rows so it is
// trivially testable; the caller (an Edge Function) decides where to fetch
// rows from and where to put the resulting JSON / PDF.
//
// The mapping of our payslip columns to LHDN's Form EA boxes:
//   B.1  (salary, wages, leave pay)          ← grossBasic + grossAllowances
//   B.2  (fees, commissions, bonuses)        ← grossCommission + grossKpiBonus
//   B.3  (gross tips, perquisites, awards)   ← not tracked today (zero)
//   B.4  (allowances in lieu of incidentals) ← captured under B.1 with basic
//   B.5  (benefits-in-kind)                  ← zero today
//   D.1  (PCB)                               ← sum(pcb)
//   D.2  (zakat via payroll)                 ← zero today
//   E.1  (EPF employee)                      ← sum(epfEmployee)
//   F.1  (SOCSO employee)                    ← sum(socsoEmployee)
//   F.2  (EIS employee)                      ← sum(eisEmployee)
//
// OT is folded into B.1 because LHDN treats it as regular employment
// income and the shape of our grossOt already matches that.

import type { Payslip } from "@bentop/domain";

export interface EaFormInput {
    year: number;
    employee: {
        employeeNo: string;
        fullName: string;
        icNo: string | null;
        taxNo: string | null;
        epfNo: string | null;
        socsoNo: string | null;
        position: string | null;
        hiredOn: string | null;     // ISO
        terminatedOn: string | null; // ISO, null if still employed
    };
    employer: {
        name: string;
        employerE: string;          // LHDN Nombor Majikan (E)
        address: string[];
    };
    payslips: Payslip[];
}

export interface EaFormPayload {
    year: number;
    employee: EaFormInput["employee"];
    employer: EaFormInput["employer"];
    months: number;                 // distinct months we have payslips for
    income: {
        b1_salary_and_leave: number; // ringgit
        b2_commissions_bonuses: number;
        b3_perquisites: number;
        b5_bik: number;
        gross_total: number;
    };
    deductions: {
        d1_pcb: number;
        d2_zakat: number;
    };
    contributions: {
        e1_epf_employee: number;
    };
    socso: {
        f1_socso_employee: number;
        f2_eis_employee: number;
    };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
// Payslip columns are in sen; Form EA is reported in ringgit with 2dp.
const senToRm = (sen: number) => Math.round(sen) / 100;

export const aggregateEaForm = (input: EaFormInput): EaFormPayload => {
    const slips = input.payslips.filter((ps) => {
        const y = Number(ps.periodMonth.slice(0, 4));
        return y === input.year;
    });
    const months = new Set(slips.map((ps) => ps.periodMonth.slice(0, 7))).size;

    const b1Sen = sum(slips.map((ps) => ps.grossBasic + ps.grossAllowances + ps.grossOt));
    const b2Sen = sum(slips.map((ps) => ps.grossCommission + ps.grossKpiBonus));
    const pcbSen = sum(slips.map((ps) => ps.pcb));
    const epfSen = sum(slips.map((ps) => ps.epfEmployee));
    const socsoSen = sum(slips.map((ps) => ps.socsoEmployee));
    const eisSen = sum(slips.map((ps) => ps.eisEmployee));

    return {
        year: input.year,
        employee: input.employee,
        employer: input.employer,
        months,
        income: {
            b1_salary_and_leave: senToRm(b1Sen),
            b2_commissions_bonuses: senToRm(b2Sen),
            b3_perquisites: 0,
            b5_bik: 0,
            gross_total: senToRm(b1Sen + b2Sen),
        },
        deductions: {
            d1_pcb: senToRm(pcbSen),
            d2_zakat: 0,
        },
        contributions: {
            e1_epf_employee: senToRm(epfSen),
        },
        socso: {
            f1_socso_employee: senToRm(socsoSen),
            f2_eis_employee: senToRm(eisSen),
        },
    };
};
