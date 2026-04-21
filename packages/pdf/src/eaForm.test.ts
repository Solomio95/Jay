import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderEaFormPdf, type EaFormPdfInput } from "./eaForm.js";

const sample = (): EaFormPdfInput => ({
    year: 2026,
    employee: {
        employeeNo: "BP-00042",
        fullName: "Aishah binti Rahman",
        icNo: "940812-14-5678",
        taxNo: "SG 12345678",
        epfNo: "12345678",
        socsoNo: "SA12345678",
        position: "Promoter",
        hiredOn: "2022-03-01",
        terminatedOn: null,
    },
    employer: {
        name: "Bentop Sdn Bhd",
        employerE: "E 1234567890",
        address: ["Lot 12, Jalan Kilang 3", "47500 Subang Jaya, Selangor"],
    },
    months: 12,
    income: {
        b1_salary_and_leave: 39_600,
        b2_commissions_bonuses: 6_000,
        b3_perquisites: 0,
        b5_bik: 0,
        gross_total: 45_600,
    },
    deductions: { d1_pcb: 180, d2_zakat: 0 },
    contributions: { e1_epf_employee: 3_600 },
    socso: { f1_socso_employee: 96, f2_eis_employee: 24 },
});

describe("renderEaFormPdf", () => {
    it("produces a single-page PDF tagged with the employee and year", async () => {
        const bytes = await renderEaFormPdf(sample());
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(1000);

        const parsed = await PDFDocument.load(bytes);
        expect(parsed.getPageCount()).toBe(1);
        expect(parsed.getTitle()).toBe("Form EA 2026 — BP-00042");
        expect(parsed.getAuthor()).toBe("Bentop Sdn Bhd");
    });

    it("renders when the employee has been terminated mid-year", async () => {
        const input = sample();
        input.employee.terminatedOn = "2026-09-15";
        input.months = 9;
        const bytes = await renderEaFormPdf(input);
        expect(bytes.length).toBeGreaterThan(1000);
    });

    it("tolerates missing optional identifiers", async () => {
        const input = sample();
        input.employee.taxNo = null;
        input.employee.epfNo = null;
        input.employee.socsoNo = null;
        input.employee.position = null;
        input.employee.hiredOn = null;
        const bytes = await renderEaFormPdf(input);
        const parsed = await PDFDocument.load(bytes);
        expect(parsed.getPageCount()).toBe(1);
    });
});
