"use server";

import { submitFeedbackAction as submitFeedback } from "./server";

export async function submitFeedbackAction(
  previousState: Parameters<typeof submitFeedback>[0],
  formData: FormData
) {
  return submitFeedback(previousState, formData);
}
