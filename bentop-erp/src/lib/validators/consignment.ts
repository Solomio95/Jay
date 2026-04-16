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

export const consignmentShipmentCreateSchema = z.object({
  fromLocationId: z.string().min(1, "Source location is required"),
  toLocationId: z.string().min(1, "Consignee location is required"),
  partnerName: z.string().min(1, "Partner name is required").max(200),
  partnerContact: z.string().max(200).optional(),
  commissionRate: z.number().min(0).max(100).default(0),
  notes: z.string().max(2000).optional(),
  ship: z.boolean().default(false), // if true, creates as SHIPPED (otherwise DRAFT)
  items: z.array(consignmentItemSchema).min(1, "At least one item is required"),
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

export type ConsignmentShipmentCreateInput = z.infer<typeof consignmentShipmentCreateSchema>;
export type ConsignmentRecordSalesInput = z.infer<typeof consignmentRecordSalesSchema>;
export type ConsignmentSettleInput = z.infer<typeof consignmentSettleSchema>;
