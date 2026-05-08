import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { consignmentShipmentCreateSchema } from "@/lib/validators/consignment";
import {
  buildActiveShipmentPartnerArgs,
  buildShipmentPartnerCreateFields,
  getPartnerLocationValidationError,
} from "./route";

describe("consignment shipment route helpers", () => {
  it("accepts a partner id without a manual partner name", () => {
    const parsed = consignmentShipmentCreateSchema.safeParse({
      fromLocationId: "warehouse-1",
      toLocationId: "consignee-1",
      partnerId: "partner-1",
      commissionRate: 18,
      ship: false,
      items: [
        {
          productVariantId: "variant-1",
          quantityShipped: 2,
          unitPrice: 49.9,
        },
      ],
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.partnerId, "partner-1");
      assert.equal(parsed.data.partnerName, undefined);
    }
  });

  it("still requires a manual partner name when no partner id is selected", () => {
    const parsed = consignmentShipmentCreateSchema.safeParse({
      fromLocationId: "warehouse-1",
      toLocationId: "consignee-1",
      commissionRate: 18,
      ship: false,
      items: [
        {
          productVariantId: "variant-1",
          quantityShipped: 2,
          unitPrice: 49.9,
        },
      ],
    });

    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.deepEqual(parsed.error.flatten().fieldErrors.partnerName, [
        "Partner name is required",
      ]);
    }
  });

  it("loads only an active partner with active tiers ordered by sort order", () => {
    assert.deepEqual(buildActiveShipmentPartnerArgs("partner-1"), {
      where: { id: "partner-1", isActive: true },
      include: {
        commissionTiers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  });

  it("uses the selected partner identity for shipment create fields", () => {
    assert.deepEqual(
      buildShipmentPartnerCreateFields(
        {
          partnerId: "partner-1",
          partnerName: "Typed Name",
        },
        {
          id: "partner-1",
          name: "KLCC Pop-up",
          locationId: "consignee-1",
        },
      ),
      {
        partnerId: "partner-1",
        partnerName: "KLCC Pop-up",
      },
    );
  });

  it("rejects a selected partner tied to a different consignee location", () => {
    assert.deepEqual(
      getPartnerLocationValidationError("consignee-2", {
        id: "partner-1",
        name: "KLCC Pop-up",
        locationId: "consignee-1",
      }),
      {
        code: "VALIDATION_ERROR",
        message: "Selected partner must match the consignee location",
      },
    );
  });

  it("allows selected partners without a configured location", () => {
    assert.equal(
      getPartnerLocationValidationError("consignee-2", {
        id: "partner-1",
        name: "KLCC Pop-up",
        locationId: null,
      }),
      null,
    );
  });

  it("keeps manual partner names for legacy shipments", () => {
    assert.deepEqual(
      buildShipmentPartnerCreateFields({
        partnerId: null,
        partnerName: "Boutique Seremban",
      }),
      {
        partnerId: null,
        partnerName: "Boutique Seremban",
      },
    );
  });
});
