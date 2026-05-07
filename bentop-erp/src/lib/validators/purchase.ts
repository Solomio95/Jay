import { z } from "zod";

export const supplierCreateSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(200),
  code: z.string().max(50).optional(),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
});

export const supplierUpdateSchema = supplierCreateSchema.partial();

export const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1, "Product variant is required"),
        quantityOrdered: z.number().int().positive("Quantity must be positive"),
        costPerUnitMyr: z.number().nonnegative("Cost cannot be negative"),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1, "At least one item is required"),
});

export const purchaseOrderUpdateSchema = z.object({
  expectedDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(["DRAFT", "ORDERED", "CANCELLED"]).optional(),
});

export const purchaseReceiptCreateSchema = z.object({
  locationId: z.string().min(1, "Receiving location is required"),
  receivedAt: z.string().optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().min(1, "Purchase order item is required"),
        quantityReceived: z.number().int().positive("Quantity must be positive"),
        binLocation: z.string().max(50).optional(),
      })
    )
    .min(1, "At least one item is required"),
});

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type PurchaseOrderCreateInput = z.infer<typeof purchaseOrderCreateSchema>;
export type PurchaseReceiptCreateInput = z.infer<typeof purchaseReceiptCreateSchema>;
