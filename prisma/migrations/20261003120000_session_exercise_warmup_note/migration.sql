-- Per-exercise free-text "Warm up" note for strength sessions. Nullable, no backfill needed.
ALTER TABLE "SessionExercise" ADD COLUMN "warmupNote" TEXT;
