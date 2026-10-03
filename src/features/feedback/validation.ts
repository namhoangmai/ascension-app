import { z } from "zod";

export const feedbackInputSchema = z.object({
  category: z.enum(["FEEDBACK", "RECOMMENDATION"]),
  message: z
    .string()
    .trim()
    .min(10, "Say a bit more — at least 10 characters.")
    .max(2000, "Keep it under 2000 characters.")
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
