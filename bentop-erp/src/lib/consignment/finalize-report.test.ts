import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConsignmentInvoiceCreateData,
  canFinalizeConsignmentReport,
  getFinalizedShipmentStatus,
  getInsufficientConsigneeStockError,
  getInvoiceDueDate,
  isActiveReportShipmentStatus,
} from "./finalize-report";

describe("consignment report finalization helpers", () => {
  it("allows only admin and manager roles to finalize reports", () => {
    assert.equal(canFinalizeConsignmentReport("ADMIN"), true);
    assert.equal(canFinalizeConsignmentReport("MANAGER"), true);
    assert.equal(canFinalizeConsignmentReport("VIEWER"), false);
    assert.equal(canFinalizeConsignmentReport(undefined), false);
  });

  it("treats only shipped and partially settled shipments as active for reports", () => {
    assert.equal(isActiveReportShipmentStatus("SHIPPED"), true);
    assert.equal(isActiveReportShipmentStatus("PARTIAL_SETTLED"), true);
    assert.equal(isActiveReportShipmentStatus("DRAFT"), false);
    assert.equal(isActiveReportShipmentStatus("SETTLED"), false);
    assert.equal(isActiveReportShipmentStatus("CANCELLED"), false);
  });

  it("sets shipment status to settled only when every item is accounted for", () => {
    assert.equal(
      getFinalizedShipmentStatus([
        { quantityShipped: 3, quantitySold: 2, quantityReturned: 1 },
        { quantityShipped: 2, quantitySold: 2, quantityReturned: 0 },
      ]),
      "SETTLED",
    );

    assert.equal(
      getFinalizedShipmentStatus([
        { quantityShipped: 3, quantitySold: 1, quantityReturned: 1 },
      ]),
      "PARTIAL_SETTLED",
    );
  });

  it("calculates invoice due date from payment terms", () => {
    assert.equal(
      getInvoiceDueDate(new Date("2026-05-03T00:00:00.000Z"), 14)?.toISOString(),
      "2026-05-17T00:00:00.000Z",
    );
    assert.equal(getInvoiceDueDate(new Date("2026-05-03T00:00:00.000Z"), null), null);
  });

  it("builds a clear domain error for insufficient consignee stock", () => {
    const error = getInsufficientConsigneeStockError({
      requested: 5,
      remaining: 2,
      sku: "BT-RED-S",
    });

    assert.equal(error.code, "INSUFFICIENT_STOCK");
    assert.equal(error.status, 409);
    assert.match(error.message, /Only 3 units are available/);
    assert.match(error.message, /BT-RED-S/);
  });

  it("builds invoice create data from report, partner, and report line snapshots", () => {
    const data = buildConsignmentInvoiceCreateData({
      invoiceNumber: "CI-20260503-0001",
      invoiceDate: new Date("2026-05-03T00:00:00.000Z"),
      report: {
        id: "report-1",
        reportNumber: "CR-20260503-0001",
        partnerId: "partner-1",
        shipmentId: "shipment-1",
        grossAmount: "150",
        commissionAmount: "37.5",
        netAmount: "112.5",
        shipment: {
          shipmentNumber: "CN-20260503-0001",
          fromLocationId: "warehouse-1",
          toLocationId: "consignee-1",
          status: "SHIPPED",
          settledAt: null,
          toLocation: {
            address: "Lot 1, KL",
          },
        },
        partner: {
          name: "KLCC Pop-up",
          contactPerson: "Amira",
          contactEmail: "amira@example.com",
          contactPhone: "+60120000000",
          paymentTermsDays: 14,
        },
        lines: [
          {
            id: "line-1",
            shipmentItemId: "item-1",
            quantitySold: 3,
            quantityReturned: 0,
            actualUnitPrice: "50",
            commissionTierName: "Best Buy",
            commissionRate: "25",
            grossAmount: "150",
            commissionAmount: "37.5",
            netAmount: "112.5",
            shipmentItem: {
              productVariantId: "variant-1",
              batchId: null,
              productVariant: {
                sku: "BT-RED-S",
                color: "Red",
                size: "S",
                product: {
                  name: "Blouse",
                },
              },
            },
          },
        ],
      },
    });

    assert.equal(data.invoiceNumber, "CI-20260503-0001");
    assert.equal(data.dueDate?.toISOString(), "2026-05-17T00:00:00.000Z");
    assert.deepEqual(data.billToAddress, { address: "Lot 1, KL" });
    assert.equal(data.lines.create[0].description, "Blouse - Red / S");
    assert.equal(data.lines.create[0].sku, "BT-RED-S");
    assert.equal(data.lines.create[0].netAmount.toString(), "112.5");
  });
});
