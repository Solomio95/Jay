import { describe, expect, it } from "vitest";
import { buildMaybankBulkFile, type BankFilePayee } from "./bankFile.js";

const payee = (p: Partial<BankFilePayee>): BankFilePayee => ({
    employeeNo: "E001",
    fullName: "Aishah binti Ahmad",
    icNo: "890101105566",
    bankName: "Maybank",
    bankAccount: "1234567890",
    bankCode: "MBB",
    netPay: 2500,
    email: "aishah@bentop.my",
    ...p,
});

describe("buildMaybankBulkFile", () => {
    it("writes a header, one detail row per valid payee, and a trailer with totals", () => {
        const { text, totalAmountSen, totalCount } = buildMaybankBulkFile({
            orgAccount: "5141234567890",
            payDate: "2026-04-28",
            reference: "PAYROLL APR26",
            payees: [payee({}), payee({ employeeNo: "E002", netPay: 3000 })],
        });
        const rows = text.trim().split("\r\n");
        expect(rows).toHaveLength(4);
        expect(rows[0]).toMatch(/^H\t5141234567890\t20260428\t2\t550000\tPAYROLL APR26$/);
        expect(rows[1]).toContain("Aishah binti Ahmad");
        expect(rows[1]).toContain("250000");
        expect(rows[3]).toBe("T\t2\t550000");
        expect(totalAmountSen).toBe(550_000);
        expect(totalCount).toBe(2);
    });

    it("skips payees with zero or missing bank details", () => {
        const { skipped, totalCount } = buildMaybankBulkFile({
            orgAccount: "X",
            payDate: "2026-04-28",
            reference: "R",
            payees: [
                payee({ employeeNo: "E1", netPay: 0 }),
                payee({ employeeNo: "E2", bankAccount: null }),
                payee({ employeeNo: "E3" }),
            ],
        });
        expect(totalCount).toBe(1);
        expect(skipped).toEqual([
            { employeeNo: "E1", reason: "zero_net_pay" },
            { employeeNo: "E2", reason: "missing_bank_details" },
        ]);
    });

    it("rounds ringgit to sen deterministically", () => {
        const { totalAmountSen } = buildMaybankBulkFile({
            orgAccount: "X",
            payDate: "2026-04-28",
            reference: "R",
            payees: [payee({ netPay: 1234.565 }), payee({ employeeNo: "E2", netPay: 0.015 })],
        });
        // 1234.565 → 123457 sen (banker's? no — Math.round uses half-away),
        // 0.015 → 2 sen (JS round of 1.5). Total 123459.
        expect(totalAmountSen).toBe(123_459);
    });

    it("strips tabs and newlines from freeform fields to keep the file well-formed", () => {
        const { text } = buildMaybankBulkFile({
            orgAccount: "X",
            payDate: "2026-04-28",
            reference: "R",
            payees: [payee({ fullName: "Ah\tMing\nLim" })],
        });
        const detail = text.split("\r\n")[1]!;
        expect(detail).not.toContain("\n");
        expect(detail.split("\t")[1]).toBe("Ah Ming Lim");
    });
});
