import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/server";

import { feedbackInputSchema } from "./validation";

export interface FeedbackActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

const MAX_FEEDBACK_PER_HOUR = 5;

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitFeedbackAction(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  // The user id always comes from the session, never a form field, so nobody can submit
  // feedback as another user.
  const user = await requireUser();

  const parsed = feedbackInputSchema.safeParse({
    category: formValue(formData, "category"),
    message: formValue(formData, "message")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  // A real per-user cap backed by the DB, not the in-memory `rate-limit.ts` limiter — that one
  // is documented as not holding across Vercel's multiple serverless instances.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.feedback.count({
    where: { userId: user.id, createdAt: { gt: oneHourAgo } }
  });

  if (recentCount >= MAX_FEEDBACK_PER_HOUR) {
    return {
      status: "error",
      message: "You've sent a few of these recently. Please try again later."
    };
  }

  await prisma.feedback.create({
    data: {
      userId: user.id,
      category: parsed.data.category,
      message: parsed.data.message
    }
  });

  return {
    status: "success",
    message: "Thanks — your message has been sent."
  };
}
