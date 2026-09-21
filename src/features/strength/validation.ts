import { z } from "zod";

export const strengthSaveIntentSchema = z.enum(["continue", "end"]);

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM.")
  .or(z.literal(""));

const strengthSetSchema = z.object({
  id: z.string().trim().min(1).max(128),
  weight: z.number().finite().min(0).max(100_000).nullable(),
  reps: z.number().int().min(0).max(100_000).nullable(),
  rir: z.number().int().min(0).max(100).nullable().optional(),
  restSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  completed: z.boolean(),
  kind: z.enum(["working", "warmup", "drop", "failure"]).optional(),
  tempo: z.string().max(32).optional()
});

const strengthExerciseSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().max(200),
  notes: z.string().max(5_000).optional(),
  sets: z.array(strengthSetSchema).max(200),
  supersetGroupId: z.string().max(128).optional(),
  muscleGroup: z.string().max(100).optional()
});

export const strengthWorkoutSchema = z.object({
  id: z.string().trim().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
  startTime: timeString,
  endTime: timeString.optional(),
  name: z.string().max(200).optional(),
  notes: z.string().max(10_000).optional(),
  exercises: z.array(strengthExerciseSchema).max(100),
  createdAt: z.number(),
  updatedAt: z.number(),
  sourceTemplateId: z.string().max(128).optional(),
  status: z.enum(["in_progress", "completed"]).optional()
});

export const saveStrengthWorkoutInputSchema = z.object({
  workout: strengthWorkoutSchema,
  intent: strengthSaveIntentSchema
});

export const workoutIdSchema = z.string().trim().min(1).max(128);

export type StrengthSaveIntent = z.infer<typeof strengthSaveIntentSchema>;
