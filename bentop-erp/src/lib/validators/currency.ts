import { z } from "zod";

export const CURRENCIES = ["MYR", "USD", "RMB"] as const;

export const exchangeRateCreateSchema = z.object({
  fromCurrency: z.enum(CURRENCIES),
  toCurrency: z.enum(CURRENCIES),
  rate: z.number().positive("Rate must be positive"),
  effectiveDate: z.string().min(1, "Effective date is required"),
  source: z.string().max(100).optional(),
}).refine((d) => d.fromCurrency !== d.toCurrency, {
  message: "From and To currency must differ",
  path: ["toCurrency"],
});

export const exchangeRateUpdateSchema = z.object({
  rate: z.number().positive("Rate must be positive").optional(),
  effectiveDate: z.string().optional(),
  source: z.string().max(100).optional(),
});

export type ExchangeRateCreateInput = z.infer<typeof exchangeRateCreateSchema>;
export type ExchangeRateUpdateInput = z.infer<typeof exchangeRateUpdateSchema>;
