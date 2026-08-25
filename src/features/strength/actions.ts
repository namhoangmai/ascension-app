"use server";

import {
  deleteStrengthWorkout as deleteWorkout,
  saveStrengthWorkout as saveWorkout
} from "./server";
import type { StrengthWorkout } from "@/types/strength";

export async function saveStrengthWorkoutAction(workout: StrengthWorkout) {
  return saveWorkout(workout);
}

export async function deleteStrengthWorkoutAction(workoutId: string) {
  return deleteWorkout(workoutId);
}
