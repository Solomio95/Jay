import { describe, expect, it } from "vitest";
import { toSen } from "@bentop/domain";
import { formatPeriodMonth, formatRm } from "./format.js";

describe("formatRm", () => {
    it("formats with thousands separator and two decimals", () => {
        expect(formatRm(toSen(1234.5))).toBe("RM 1,234.50");
        expect(formatRm(toSen(0))).toBe("RM 0.00");
        expect(formatRm(toSen(12))).toBe("RM 12.00");
        expect(formatRm(toSen(1000000))).toBe("RM 1,000,000.00");
    });

    it("keeps the negative sign", () => {
        expect(formatRm(toSen(-50.25))).toBe("-RM 50.25");
    });
});

describe("formatPeriodMonth", () => {
    it("renders ISO first-of-month as 'Month YYYY'", () => {
        expect(formatPeriodMonth("2026-04-01")).toBe("April 2026");
        expect(formatPeriodMonth("2025-01-01")).toBe("January 2025");
        expect(formatPeriodMonth("2024-12-01")).toBe("December 2024");
    });
});
