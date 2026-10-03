import type { FeedbackCategory } from "@prisma/client";

export const feedbackCategoryLabels: Record<FeedbackCategory, string> = {
  FEEDBACK: "Feedback",
  RECOMMENDATION: "Recommendation"
};
