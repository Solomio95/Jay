import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import {
  buildPartnerListArgs,
  buildPartnerWriteData,
  canMutateConsignmentPartners,
  createPartnerWithAudit,
} from "./route";

describe("consignment partner collection route helpers", () => {
  it("allows only admin and manager roles to mutate partners", () => {
    assert.equal(canMutateConsignmentPartners("ADMIN"), true);
    assert.equal(canMutateConsignmentPartners("MANAGER"), true);
    assert.equal(canMutateConsignmentPartners("VIEWER"), false);
    assert.equal(canMutateConsignmentPartners("STAFF"), false);
  });

  it("queries active partners with active tiers ordered by sort order and active overrides", () => {
    assert.deepEqual(buildPartnerListArgs(), {
      where: { isActive: true },
      include: {
        location: true,
        commissionTiers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        overrides: {
          where: { isActive: true },
        },
      },
      orderBy: { name: "asc" },
    });
  });

  it("builds nested create data from schema fields only", () => {
    const data = buildPartnerWriteData({
      name: "KLCC Pop-up",
      contactPerson: "Amira",
      contactPhone: "+60120000000",
      contactEmail: "amira@example.com",
      locationId: "location-1",
      paymentTermsDays: 30,
      tiers: [
        {
          name: "Entry",
          minPrice: 0,
          maxPrice: 49.99,
          commissionRate: 18,
          sortOrder: 1,
        },
      ],
      overrides: [
        {
          productId: "product-1",
          productVariantId: null,
          tierName: "Promo",
          commissionRate: 12.5,
          notes: "Launch promo",
        },
      ],
    } as never);

    assert.equal(data.name, "KLCC Pop-up");
    assert.equal("code" in data, false);
    assert.equal(data.commissionTiers.create[0].minPrice.toString(), "0");
    assert.equal(data.commissionTiers.create[0].maxPrice?.toString(), "49.99");
    assert.equal(data.commissionTiers.create[0].commissionRate.toString(), "18");
    assert.equal(data.overrides.create[0].notes, "Launch promo");
    assert.equal("reason" in data.overrides.create[0], false);
  });

  it("creates an audit log in the same operation when creating a partner", async () => {
    const input = {
      name: "KLCC Pop-up",
      contactPerson: null,
      contactPhone: null,
      contactEmail: null,
      locationId: null,
      paymentTermsDays: 30,
      tiers: [
        {
          name: "Entry",
          minPrice: 0,
          maxPrice: null,
          commissionRate: 18,
          sortOrder: 1,
        },
      ],
      overrides: [
        {
          productId: "product-1",
          tierName: "Promo",
          commissionRate: 12.5,
          notes: "Launch promo",
        },
      ],
    } as never;
    const tx = {
      consignmentPartner: {
        create: mock.fn(async () => ({ id: "partner-1", name: "KLCC Pop-up" })),
      },
      auditLog: {
        create: mock.fn(async () => ({ id: "audit-1" })),
      },
    };

    await createPartnerWithAudit(tx as never, input, "user-1");

    assert.equal(tx.consignmentPartner.create.mock.callCount(), 1);
    assert.equal(tx.auditLog.create.mock.callCount(), 1);
    const auditCall = tx.auditLog.create.mock.calls[0] as unknown as {
      arguments: [unknown];
    };
    assert.deepEqual(auditCall.arguments[0], {
      data: {
        userId: "user-1",
        action: "CONSIGNMENT_PARTNER_CREATED",
        entityType: "ConsignmentPartner",
        entityId: "partner-1",
        newValue: {
          name: "KLCC Pop-up",
          tierCount: 1,
          overrideCount: 1,
        },
      },
    });
  });
});
