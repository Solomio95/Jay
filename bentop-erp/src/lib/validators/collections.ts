import { z } from "zod";

export const COLLECTION_STATUSES = [
  "NOT_FOLLOWED_UP",
  "CONTACTED",
  "PROMISED_PAYMENT",
  "DISPUTED",
  "ESCALATED",
] as const;

export const consignmentCollectionFollowUpCreateSchema = z.object({
  collectionStatus: z.enum(COLLECTION_STATUSES),
  note: z.string().min(1, "Follow-up note is required").max(2000),
  nextFollowUpDate: z.string().optional().nullable(),
});

export type ConsignmentCollectionFollowUpCreateInput = z.infer<
  typeof consignmentCollectionFollowUpCreateSchema
>;
