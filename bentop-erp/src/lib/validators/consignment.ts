import { z } from "zod";

export const CONSIGNMENT_STATUSES = [
  "DRAFT",
  "SHIPPED",
  "PARTIAL_SETTLED",
  "SETTLED",
  "CANCELLED",
] as const;

export const consignmentItemSchema = z.object({
  productVariantId: z.string().min(1),
  batchId: z.string().optional().nullable(),
  quantityShipped: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price cannot be negative"),
});

export const consignmentShipmentCreateSchema = z
  .object({
    fromLocationId: z.string().min(1, "Source location is required"),
    toLocationId: z.string().min(1, "Consignee location is required"),
    partnerId: z.string().optional().nullable(),
    partnerName: z.string().max(200).optional().nullable(),
    partnerContact: z.string().max(200).optional(),
    commissionRate: z.number().min(0).max(100).default(0),
    notes: z.string().max(2000).optional(),
    ship: z.boolean().default(false), // if true, creates as SHIPPED (otherwise DRAFT)
    items: z.array(consignmentItemSchema).min(1, "At least one item is required"),
  })
  .refine((data) => data.partnerId || (data.partnerName?.length ?? 0) > 0, {
    message: "Partner name is required",
    path: ["partnerName"],
  });

export const consignmentShipSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const consignmentSalesEntrySchema = z.object({
  itemId: z.string().min(1),
  quantitySold: z.number().int().nonnegative(),
});

export const consignmentRecordSalesSchema = z.object({
  entries: z.array(consignmentSalesEntrySchema).min(1),
  notes: z.string().max(500).optional(),
});

export const consignmentSettleSchema = z.object({
  returnUnsold: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

export const consignmentCancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const consignmentCommissionTierSchema = z.object({
  name: z.string().min(1, "Tier name is required").max(200),
  minPrice: z.number().nonnegative("Minimum price cannot be negative"),
  maxPrice: z.number().nonnegative("Maximum price cannot be negative").nullable().default(null),
  commissionRate: z.number().min(0).max(100),
  sortOrder: z.number().int().default(0),
});

export const consignmentCommissionOverrideSchema = z
  .object({
    productId: z.string().min(1).optional().nullable(),
    productVariantId: z.string().min(1).optional().nullable(),
    tierName: z.string().min(1, "Tier name is required").max(200),
    commissionRate: z.number().min(0).max(100),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.productId || data.productVariantId, {
    message: "Product or product variant is required",
    path: ["productId"],
  });

export const consignmentPartnerUpsertSchema = z.object({
  name: z.string().min(1, "Partner name is required").max(200),
  contactPerson: z.string().max(200).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable(),
  locationId: z.string().min(1).optional().nullable(),
  paymentTermsDays: z.number().int().nonnegative().optional().nullable(),
  tiers: z.array(consignmentCommissionTierSchema).min(1, "At least one tier is required"),
  overrides: z.array(consignmentCommissionOverrideSchema).default([]),
});

export const consignmentReportLineSchema = z.object({
  shipmentItemId: z.string().min(1),
  quantitySold: z.number().int().nonnegative(),
  quantityReturned: z.number().int().nonnegative(),
  actualUnitPrice: z.number().nonnegative(),
}).refine((data) => data.quantitySold > 0 || data.quantityReturned > 0, {
  message: "Sold or returned quantity is required",
  path: ["quantitySold"],
});

export const consignmentReportCreateSchema = z.object({
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  notes: z.string().max(2000).optional(),
  finalize: z.boolean().default(false),
  lines: z.array(consignmentReportLineSchema).min(1, "At least one line is required"),
});

export type ConsignmentShipmentCreateInput = z.infer<typeof consignmentShipmentCreateSchema>;
export type ConsignmentRecordSalesInput = z.infer<typeof consignmentRecordSalesSchema>;
export type ConsignmentSettleInput = z.infer<typeof consignmentSettleSchema>;
export type ConsignmentPartnerUpsertInput = z.infer<typeof consignmentPartnerUpsertSchema>;
export type ConsignmentReportCreateInput = z.infer<typeof consignmentReportCreateSchema>;
