"use server";

import {
  cancelInProgressStrengthWorkout as cancelWorkout,
  deleteStrengthWorkout as deleteWorkout,
  saveStrengthWorkout as saveWorkout,
  type StrengthActionResult
} from "./server";
import { saveStrengthWorkoutInputSchema, workoutIdSchema } from "./validation";
import type { StrengthWorkout } from "@/types/strength";

export async function saveStrengthWorkoutAction(
  workout: StrengthWorkout,
  intent: "continue" | "end"
): Promise<StrengthActionResult> {
  const parsed = saveStrengthWorkoutInputSchema.safeParse({ workout, intent });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid workout data."
    };
  }

  return saveWorkout(parsed.data.workout as StrengthWorkout, parsed.data.intent);
}

export async function deleteStrengthWorkoutAction(
  workoutId: string
): Promise<StrengthActionResult> {
  const parsed = workoutIdSchema.safeParse(workoutId);

  if (!parsed.success) {
    return { status: "error", message: "Workout session id is required." };
  }

  return deleteWorkout(parsed.data);
}

export async function cancelInProgressStrengthWorkoutAction(
  workoutId: string
): Promise<StrengthActionResult> {
  const parsed = workoutIdSchema.safeParse(workoutId);

  if (!parsed.success) {
    return { status: "error", message: "Workout session id is required." };
  }

  return cancelWorkout(parsed.data);
}
