import { z } from "zod";

const promoterCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Customer phone is required"),
});

export const promoterSaleItemSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price cannot be negative"),
  discountAmount: z.number().nonnegative().default(0),
  promotionId: z.string().optional().nullable(),
});

export const promoterSaleSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  customer: promoterCustomerSchema.optional().nullable(),
  customerId: z.string().optional().nullable(),
  items: z.array(promoterSaleItemSchema).min(1, "At least one item is required"),
  notes: z.string().max(2000).optional(),
});

export const promoterReturnSchema = z.object({
  orderId: z.string().min(1),
  orderItemId: z.string().min(1),
  quantity: z.number().int().positive("Quantity must be positive"),
  reason: z.string().max(500).optional(),
});

export const promoterTransferRequestSchema = z.object({
  fromLocationId: z.string().min(1, "Source location is required"),
  toLocationId: z.string().min(1, "Destination location is required"),
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive("Quantity must be positive"),
  notes: z.string().max(1000).optional(),
});

export type PromoterSaleInput = z.infer<typeof promoterSaleSchema>;
export type PromoterReturnInput = z.infer<typeof promoterReturnSchema>;
export type PromoterTransferRequestInput = z.infer<typeof promoterTransferRequestSchema>;
