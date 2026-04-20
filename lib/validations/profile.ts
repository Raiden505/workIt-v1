import { z } from "zod";

export const profileUpdateSchema = z
  .object({
    bio: z.string().trim().max(1200, "Bio is too long.").nullable().optional(),
    avatarUrl: z
      .string()
      .trim()
      .url("Avatar URL must be a valid URL.")
      .max(500, "Avatar URL is too long.")
      .nullable()
      .optional(),
    companyName: z.string().trim().max(120, "Company name is too long.").nullable().optional(),
    hourlyRate: z
      .number()
      .nonnegative("Hourly rate must be 0 or greater.")
      .max(1000000, "Hourly rate is too large.")
      .optional(),
    portfolioUrl: z
      .string()
      .trim()
      .url("Portfolio URL must be a valid URL.")
      .max(500, "Portfolio URL is too long.")
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.bio !== undefined ||
      data.avatarUrl !== undefined ||
      data.companyName !== undefined ||
      data.hourlyRate !== undefined ||
      data.portfolioUrl !== undefined,
    {
      message: "Provide at least one field to update.",
      path: ["bio"],
    },
  );

export const userIdParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
