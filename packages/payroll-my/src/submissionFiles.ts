// Statutory submission file builders.
//
// Three files are generated per monthly payroll run:
//   - KWSP (EPF)   i-Akaun Majikan Form A, TXT
//   - PERKESO      Assist Portal bulk upload (SOCSO + EIS), CSV
//   - LHDN         CP39 monthly PCB remittance, TXT
//
// Each format has a published spec; the exact field widths and delimiters
// are bank- / regulator-account specific, so we produce a well-shaped,
// deterministic baseline that maps cleanly to the published column order.
// The rest is a templating exercise once Bentop confirms the account
// format with each regulator.

export interface StatutoryEmployee {
    employeeNo: string;
    fullName: string;
    icNo: string | null;       // NRIC no dashes
    taxNo: string | null;      // LHDN e-number
    epfNo: string | null;
    socsoNo: string | null;
    epfEmployee: number;       // ringgit
    epfEmployer: number;
    socsoEmployee: number;
    socsoEmployer: number;
    eisEmployee: number;
    eisEmployer: number;
    pcb: number;
}

export interface StatutoryEmployer {
    name: string;
    epfEmployerNo: string;
    socsoEmployerCode: string;
    lhdnEmployerNo: string;    // E-number
}

export interface StatutoryRunInput {
    periodMonth: string;       // "YYYY-MM-01"
    payDate: string;           // "YYYY-MM-DD"
    employer: StatutoryEmployer;
    employees: StatutoryEmployee[];
}

export interface StatutoryFile {
    filename: string;
    text: string;
    totalAmountSen: number;
    totalCount: number;
}

const toSen = (rm: number): number => Math.round(rm * 100);
const ym = (iso: string) => iso.slice(0, 7).replace("-", "");
const escapeCsv = (s: string): string =>
    /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
const CRLF = "\r\n";

// ---------------------------------------------------------------------------
// KWSP (EPF) — Form A TXT, i-Akaun Majikan
// Pipe-delimited, one header + one row per employee.
// Header: H|employer_no|YYYYMM|total_count|total_sen
// Detail: D|epf_no|ic_no|name|wages_sen|employee_sen|employer_sen
// Trailer: T|total_count|total_sen
// ---------------------------------------------------------------------------
export const buildKwspFormA = (input: StatutoryRunInput): StatutoryFile => {
    const period = ym(input.periodMonth);
    const rows: string[] = [];
    let totalSen = 0;
    let count = 0;

    for (const e of input.employees) {
        const empSen = toSen(e.epfEmployee);
        const erSen = toSen(e.epfEmployer);
        if (empSen === 0 && erSen === 0) continue;
        const wagesSen = toSen(e.epfEmployee + e.epfEmployer); // proxy, true wages if caller passes
        totalSen += empSen + erSen;
        count += 1;
        rows.push([
            "D",
            e.epfNo ?? "",
            e.icNo ?? "",
            e.fullName,
            String(wagesSen),
            String(empSen),
            String(erSen),
        ].join("|"));
    }

    const header = [
        "H",
        input.employer.epfEmployerNo,
        period,
        String(count),
        String(totalSen),
    ].join("|");
    const trailer = ["T", String(count), String(totalSen)].join("|");
    const text = [header, ...rows, trailer].join(CRLF) + CRLF;

    return {
        filename: `kwsp-form-a-${period}.txt`,
        text,
        totalAmountSen: totalSen,
        totalCount: count,
    };
};

// ---------------------------------------------------------------------------
// PERKESO — Assist Portal bulk upload (SOCSO + EIS combined)
// CSV with header row. PERKESO calculates employer portions server-side once
// wages are supplied, but we emit both portions for our own reconciliation.
// Columns:
//   employer_code, period_yyyymm, socso_no, ic_no, name,
//   socso_employee, socso_employer, eis_employee, eis_employer
// ---------------------------------------------------------------------------
export const buildPerkesoAssist = (input: StatutoryRunInput): StatutoryFile => {
    const period = ym(input.periodMonth);
    const header = [
        "employer_code",
        "period",
        "socso_no",
        "ic_no",
        "name",
        "socso_employee",
        "socso_employer",
        "eis_employee",
        "eis_employer",
    ].map(escapeCsv).join(",");

    const rows: string[] = [];
    let totalSen = 0;
    let count = 0;

    for (const e of input.employees) {
        const socEmp = toSen(e.socsoEmployee);
        const socEr = toSen(e.socsoEmployer);
        const eisEmp = toSen(e.eisEmployee);
        const eisEr = toSen(e.eisEmployer);
        if (socEmp + socEr + eisEmp + eisEr === 0) continue;
        totalSen += socEmp + socEr + eisEmp + eisEr;
        count += 1;
        rows.push([
            input.employer.socsoEmployerCode,
            period,
            e.socsoNo ?? "",
            e.icNo ?? "",
            e.fullName,
            (socEmp / 100).toFixed(2),
            (socEr / 100).toFixed(2),
            (eisEmp / 100).toFixed(2),
            (eisEr / 100).toFixed(2),
        ].map(escapeCsv).join(","));
    }

    const text = [header, ...rows].join(CRLF) + CRLF;

    return {
        filename: `perkeso-assist-${period}.csv`,
        text,
        totalAmountSen: totalSen,
        totalCount: count,
    };
};

// ---------------------------------------------------------------------------
// LHDN — CP39 monthly PCB remittance TXT
// Pipe-delimited; tax agent file format used by most MY payroll vendors.
// Header: H|employer_no|YYYYMM|pay_date_YYYYMMDD|total_count|total_sen
// Detail: D|tax_no|ic_no|name|pcb_sen|cp38_sen
// Trailer: T|total_count|total_sen
// ---------------------------------------------------------------------------
export const buildLhdnCp39 = (input: StatutoryRunInput): StatutoryFile => {
    const period = ym(input.periodMonth);
    const payDate = input.payDate.replace(/-/g, "");
    const rows: string[] = [];
    let totalSen = 0;
    let count = 0;

    for (const e of input.employees) {
        const pcbSen = toSen(e.pcb);
        if (pcbSen === 0) continue;
        totalSen += pcbSen;
        count += 1;
        rows.push([
            "D",
            e.taxNo ?? "",
            e.icNo ?? "",
            e.fullName,
            String(pcbSen),
            "0",                       // CP38 arrears not tracked today
        ].join("|"));
    }

    const header = [
        "H",
        input.employer.lhdnEmployerNo,
        period,
        payDate,
        String(count),
        String(totalSen),
    ].join("|");
    const trailer = ["T", String(count), String(totalSen)].join("|");
    const text = [header, ...rows, trailer].join(CRLF) + CRLF;

    return {
        filename: `lhdn-cp39-${period}.txt`,
        text,
        totalAmountSen: totalSen,
        totalCount: count,
    };
};

export const buildAllStatutoryFiles = (input: StatutoryRunInput): StatutoryFile[] => [
    buildKwspFormA(input),
    buildPerkesoAssist(input),
    buildLhdnCp39(input),
];
