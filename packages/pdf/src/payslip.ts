import type { Payslip, Sen } from "@bentop/domain";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatPeriodMonth, formatRm } from "./format.js";

export interface PayslipPdfCompany {
    name: string;
    registrationNo: string;          // SSM, e.g. "202301012345 (1234567-A)"
    addressLines: string[];
}

export interface PayslipPdfEmployee {
    fullName: string;
    employeeNo: string;
    icNo?: string;
    position?: string;
    outlet?: string;
    bankName?: string;
    bankAccount?: string;
    epfNo?: string;
    socsoNo?: string;
    taxNo?: string;
}

export interface PayslipPdfInput {
    payslip: Payslip;
    company: PayslipPdfCompany;
    employee: PayslipPdfEmployee;
}

// Returns a raw PDF byte buffer; caller decides whether to save to Supabase
// Storage, stream to the browser, or write to disk.
export const renderPayslipPdf = async (input: PayslipPdfInput): Promise<Uint8Array> => {
    const { payslip, company, employee } = input;

    const doc = await PDFDocument.create();
    doc.setTitle(`Payslip ${employee.employeeNo} ${payslip.periodMonth}`);
    doc.setAuthor(company.name);
    doc.setCreator("Bentop HR");
    doc.setProducer("Bentop HR");

    const page = doc.addPage([595.28, 841.89]); // A4 portrait, in pt
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
            x,
            y: yy,
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

    const hr = (yy: number) => {
        page.drawLine({
            start: { x: marginX, y: yy },
            end: { x: rightX, y: yy },
            thickness: 0.5,
            color: lineGrey,
        });
    };

    // --- Header
    drawText(company.name, marginX, y, { size: 14, bold: true });
    y -= 14;
    drawText(company.registrationNo, marginX, y, { size: 8, color: grey });
    y -= 10;
    for (const line of company.addressLines) {
        drawText(line, marginX, y, { size: 8, color: grey });
        y -= 10;
    }

    drawRight("PAYSLIP", rightX, 800, { size: 14, bold: true });
    drawRight(formatPeriodMonth(payslip.periodMonth), rightX, 786, {
        size: 10,
        color: grey,
    });

    y -= 10;
    hr(y);
    y -= 16;

    // --- Employee block (two columns)
    const col1X = marginX;
    const col2X = 310;

    const employeePairs: Array<[string, string | undefined]> = [
        ["Name", employee.fullName],
        ["Employee No", employee.employeeNo],
        ["IC No", employee.icNo],
        ["Position", employee.position],
        ["Outlet", employee.outlet],
    ];
    const idPairs: Array<[string, string | undefined]> = [
        ["Bank", employee.bankName],
        ["Bank A/C", employee.bankAccount],
        ["EPF No", employee.epfNo],
        ["SOCSO No", employee.socsoNo],
        ["Income Tax No", employee.taxNo],
    ];

    const rows = Math.max(employeePairs.length, idPairs.length);
    for (let i = 0; i < rows; i++) {
        const left = employeePairs[i];
        const right = idPairs[i];
        if (left && left[1]) {
            drawText(left[0], col1X, y, { color: grey });
            drawText(left[1], col1X + 70, y, { bold: true });
        }
        if (right && right[1]) {
            drawText(right[0], col2X, y, { color: grey });
            drawText(right[1], col2X + 70, y, { bold: true });
        }
        y -= 12;
    }

    y -= 6;
    hr(y);
    y -= 16;

    // --- Earnings + deductions, side by side
    const tableTop = y;
    const leftTableX = marginX;
    const leftTableRight = marginX + 250;
    const rightTableX = 310;
    const rightTableRight = rightX;

    drawText("EARNINGS", leftTableX, y, { bold: true });
    drawRight("Amount", leftTableRight, y, { bold: true });
    drawText("DEDUCTIONS", rightTableX, y, { bold: true });
    drawRight("Amount", rightTableRight, y, { bold: true });
    y -= 4;
    page.drawLine({
        start: { x: leftTableX, y },
        end: { x: leftTableRight, y },
        thickness: 0.5,
        color: black,
    });
    page.drawLine({
        start: { x: rightTableX, y },
        end: { x: rightTableRight, y },
        thickness: 0.5,
        color: black,
    });
    y -= 12;

    const earnings: Array<[string, Sen]> = [
        ["Basic Salary", payslip.grossBasic],
        ["Allowances", payslip.grossAllowances],
        ["Overtime", payslip.grossOt],
        ["Commission", payslip.grossCommission],
        ["KPI Bonus", payslip.grossKpiBonus],
    ];
    const deductions: Array<[string, Sen]> = [
        ["EPF (Employee)", payslip.epfEmployee],
        ["SOCSO (Employee)", payslip.socsoEmployee],
        ["EIS (Employee)", payslip.eisEmployee],
        ["PCB (MTD)", payslip.pcb],
        ...payslip.otherDeductions.map(
            (d) => [d.label, d.amount] as [string, Sen],
        ),
    ];

    let leftY = y;
    let rightY = y;
    const rowStep = 12;

    for (const [label, sen] of earnings) {
        if (sen === 0) continue;
        drawText(label, leftTableX, leftY);
        drawRight(formatRm(sen), leftTableRight, leftY);
        leftY -= rowStep;
    }
    for (const [label, sen] of deductions) {
        if (sen === 0) continue;
        drawText(label, rightTableX, rightY);
        drawRight(formatRm(sen), rightTableRight, rightY);
        rightY -= rowStep;
    }

    const bottomY = Math.min(leftY, rightY) - 4;
    page.drawLine({
        start: { x: leftTableX, y: bottomY },
        end: { x: leftTableRight, y: bottomY },
        thickness: 0.5,
        color: black,
    });
    page.drawLine({
        start: { x: rightTableX, y: bottomY },
        end: { x: rightTableRight, y: bottomY },
        thickness: 0.5,
        color: black,
    });

    const totalDeductions = (payslip.grossTotal - payslip.netPay) as Sen;

    const totalsY = bottomY - 14;
    drawText("Gross Total", leftTableX, totalsY, { bold: true });
    drawRight(formatRm(payslip.grossTotal), leftTableRight, totalsY, { bold: true });
    drawText("Total Deductions", rightTableX, totalsY, { bold: true });
    drawRight(formatRm(totalDeductions), rightTableRight, totalsY, { bold: true });

    y = totalsY - 24;
    hr(y);
    y -= 16;

    // --- Net pay strip
    drawText("NET PAY", marginX, y, { size: 12, bold: true });
    drawRight(formatRm(payslip.netPay), rightX, y, { size: 14, bold: true });

    y -= 24;
    hr(y);
    y -= 14;

    // --- Employer contributions (informational)
    drawText("EMPLOYER CONTRIBUTIONS (for reference only)", marginX, y, {
        size: 8,
        color: grey,
        bold: true,
    });
    y -= 12;

    const employer: Array<[string, Sen]> = [
        ["EPF (Employer)", payslip.epfEmployer],
        ["SOCSO (Employer)", payslip.socsoEmployer],
        ["EIS (Employer)", payslip.eisEmployer],
    ];
    for (const [label, sen] of employer) {
        drawText(label, marginX, y, { size: 8, color: grey });
        drawRight(formatRm(sen), marginX + 200, y, { size: 8, color: grey });
        y -= 10;
    }

    // --- Footer
    const footerY = 40;
    drawText(
        "This payslip is computer-generated and valid without a signature.",
        marginX,
        footerY,
        { size: 7, color: grey },
    );
    drawRight(`Run ID: ${payslip.payrollRunId}`, rightX, footerY, {
        size: 7,
        color: grey,
    });

    // Suppress unused-var notice for tableTop (documents the layout anchor).
    void tableTop;

    return doc.save();
};
