import { z } from "zod";

// ─── Location ──────────────────────────────────────────────────

export const locationCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["WAREHOUSE", "RETAIL_STORE", "CONSIGNMENT"]),
  address: z.string().max(500).optional(),
  contactPerson: z.string().max(100).optional(),
  contactPhone: z.string().max(30).optional(),
  isActive: z.boolean().default(true),
});

export const locationUpdateSchema = locationCreateSchema.partial();

// ─── Stock In (Inbound) ────────────────────────────────────────

export const stockInSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  productionDate: z.string().optional(), // ISO date; defaults to now
  supplierName: z.string().max(200).optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: z.number().int().positive("Quantity must be positive"),
        costPerUnitMyr: z.number().nonnegative("Cost cannot be negative"),
        binLocation: z.string().max(50).optional(),
      })
    )
    .min(1, "At least one item is required"),
});

// ─── Stock Out (Outbound / Manual Deduction) ───────────────────

export const STOCK_OUT_REASONS = [
  "DAMAGE",
  "LOSS",
  "EXPIRED",
  "SAMPLE",
  "INTERNAL_USE",
  "RETURN_TO_SUPPLIER",
  "OTHER",
] as const;

export const stockOutSchema = z.object({
  locationId: z.string().min(1, "Location is required"),
  reason: z.enum(STOCK_OUT_REASONS),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        batchId: z.string().optional(),
        quantity: z.number().int().positive("Quantity must be positive"),
      })
    )
    .min(1, "At least one item is required"),
});

// ─── Stock Transfer ────────────────────────────────────────────

export const transferCreateSchema = z
  .object({
    fromLocationId: z.string().min(1, "Source location is required"),
    toLocationId: z.string().min(1, "Destination location is required"),
    notes: z.string().max(1000).optional(),
    items: z
      .array(
        z.object({
          productVariantId: z.string().min(1),
          batchId: z.string().optional(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1, "At least one item is required"),
  })
  .refine((d) => d.fromLocationId !== d.toLocationId, {
    message: "Source and destination must differ",
    path: ["toLocationId"],
  });

export const transferActionSchema = z.object({
  action: z.enum(["APPROVE", "COMPLETE", "CANCEL"]),
  notes: z.string().max(1000).optional(),
});

// ─── Stock Adjustment ──────────────────────────────────────────

export const ADJUSTMENT_REASONS = [
  "CYCLE_COUNT",
  "PHYSICAL_COUNT",
  "FOUND_STOCK",
  "SYSTEM_ERROR_CORRECTION",
  "DATA_ENTRY_ERROR",
  "OTHER",
] as const;

export const stockAdjustmentSchema = z.object({
  locationId: z.string().min(1),
  reason: z.enum(ADJUSTMENT_REASONS),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        batchId: z.string().optional(),
        newQuantity: z.number().int().min(0, "Quantity cannot be negative"),
      })
    )
    .min(1, "At least one item is required"),
});

// ─── Stock Level (reorder points) ──────────────────────────────

export const reorderPointSchema = z.object({
  productVariantId: z.string().min(1),
  locationId: z.string().min(1),
  reorderPoint: z.number().int().min(0),
  reorderQuantity: z.number().int().min(0),
  binLocation: z.string().max(50).optional(),
});

export type StockInInput = z.infer<typeof stockInSchema>;
export type StockOutInput = z.infer<typeof stockOutSchema>;
export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type LocationCreateInput = z.infer<typeof locationCreateSchema>;
