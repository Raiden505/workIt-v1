import { z } from "zod";

export const jobStatusSchema = z.enum(["open", "in_progress", "completed", "cancelled"]);

export const createJobSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters long.")
    .max(120, "Title is too long."),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters long.")
    .max(5000, "Description is too long."),
  budget: z
    .number()
    .positive("Budget must be greater than 0.")
    .max(100000000, "Budget is too large."),
  categoryId: z.number().int().positive("Category is required."),
  skillIds: z
    .array(z.number().int().positive("Invalid skill id."))
    .min(1, "Select at least one skill.")
    .max(20, "You can select up to 20 skills."),
});

export const jobsQuerySchema = z.object({
  client_id: z.coerce.number().int().positive().optional(),
  status: jobStatusSchema.optional(),
});

export const jobIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const acceptProposalParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobsQueryInput = z.infer<typeof jobsQuerySchema>;
