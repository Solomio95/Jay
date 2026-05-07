import { z } from "zod";

export const consignmentInvoicePaymentCreateSchema = z.object({
  paymentDate: z.string().optional(),
  amount: z.number().positive("Payment amount must be positive"),
  paymentMethod: z.enum(["BANK_TRANSFER", "EWALLET", "CARD", "CHEQUE", "OTHER"]),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export type ConsignmentInvoicePaymentCreateInput = z.infer<
  typeof consignmentInvoicePaymentCreateSchema
>;
