import { z } from "zod";

// ─── Customer ──────────────────────────────────────────────────

export const CUSTOMER_TYPES = ["RETAIL", "WHOLESALE", "CONSIGNMENT"] as const;

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

export const customerCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  companyName: z.string().max(200).optional(),
  customerType: z.enum(CUSTOMER_TYPES).default("RETAIL"),
  taxId: z.string().max(50).optional(),
  creditLimitMyr: z.number().nonnegative().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  addresses: z.array(addressSchema).default([]),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().default(true),
});

export const customerUpdateSchema = customerCreateSchema.partial();

// ─── Sales Channel ─────────────────────────────────────────────

export const CHANNEL_TYPES = [
  "PHYSICAL_STORE",
  "SHOPEE",
  "TIKTOK",
  "SHOPIFY",
  "WEBSITE",
  "WHOLESALE",
  "CONSIGNMENT",
] as const;

export const salesChannelCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(CHANNEL_TYPES),
  apiConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  commissionRate: z.number().min(0).max(100).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const salesChannelUpdateSchema = salesChannelCreateSchema.partial();

// ─── Order ─────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;
export const DISCOUNT_TYPES = ["FIXED", "PERCENTAGE"] as const;
export const CURRENCIES = ["MYR", "USD", "RMB"] as const;

export const orderItemSchema = z.object({
  productVariantId: z.string().min(1),
  batchId: z.string().optional().nullable(),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price cannot be negative"),
  discountAmount: z.number().nonnegative().default(0),
  notes: z.string().max(500).optional(),
});

export const orderCreateSchema = z.object({
  customerId: z.string().optional().nullable(),
  salesChannelId: z.string().optional().nullable(),
  locationId: z.string().min(1, "Fulfillment location is required"),
  currency: z.enum(CURRENCIES).default("MYR"),
  exchangeRateToMyr: z.number().positive().default(1),
  discountAmount: z.number().nonnegative().default(0),
  discountType: z.enum(DISCOUNT_TYPES).optional().nullable(),
  taxAmount: z.number().nonnegative().default(0),
  shippingAmount: z.number().nonnegative().default(0),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("UNPAID"),
  paymentMethod: z.string().max(50).optional(),
  paymentReference: z.string().max(100).optional(),
  shippingAddress: addressSchema.optional().nullable(),
  billingAddress: addressSchema.optional().nullable(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  confirm: z.boolean().default(false), // if true, creates as CONFIRMED (otherwise DRAFT)
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
});

export const orderUpdateSchema = z.object({
  customerId: z.string().optional().nullable(),
  salesChannelId: z.string().optional().nullable(),
  locationId: z.string().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountType: z.enum(DISCOUNT_TYPES).optional().nullable(),
  taxAmount: z.number().nonnegative().optional(),
  shippingAmount: z.number().nonnegative().optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.string().max(50).optional(),
  paymentReference: z.string().max(100).optional(),
  shippingAddress: addressSchema.optional().nullable(),
  billingAddress: addressSchema.optional().nullable(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  items: z.array(orderItemSchema).min(1).optional(),
});

export const orderStatusUpdateSchema = z.object({
  toStatus: z.enum(ORDER_STATUSES),
  reason: z.string().max(500).optional(),
});

export const orderPaymentSchema = z.object({
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentMethod: z.string().max(50).optional(),
  paymentReference: z.string().max(100).optional(),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type SalesChannelCreateInput = z.infer<typeof salesChannelCreateSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
