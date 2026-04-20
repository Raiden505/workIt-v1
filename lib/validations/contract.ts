import { z } from "zod";

export const contractIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateContractStatusSchema = z.object({
  status: z.enum(["terminated"]),
});

export type UpdateContractStatusInput = z.infer<typeof updateContractStatusSchema>;
