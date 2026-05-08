import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import {
  buildPartnerDetailArgs,
  buildPartnerSetupInactivationArgs,
  buildPartnerUpdateData,
  updatePartnerWithAudit,
} from "./route";

describe("consignment partner detail route helpers", () => {
  it("loads a partner with active tiers and overrides including product display info", () => {
    assert.deepEqual(buildPartnerDetailArgs("partner-1"), {
      where: { id: "partner-1" },
      include: {
        location: true,
        commissionTiers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        overrides: {
          where: { isActive: true },
          include: {
            product: { select: { id: true, name: true, skuPrefix: true } },
            productVariant: {
              select: {
                id: true,
                sku: true,
                size: true,
                color: true,
                colorHex: true,
                product: { select: { id: true, name: true, skuPrefix: true } },
              },
            },
          },
        },
      },
    });
  });

  it("soft-inactivates existing setup rows before recreating them", () => {
    assert.deepEqual(buildPartnerSetupInactivationArgs("partner-1"), {
      tiers: {
        where: { partnerId: "partner-1", isActive: true },
        data: { isActive: false },
      },
      overrides: {
        where: { partnerId: "partner-1", isActive: true },
        data: { isActive: false },
      },
    });
  });

  it("builds update data with recreated tiers and notes-based overrides", () => {
    const data = buildPartnerUpdateData({
      name: "New Partner",
      contactPerson: null,
      contactPhone: null,
      contactEmail: null,
      locationId: null,
      paymentTermsDays: 14,
      tiers: [
        {
          name: "Standard",
          minPrice: 0,
          maxPrice: null,
          commissionRate: 20,
          sortOrder: 1,
        },
      ],
      overrides: [
        {
          productVariantId: "variant-1",
          tierName: "Variant Promo",
          commissionRate: 10,
          notes: "Temporary",
        },
      ],
    } as never);

    assert.equal(data.paymentTermsDays, 14);
    assert.equal(data.commissionTiers.create[0].maxPrice, null);
    assert.equal(data.overrides.create[0].productVariantId, "variant-1");
    assert.equal(data.overrides.create[0].notes, "Temporary");
  });

  it("creates an audit log in the same operation when updating a partner", async () => {
    const input = {
      name: "New Partner",
      contactPerson: null,
      contactPhone: null,
      contactEmail: null,
      locationId: null,
      paymentTermsDays: 14,
      tiers: [
        {
          name: "Standard",
          minPrice: 0,
          maxPrice: null,
          commissionRate: 20,
          sortOrder: 1,
        },
      ],
      overrides: [
        {
          productVariantId: "variant-1",
          tierName: "Variant Promo",
          commissionRate: 10,
          notes: "Temporary",
        },
      ],
    } as never;
    const tx = {
      consignmentCommissionTier: {
        updateMany: mock.fn(async () => ({ count: 1 })),
      },
      consignmentCommissionOverride: {
        updateMany: mock.fn(async () => ({ count: 1 })),
      },
      consignmentPartner: {
        update: mock.fn(async () => ({ id: "partner-1", name: "New Partner" })),
      },
      auditLog: {
        create: mock.fn(async () => ({ id: "audit-1" })),
      },
    };

    await updatePartnerWithAudit(tx as never, "partner-1", input, "user-1");

    assert.equal(tx.consignmentPartner.update.mock.callCount(), 1);
    assert.equal(tx.auditLog.create.mock.callCount(), 1);
    const auditCall = tx.auditLog.create.mock.calls[0] as unknown as {
      arguments: [unknown];
    };
    assert.deepEqual(auditCall.arguments[0], {
      data: {
        userId: "user-1",
        action: "CONSIGNMENT_PARTNER_UPDATED",
        entityType: "ConsignmentPartner",
        entityId: "partner-1",
        newValue: {
          name: "New Partner",
          tierCount: 1,
          overrideCount: 1,
        },
      },
    });
  });
});
