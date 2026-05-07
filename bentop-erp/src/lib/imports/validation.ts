import { z } from "zod";

export type ImportType = "product-variants" | "locations" | "consignment-partners" | "opening-stock";

type ImportValidationError = {
  rowNumber: number;
  messages: string[];
};

const schemas: Record<ImportType, z.ZodTypeAny> = {
  "product-variants": z.object({
    productName: z.string().trim().min(1),
    skuPrefix: z.string().trim().min(1),
    categoryName: z.string().trim().min(1),
    sku: z.string().trim().min(1),
    size: z.string().trim().min(1),
    color: z.string().trim().min(1),
    barcode: z.string().trim().optional(),
    baseCostMyr: numericString("baseCostMyr"),
    sellingPriceMyr: numericString("sellingPriceMyr"),
  }),
  locations: z.object({
    name: z.string().trim().min(1),
    type: z.enum(["WAREHOUSE", "RETAIL_STORE", "CONSIGNMENT"]),
    address: z.string().trim().optional(),
    contactPerson: z.string().trim().optional(),
    contactPhone: z.string().trim().optional(),
  }),
  "consignment-partners": z.object({
    name: z.string().trim().min(1),
    locationName: z.string().trim().optional(),
    contactPerson: z.string().trim().optional(),
    contactPhone: z.string().trim().optional(),
    contactEmail: z.string().trim().optional(),
    paymentTermsDays: integerString("paymentTermsDays").optional(),
    defaultCommissionRate: numericString("defaultCommissionRate"),
  }),
  "opening-stock": z.object({
    sku: z.string().trim().min(1),
    locationName: z.string().trim().min(1),
    quantity: integerString("quantity"),
    costPerUnitMyr: numericString("costPerUnitMyr"),
    supplierName: z.string().trim().optional(),
    binLocation: z.string().trim().optional(),
  }),
};

export function validateImportRows(type: ImportType, rows: Record<string, string>[]) {
  const schema = schemas[type];
  const errors: ImportValidationError[] = [];
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      errors.push({
        rowNumber: index + 2,
        messages: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
    }

    const key = uniqueRowKey(type, row);
    if (key) {
      const existing = seen.get(key);
      if (existing !== undefined) {
        errors.push({
          rowNumber: index + 2,
          messages: [`Duplicate ${key} already appears on row ${existing + 2}`],
        });
      } else {
        seen.set(key, index);
      }
    }
  });

  return {
    type,
    totalRows: rows.length,
    validRows: rows.length - errors.length,
    invalidRows: errors.length,
    errors,
  };
}

function uniqueRowKey(type: ImportType, row: Record<string, string>) {
  if (type === "product-variants" && row.sku) return `sku ${row.sku}`;
  if (type === "locations" && row.name) return `location ${row.name}`;
  if (type === "consignment-partners" && row.name) return `partner ${row.name}`;
  return "";
}

export function importTemplateHeaders(type: ImportType) {
  return Object.keys((schemas[type] as z.ZodObject<Record<string, z.ZodTypeAny>>).shape);
}

function numericString(fieldName: string) {
  return z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
      message: `${fieldName} must be zero or more`,
    });
}

function integerString(fieldName: string) {
  return z
    .string()
    .trim()
    .min(1, `${fieldName} is required`)
    .refine((value) => Number.isInteger(Number(value)) && Number(value) >= 0, {
      message: `${fieldName} must be a whole number`,
    });
}
