import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPartnerSelectionState,
  buildProductShipmentSummary,
} from "./consignment-shipment-form-client";

describe("buildProductShipmentSummary", () => {
  it("aggregates shipment quantity and value by product name", () => {
    const summary = buildProductShipmentSummary([
      {
        variant: { productId: "product-1", productName: "Classic Tote" },
        quantity: 2,
        unitPrice: 49.9,
      },
      {
        variant: { productId: "product-1", productName: "Classic Tote" },
        quantity: 3,
        unitPrice: 55,
      },
      {
        variant: { productId: "product-2", productName: "Silk Scarf" },
        quantity: 1,
        unitPrice: 89,
      },
    ]);

    assert.deepEqual(summary, [
      {
        productId: "product-1",
        productName: "Classic Tote",
        quantity: 5,
        value: 264.8,
      },
      {
        productId: "product-2",
        productName: "Silk Scarf",
        quantity: 1,
        value: 89,
      },
    ]);
  });

  it("does not merge different products that share a display name", () => {
    const summary = buildProductShipmentSummary([
      {
        variant: { productId: "product-1", productName: "Classic Tote" },
        quantity: 2,
        unitPrice: 49.9,
      },
      {
        variant: { productId: "product-2", productName: "Classic Tote" },
        quantity: 3,
        unitPrice: 55,
      },
    ]);

    assert.deepEqual(summary, [
      {
        productId: "product-1",
        productName: "Classic Tote",
        quantity: 2,
        value: 99.8,
      },
      {
        productId: "product-2",
        productName: "Classic Tote",
        quantity: 3,
        value: 165,
      },
    ]);
  });
});

describe("buildPartnerSelectionState", () => {
  it("sets partner name and locks to the partner location when present", () => {
    assert.deepEqual(
      buildPartnerSelectionState(
        {
          id: "partner-1",
          name: "KLCC Pop-up",
          locationId: "consignee-1",
        },
        "consignee-2",
      ),
      {
        partnerId: "partner-1",
        partnerName: "KLCC Pop-up",
        toLocationId: "consignee-1",
        isConsigneeLocked: true,
      },
    );
  });

  it("keeps the current consignee editable when partner has no location", () => {
    assert.deepEqual(
      buildPartnerSelectionState(
        {
          id: "partner-1",
          name: "KLCC Pop-up",
          locationId: null,
        },
        "consignee-2",
      ),
      {
        partnerId: "partner-1",
        partnerName: "KLCC Pop-up",
        toLocationId: "consignee-2",
        isConsigneeLocked: false,
      },
    );
  });
});
