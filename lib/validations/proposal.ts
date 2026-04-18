import { z } from "zod";

export const createProposalSchema = z.object({
  jobId: z.number().int().positive(),
  bidAmount: z
    .number()
    .positive("Bid amount must be greater than 0.")
    .max(100000000, "Bid amount is too large."),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
