import { z } from "zod";

export const skillIdsSchema = z.object({
  skillIds: z
    .array(z.coerce.number().int().positive("Invalid skill id."))
    .max(50, "Too many skills selected."),
});

export type SkillIdsInput = z.infer<typeof skillIdsSchema>;
