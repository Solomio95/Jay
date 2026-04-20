import { describe, expect, it } from "vitest";
import {
    decideSaleAction,
    extractBaseExternalId,
    type ErpSaleInput,
    type ExistingSaleRow,
} from "./decide.js";

const sale = (overrides: Partial<ErpSaleInput> = {}): ErpSaleInput => ({
    baseExternalId: "erp-1",
    counterId: "c-1",
    employeeId: "e-1",
    saleDate: "2026-04-10",
    grossAmount: 324,
    returnsAmount: 0,
    currency: "MYR",
    erpVersion: 1,
    erpLastModifiedAt: "2026-04-10T10:00:00Z",
    ...overrides,
});

const existing = (
    overrides: Partial<ExistingSaleRow> & { id: string; erpVersion: number },
): ExistingSaleRow => ({
    externalId: "erp-1",
    supersededBy: null,
    ...overrides,
});

describe("decideSaleAction", () => {
    it("inserts fresh when no rows exist for the base id", () => {
        const action = decideSaleAction([], sale());
        expect(action.kind).toBe("insert");
        if (action.kind === "insert") {
            expect(action.row.externalId).toBe("erp-1");
            expect(action.row.erpVersion).toBe(1);
        }
    });

    it("skips replays of the same version", () => {
        const rows = [existing({ id: "r1", erpVersion: 1 })];
        const action = decideSaleAction(rows, sale());
        expect(action).toEqual({ kind: "skip", reason: "duplicate_version" });
    });

    it("amends and supersedes when a higher version arrives", () => {
        const rows = [existing({ id: "r1", erpVersion: 1 })];
        const action = decideSaleAction(rows, sale({ erpVersion: 2 }));
        expect(action.kind).toBe("amend");
        if (action.kind === "amend") {
            expect(action.supersedesId).toBe("r1");
            expect(action.row.externalId).toBe("erp-1#v2");
            expect(action.row.erpVersion).toBe(2);
        }
    });

    it("replay of an amendment is a no-op (duplicate_version)", () => {
        const rows = [
            existing({ id: "r1", erpVersion: 1, supersededBy: "r2" }),
            existing({ id: "r2", erpVersion: 2, externalId: "erp-1#v2" }),
        ];
        const action = decideSaleAction(rows, sale({ erpVersion: 2 }));
        expect(action).toEqual({ kind: "skip", reason: "duplicate_version" });
    });

    it("ignores older amendments that arrive out of order", () => {
        const rows = [
            existing({ id: "r1", erpVersion: 1, supersededBy: "r2" }),
            existing({ id: "r2", erpVersion: 2, externalId: "erp-1#v2" }),
        ];
        const action = decideSaleAction(rows, sale({ erpVersion: 1 }));
        // v1 is already present → skip, not insert as "older_version".
        expect(action.kind).toBe("skip");
    });

    it("supersedes the live row (non-superseded), not the original", () => {
        const rows = [
            existing({ id: "r1", erpVersion: 1, supersededBy: "r2" }),
            existing({ id: "r2", erpVersion: 2, externalId: "erp-1#v2" }),
        ];
        const action = decideSaleAction(rows, sale({ erpVersion: 3 }));
        expect(action.kind).toBe("amend");
        if (action.kind === "amend") {
            expect(action.supersedesId).toBe("r2");
            expect(action.row.externalId).toBe("erp-1#v3");
        }
    });
});

describe("extractBaseExternalId", () => {
    it("returns the id unchanged when there is no version suffix", () => {
        expect(extractBaseExternalId("erp-1")).toBe("erp-1");
    });
    it("strips the #v suffix", () => {
        expect(extractBaseExternalId("erp-1#v2")).toBe("erp-1");
        expect(extractBaseExternalId("abc-xyz#v99")).toBe("abc-xyz");
    });
});
