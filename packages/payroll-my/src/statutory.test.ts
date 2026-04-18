import { describe, expect, it } from "vitest";
import { toSen } from "@bentop/domain";
import { computeEpf } from "./epf.js";
import { computeSocso } from "./socso.js";
import { computeEis } from "./eis.js";

// SCAFFOLD TESTS. These lock in the current simplified implementations so
// regressions are caught. Before production use, replace with golden-file tests
// sourced from LHDN / KWSP / PERKESO published examples.
describe("EPF (KWSP)", () => {
    it("RM 3,000 wage, under 60 → employee 11%, employer 13%", () => {
        const { employeeSen, employerSen } = computeEpf({
            wageSen: toSen(3000),
            ageYears: 30,
        });
        expect(employeeSen).toBe(toSen(330));
        expect(employerSen).toBe(toSen(390));
    });

    it("RM 6,000 wage, under 60 → employer drops to 12%", () => {
        const { employeeSen, employerSen } = computeEpf({
            wageSen: toSen(6000),
            ageYears: 30,
        });
        expect(employeeSen).toBe(toSen(660));
        expect(employerSen).toBe(toSen(720));
    });

    it("senior employee (age 60) halves rates", () => {
        const { employeeSen, employerSen } = computeEpf({
            wageSen: toSen(3000),
            ageYears: 61,
        });
        expect(employeeSen).toBe(toSen(165));
        expect(employerSen).toBe(toSen(195));
    });
});

describe("EIS (SIP)", () => {
    it("0.2% each side capped at RM 5,000", () => {
        const { employeeSen, employerSen } = computeEis({ wageSen: toSen(4000) });
        expect(employeeSen).toBe(toSen(8));
        expect(employerSen).toBe(toSen(8));
    });

    it("caps at RM 5,000 even if wage is higher", () => {
        const { employeeSen, employerSen } = computeEis({ wageSen: toSen(8000) });
        expect(employeeSen).toBe(toSen(10));
        expect(employerSen).toBe(toSen(10));
    });
});

describe("SOCSO", () => {
    it("picks the correct band", () => {
        const { employeeSen, employerSen } = computeSocso({ wageSen: toSen(4000) });
        expect(employeeSen).toBeGreaterThan(0);
        expect(employerSen).toBeGreaterThan(employeeSen);
    });
});
