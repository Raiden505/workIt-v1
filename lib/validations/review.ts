import { z } from "zod";

export const createReviewSchema = z.object({
  contractId: z.coerce.number().int().positive(),
  revieweeId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5.").max(5, "Rating must be between 1 and 5."),
  comment: z
    .string()
    .trim()
    .max(1200, "Review comment is too long.")
    .nullable()
    .optional(),
});

export const reviewsQuerySchema = z
  .object({
    reviewee_id: z.coerce.number().int().positive().optional(),
    contract_id: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => data.reviewee_id !== undefined || data.contract_id !== undefined, {
    message: "Provide reviewee_id or contract_id.",
    path: ["reviewee_id"],
  });

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
