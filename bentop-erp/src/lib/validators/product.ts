import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format").optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const productCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  skuPrefix: z.string().min(1, "SKU prefix is required").max(20),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  brand: z.string().default("Bentop Collection"),
  baseCostMyr: z.number().positive("Cost must be positive"),
  baseCostUsd: z.number().positive().nullable().optional(),
  baseCostRmb: z.number().positive().nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
  material: z.string().max(200).optional(),
  careInstructions: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const productUpdateSchema = productCreateSchema.partial();

export const variantGenerateSchema = z.object({
  sizes: z.array(z.string().min(1)).min(1, "At least one size is required"),
  colors: z.array(z.object({
    name: z.string().min(1),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
  })).min(1, "At least one color is required"),
});

export const variantUpdateSchema = z.object({
  barcode: z.string().optional(),
  additionalCost: z.number().min(0).optional(),
  weightOverrideKg: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type VariantGenerateInput = z.infer<typeof variantGenerateSchema>;
