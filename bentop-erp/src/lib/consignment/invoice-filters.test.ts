import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConsignmentInvoiceWhere, parseConsignmentInvoiceFilters } from "./invoice-filters";

describe("consignment invoice filters", () => {
  it("builds a register where clause from status, partner, date, due state, and search filters", () => {
    const filters = parseConsignmentInvoiceFilters({
      status: "ISSUED",
      partnerId: "partner-1",
      from: "2026-05-01",
      to: "2026-05-31",
      dueState: "overdue",
      search: "INV-001",
    });

    assert.deepEqual(filters, {
      status: "ISSUED",
      partnerId: "partner-1",
      from: "2026-05-01",
      to: "2026-05-31",
      dueState: "overdue",
      search: "INV-001",
    });

    const where = buildConsignmentInvoiceWhere(filters, new Date("2026-06-01T12:00:00.000Z"));

    assert.equal(where.status, "ISSUED");
    assert.equal(where.partnerId, "partner-1");
    assert.deepEqual(where.invoiceDate, {
      gte: new Date("2026-05-01T00:00:00.000"),
      lte: new Date("2026-05-31T23:59:59.999"),
    });
    assert.deepEqual(where.dueDate, { lt: new Date("2026-06-01T00:00:00.000") });
    assert.deepEqual(where.OR, [
      { invoiceNumber: { contains: "INV-001", mode: "insensitive" } },
      { billToName: { contains: "INV-001", mode: "insensitive" } },
      { partner: { name: { contains: "INV-001", mode: "insensitive" } } },
      { shipment: { shipmentNumber: { contains: "INV-001", mode: "insensitive" } } },
      { report: { reportNumber: { contains: "INV-001", mode: "insensitive" } } },
    ]);
  });

  it("ignores unknown enum values from query strings", () => {
    const filters = parseConsignmentInvoiceFilters({
      status: "UNKNOWN",
      dueState: "later",
      partnerId: "",
      search: "   ",
    });

    assert.deepEqual(filters, {});
  });
});
