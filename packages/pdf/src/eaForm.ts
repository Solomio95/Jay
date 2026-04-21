// Form EA (Borang EA) — one-page annual income statement rendered as an A4
// PDF. The layout mirrors LHDN's boxed format so recipients can cross-check
// against the canonical form, but we don't pretend to be a pixel-perfect
// reproduction — the numbers and box labels are what matter.
//
// Inputs are already in ringgit (see `aggregateEaForm` in @bentop/payroll-my)
// so this module is purely a layout + number-formatting concern.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface EaFormPdfInput {
    year: number;
    employee: {
        employeeNo: string;
        fullName: string;
        icNo: string | null;
        taxNo: string | null;
        epfNo: string | null;
        socsoNo: string | null;
        position: string | null;
        hiredOn: string | null;
        terminatedOn: string | null;
    };
    employer: {
        name: string;
        employerE: string;
        address: string[];
    };
    months: number;
    income: {
        b1_salary_and_leave: number;
        b2_commissions_bonuses: number;
        b3_perquisites: number;
        b5_bik: number;
        gross_total: number;
    };
    deductions: { d1_pcb: number; d2_zakat: number };
    contributions: { e1_epf_employee: number };
    socso: { f1_socso_employee: number; f2_eis_employee: number };
}

const fmtRm = (rm: number): string => {
    const sign = rm < 0 ? "-" : "";
    const abs = Math.abs(rm);
    const [intPart, decPart = "00"] = abs.toFixed(2).split(".");
    const withCommas = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}${withCommas}.${decPart}`;
};

export const renderEaFormPdf = async (input: EaFormPdfInput): Promise<Uint8Array> => {
    const { year, employee, employer, income, deductions, contributions, socso } = input;

    const doc = await PDFDocument.create();
    doc.setTitle(`Form EA ${year} — ${employee.employeeNo}`);
    doc.setAuthor(employer.name);
    doc.setCreator("Bentop HR");
    doc.setProducer("Bentop HR");

    const page = doc.addPage([595.28, 841.89]); // A4 portrait
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const marginX = 40;
    const rightX = 595.28 - marginX;
    let y = 800;

    const black = rgb(0, 0, 0);
    const grey = rgb(0.45, 0.45, 0.45);
    const lineGrey = rgb(0.8, 0.8, 0.8);

    const drawText = (
        text: string,
        x: number,
        yy: number,
        opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
    ) => {
        page.drawText(text, {
            x, y: yy,
            size: opts.size ?? 9,
            font: opts.bold ? fontBold : font,
            color: opts.color ?? black,
        });
    };

    const drawRight = (
        text: string,
        xRight: number,
        yy: number,
        opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
    ) => {
        const size = opts.size ?? 9;
        const f = opts.bold ? fontBold : font;
        const width = f.widthOfTextAtSize(text, size);
        drawText(text, xRight - width, yy, opts);
    };

    const hr = (yy: number, color = lineGrey) => {
        page.drawLine({
            start: { x: marginX, y: yy },
            end: { x: rightX, y: yy },
            thickness: 0.5,
            color,
        });
    };

    // --- Title
    drawText("BORANG EA / FORM EA", marginX, y, { size: 14, bold: true });
    drawRight(`Year of Assessment ${year}`, rightX, y, { size: 12, bold: true });
    y -= 14;
    drawText(
        "Statement of Remuneration from Employment (Income Tax Act 1967, s.83(1A))",
        marginX, y,
        { size: 8, color: grey },
    );
    y -= 10;
    hr(y, black);
    y -= 18;

    // --- Part A: Employer
    drawText("A. EMPLOYER", marginX, y, { bold: true, size: 10 });
    y -= 14;
    drawText("Name", marginX, y, { color: grey });
    drawText(employer.name, marginX + 90, y, { bold: true });
    y -= 12;
    drawText("Employer E-no.", marginX, y, { color: grey });
    drawText(employer.employerE, marginX + 90, y, { bold: true });
    y -= 12;
    drawText("Address", marginX, y, { color: grey });
    let addrY = y;
    for (const line of employer.address) {
        drawText(line, marginX + 90, addrY);
        addrY -= 10;
    }
    y = Math.min(y, addrY) - 4;

    hr(y);
    y -= 14;

    // --- Part B: Employee
    drawText("B. EMPLOYEE", marginX, y, { bold: true, size: 10 });
    y -= 14;
    const leftPairs: [string, string | null][] = [
        ["Name", employee.fullName],
        ["Employee No.", employee.employeeNo],
        ["NRIC / Passport", employee.icNo],
        ["Position", employee.position],
    ];
    const rightPairs: [string, string | null][] = [
        ["Income Tax No.", employee.taxNo],
        ["EPF No.", employee.epfNo],
        ["SOCSO No.", employee.socsoNo],
        [
            "Period of employment",
            employee.hiredOn
                ? `${employee.hiredOn} - ${employee.terminatedOn ?? "present"}`
                : null,
        ],
    ];
    const col2X = 310;
    for (let i = 0; i < Math.max(leftPairs.length, rightPairs.length); i++) {
        const l = leftPairs[i];
        const r = rightPairs[i];
        if (l && l[1]) {
            drawText(l[0], marginX, y, { color: grey });
            drawText(l[1], marginX + 100, y, { bold: true });
        }
        if (r && r[1]) {
            drawText(r[0], col2X, y, { color: grey });
            drawText(r[1], col2X + 100, y, { bold: true });
        }
        y -= 12;
    }

    y -= 4;
    hr(y);
    y -= 14;

    // --- Part C: Income
    drawText("C. GROSS INCOME FROM EMPLOYMENT", marginX, y, { bold: true, size: 10 });
    y -= 14;

    const incomeRows: [string, string, number][] = [
        ["B.1", "Salary, wages, leave pay, OT", income.b1_salary_and_leave],
        ["B.2", "Fees, commissions, bonuses", income.b2_commissions_bonuses],
        ["B.3", "Gross tips, perquisites, awards", income.b3_perquisites],
        ["B.5", "Benefits-in-kind", income.b5_bik],
    ];
    drawText("Box", marginX, y, { color: grey, size: 8 });
    drawText("Description", marginX + 40, y, { color: grey, size: 8 });
    drawRight("Amount (RM)", rightX, y, { color: grey, size: 8 });
    y -= 10;
    hr(y);
    y -= 12;
    for (const [box, label, val] of incomeRows) {
        drawText(box, marginX, y);
        drawText(label, marginX + 40, y);
        drawRight(fmtRm(val), rightX, y);
        y -= 12;
    }
    hr(y);
    y -= 14;
    drawText("Gross total (C)", marginX + 40, y, { bold: true });
    drawRight(fmtRm(income.gross_total), rightX, y, { bold: true });
    y -= 16;
    hr(y);
    y -= 14;

    // --- Part D: Deductions
    drawText("D. DEDUCTIONS", marginX, y, { bold: true, size: 10 });
    y -= 14;
    const dedRows: [string, string, number][] = [
        ["D.1", "Monthly Tax Deduction (PCB)", deductions.d1_pcb],
        ["D.2", "Zakat paid via salary deduction", deductions.d2_zakat],
    ];
    for (const [box, label, val] of dedRows) {
        drawText(box, marginX, y);
        drawText(label, marginX + 40, y);
        drawRight(fmtRm(val), rightX, y);
        y -= 12;
    }

    y -= 4;
    hr(y);
    y -= 14;

    // --- Part E: EPF
    drawText("E. CONTRIBUTIONS TO APPROVED PROVIDENT FUND", marginX, y, {
        bold: true, size: 10,
    });
    y -= 14;
    drawText("E.1", marginX, y);
    drawText("EPF (employee share)", marginX + 40, y);
    drawRight(fmtRm(contributions.e1_epf_employee), rightX, y);
    y -= 16;

    hr(y);
    y -= 14;

    // --- Part F: SOCSO / EIS
    drawText("F. SOCSO / EIS CONTRIBUTIONS", marginX, y, { bold: true, size: 10 });
    y -= 14;
    drawText("F.1", marginX, y);
    drawText("SOCSO (employee share)", marginX + 40, y);
    drawRight(fmtRm(socso.f1_socso_employee), rightX, y);
    y -= 12;
    drawText("F.2", marginX, y);
    drawText("EIS (employee share)", marginX + 40, y);
    drawRight(fmtRm(socso.f2_eis_employee), rightX, y);
    y -= 16;

    // --- Footer
    const footerY = 50;
    drawText(
        `This statement covers ${input.months} month${input.months === 1 ? "" : "s"} of payroll in ${year}.`,
        marginX,
        footerY + 12,
        { size: 8, color: grey },
    );
    drawText(
        "Computer-generated; no signature required. Retain for 7 years per Income Tax Act s.82A.",
        marginX,
        footerY,
        { size: 7, color: grey },
    );
    drawRight(`EA-${employee.employeeNo}-${year}`, rightX, footerY, {
        size: 7, color: grey,
    });

    return doc.save();
};
