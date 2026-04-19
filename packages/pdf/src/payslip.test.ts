import { describe, expect, it } from "vitest";
import { type Payslip, toSen } from "@bentop/domain";
import { PDFDocument } from "pdf-lib";
import { renderPayslipPdf } from "./payslip.js";

const sample = (): Payslip => ({
    employeeId: "emp_001",
    payrollRunId: "run_2026_04",
    periodMonth: "2026-04-01",
    grossBasic: toSen(3200),
    grossAllowances: toSen(200),
    grossCommission: toSen(450),
    grossOt: toSen(0),
    grossKpiBonus: toSen(150),
    grossTotal: toSen(4000),
    epfEmployee: toSen(440),
    epfEmployer: toSen(520),
    socsoEmployee: toSen(20),
    socsoEmployer: toSen(70),
    eisEmployee: toSen(8),
    eisEmployer: toSen(8),
    pcb: toSen(25),
    otherDeductions: [{ label: "Staff Advance", amount: toSen(100) }],
    netPay: toSen(3407),
});

const company = {
    name: "Bentop Sdn Bhd",
    registrationNo: "202301012345 (1234567-A)",
    addressLines: [
        "Lot 12, Jalan Kilang 3",
        "47500 Subang Jaya, Selangor",
        "Tel: +60 3-1234 5678",
    ],
};

const employee = {
    fullName: "Aishah binti Rahman",
    employeeNo: "BP-00042",
    icNo: "940812-14-5678",
    position: "Promoter",
    outlet: "Sogo KL",
    bankName: "Maybank",
    bankAccount: "5123 4567 8901",
    epfNo: "12345678",
    socsoNo: "SA12345678",
    taxNo: "SG 12345678",
};

describe("renderPayslipPdf", () => {
    it("produces a valid single-page PDF", async () => {
        const bytes = await renderPayslipPdf({
            payslip: sample(),
            company,
            employee,
        });

        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(1000);

        const parsed = await PDFDocument.load(bytes);
        expect(parsed.getPageCount()).toBe(1);
        expect(parsed.getTitle()).toBe("Payslip BP-00042 2026-04-01");
        expect(parsed.getAuthor()).toBe("Bentop Sdn Bhd");
    });

    it("handles a zero-deduction payslip without crashing", async () => {
        const p = sample();
        p.otherDeductions = [];
        p.pcb = toSen(0) as never as Payslip["pcb"];
        const bytes = await renderPayslipPdf({ payslip: p, company, employee });
        expect(bytes.length).toBeGreaterThan(1000);
    });

    it("renders a payslip with only required employee fields", async () => {
        const bytes = await renderPayslipPdf({
            payslip: sample(),
            company,
            employee: {
                fullName: "Test Employee",
                employeeNo: "BP-00001",
            },
        });
        const parsed = await PDFDocument.load(bytes);
        expect(parsed.getPageCount()).toBe(1);
    });
});
