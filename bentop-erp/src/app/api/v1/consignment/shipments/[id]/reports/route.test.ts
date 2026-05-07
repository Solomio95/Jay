import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildActivePartnerCommissionArgs,
  buildReportLineCreateData,
  canCreateConsignmentReport,
  findApplicableOverride,
  getReportLineQuantityValidationError,
} from "./route";
import { consignmentReportCreateSchema } from "@/lib/validators/consignment";

describe("consignment shipment report route helpers", () => {
  it("allows only consignment managers to create reports", () => {
    assert.equal(canCreateConsignmentReport("ADMIN"), true);
    assert.equal(canCreateConsignmentReport("MANAGER"), true);
    assert.equal(canCreateConsignmentReport("STAFF"), false);
    assert.equal(canCreateConsignmentReport("SUPERVISOR"), false);
    assert.equal(canCreateConsignmentReport("PROMOTER"), false);
    assert.equal(canCreateConsignmentReport("VIEWER"), false);
    assert.equal(canCreateConsignmentReport(undefined), false);
  });

  it("loads active partner tiers and date-active overrides", () => {
    const now = new Date("2026-05-03T00:00:00.000Z");

    assert.deepEqual(buildActivePartnerCommissionArgs("partner-1", now), {
      where: { id: "partner-1", isActive: true },
      include: {
        commissionTiers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        overrides: {
          where: {
            isActive: true,
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
          },
        },
      },
    });
  });

  it("uses variant commission override before product override", () => {
    const override = findApplicableOverride(
      "variant-1",
      "product-1",
      [
        {
          productId: "product-1",
          productVariantId: null,
          tierName: "Product Promo",
          commissionRate: 18,
        },
        {
          productId: null,
          productVariantId: "variant-1",
          tierName: "Variant Promo",
          commissionRate: 12,
        },
      ],
    );

    assert.deepEqual(override, {
      tierName: "Variant Promo",
      commissionRate: 12,
    });
  });

  it("rejects report quantities beyond remaining shipment quantity", () => {
    assert.deepEqual(
      getReportLineQuantityValidationError(
        {
          id: "item-1",
          quantityShipped: 10,
          quantitySold: 4,
          quantityReturned: 1,
        },
        {
          shipmentItemId: "item-1",
          quantitySold: 4,
          quantityReturned: 2,
          actualUnitPrice: 50,
        },
      ),
      {
        code: "VALIDATION_ERROR",
        message: "Cannot report 6 units; only 5 remaining for this item",
      },
    );
  });

  it("rejects report lines without sold or returned quantity", () => {
    const result = consignmentReportCreateSchema.safeParse({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-03",
      lines: [
        {
          shipmentItemId: "item-1",
          quantitySold: 0,
          quantityReturned: 0,
          actualUnitPrice: 50,
        },
      ],
    });

    assert.equal(result.success, false);
  });

  it("builds report line monetary snapshots from commission rules", () => {
    const line = buildReportLineCreateData({
      reportId: "report-1",
      shipmentId: "shipment-1",
      shipmentItemId: "item-1",
      productVariantId: "variant-1",
      productId: "product-1",
      quantitySold: 3,
      quantityReturned: 1,
      actualUnitPrice: 50,
      tiers: [
        {
          name: "Best Buy",
          minPrice: 0,
          maxPrice: null,
          commissionRate: 25,
        },
      ],
      overrides: [],
    });

    assert.equal(line.grossAmount.toString(), "150");
    assert.equal(line.commissionAmount.toString(), "37.5");
    assert.equal(line.netAmount.toString(), "112.5");
    assert.equal(line.commissionTierName, "Best Buy");
    assert.equal(line.commissionRate.toString(), "25");
  });
});
