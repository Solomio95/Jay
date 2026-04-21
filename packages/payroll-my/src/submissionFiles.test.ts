import { describe, expect, it } from "vitest";
import {
    buildKwspFormA,
    buildLhdnCp39,
    buildPerkesoAssist,
    type StatutoryEmployee,
    type StatutoryRunInput,
} from "./submissionFiles.js";

const emp = (p: Partial<StatutoryEmployee>): StatutoryEmployee => ({
    employeeNo: "E001",
    fullName: "Aishah binti Ahmad",
    icNo: "890101105566",
    taxNo: "SG12345678",
    epfNo: "EPF001",
    socsoNo: "SOC001",
    epfEmployee: 132,
    epfEmployer: 236,
    socsoEmployee: 13.25,
    socsoEmployer: 46.35,
    eisEmployee: 3.5,
    eisEmployer: 3.5,
    pcb: 45.5,
    ...p,
});

const input = (employees: StatutoryEmployee[]): StatutoryRunInput => ({
    periodMonth: "2026-04-01",
    payDate: "2026-04-28",
    employer: {
        name: "Bentop Sdn Bhd",
        epfEmployerNo: "E12345678",
        socsoEmployerCode: "C987654321",
        lhdnEmployerNo: "E9876543210",
    },
    employees,
});

describe("buildKwspFormA", () => {
    it("emits header, one detail row per contributing employee, and a balanced trailer", () => {
        const out = buildKwspFormA(input([emp({}), emp({ employeeNo: "E002", epfEmployee: 100, epfEmployer: 180 })]));
        const rows = out.text.trim().split("\r\n");
        expect(rows).toHaveLength(4);
        expect(rows[0]).toMatch(/^H\|E12345678\|202604\|2\|/);
        expect(rows[3]).toMatch(/^T\|2\|/);
        expect(out.totalCount).toBe(2);
        // 132+236 + 100+180 = 648 RM = 64800 sen
        expect(out.totalAmountSen).toBe(64_800);
    });

    it("skips employees with zero EPF both sides", () => {
        const out = buildKwspFormA(input([emp({ epfEmployee: 0, epfEmployer: 0 })]));
        const rows = out.text.trim().split("\r\n");
        expect(rows).toHaveLength(2); // header + trailer only
        expect(out.totalCount).toBe(0);
    });
});

describe("buildPerkesoAssist", () => {
    it("emits CSV with header and one row per employee with any PERKESO amount", () => {
        const out = buildPerkesoAssist(input([emp({}), emp({ employeeNo: "E002", socsoEmployee: 0, socsoEmployer: 0, eisEmployee: 0, eisEmployer: 0 })]));
        const rows = out.text.trim().split("\r\n");
        expect(rows[0]).toContain("employer_code");
        expect(rows).toHaveLength(2); // header + 1 contributor, E002 skipped
        expect(rows[1]).toContain("C987654321");
        expect(rows[1]).toContain("13.25");
        expect(rows[1]).toContain("46.35");
    });
});

describe("buildLhdnCp39", () => {
    it("emits header+rows+trailer and skips zero-PCB employees", () => {
        const out = buildLhdnCp39(input([emp({}), emp({ employeeNo: "E002", pcb: 0 })]));
        const rows = out.text.trim().split("\r\n");
        expect(rows).toHaveLength(3); // 1 detail
        expect(rows[0]).toMatch(/^H\|E9876543210\|202604\|20260428\|1\|4550$/);
        expect(rows[1]).toContain("|4550|0");
        expect(rows[2]).toBe("T|1|4550");
        expect(out.totalAmountSen).toBe(4_550);
    });
});
