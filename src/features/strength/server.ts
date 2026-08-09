import { Prisma, SetType, SessionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import type { StrengthSet, StrengthWorkout } from "@/types/strength";

export interface StrengthActionResult {
  status: "success" | "error";
  message?: string;
  workout?: StrengthWorkout;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function timeKey(date: Date) {
  return date.toISOString().slice(11, 16);
}

function startedAtForWorkout(workout: StrengthWorkout) {
  return new Date(`${workout.date}T${workout.startTime || "00:00"}:00.000`);
}

function completedAtForWorkout(workout: StrengthWorkout) {
  if (!workout.endTime) {
    return null;
  }

  const completedAt = new Date(`${workout.date}T${workout.endTime}:00.000`);

  return Number.isNaN(completedAt.getTime()) ? null : completedAt;
}

function setTypeForStrengthSet(set: StrengthSet) {
  switch (set.kind) {
    case "warmup":
      return SetType.WARMUP;
    case "drop":
    case "failure":
      return SetType.DROP;
    default:
      return SetType.WORKING;
  }
}

function strengthSetKind(type: SetType): NonNullable<StrengthSet["kind"]> {
  switch (type) {
    case SetType.WARMUP:
      return "warmup";
    case SetType.DROP:
      return "drop";
    case SetType.BACKOFF:
      return "working";
    case SetType.WORKING:
      return "working";
    default:
      return "working";
  }
}

function toNumber(value: Prisma.Decimal | null) {
  return value?.toNumber() ?? null;
}

function slugifyName(name: string) {
  return encodeURIComponent(name.trim().toLowerCase());
}

function nullableTrimmed(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed === "" ? null : (trimmed ?? null);
}

function toStrengthWorkout(session: {
  id: string;
  name: string;
  notes: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  exercises: {
    id: string;
    exerciseNameSnapshot: string;
    note: string | null;
    restSeconds: number | null;
    supersetGroupId: string | null;
    orderIndex: number;
    sets: {
      id: string;
      type: SetType;
      orderIndex: number;
      weightKg: Prisma.Decimal | null;
      reps: number | null;
      rir: number | null;
      isCompleted: boolean;
    }[];
  }[];
}): StrengthWorkout {
  return {
    id: session.id,
    date: dateKey(session.startedAt),
    startTime: timeKey(session.startedAt),
    endTime: session.completedAt ? timeKey(session.completedAt) : "",
    name: session.name,
    notes: session.notes ?? "",
    createdAt: session.createdAt.getTime(),
    updatedAt: session.updatedAt.getTime(),
    exercises: session.exercises
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((exercise) => {
        const entry = {
          id: exercise.id,
          name: exercise.exerciseNameSnapshot,
          notes: exercise.note ?? "",
          sets: exercise.sets
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((set) => ({
              id: set.id,
              weight: toNumber(set.weightKg),
              reps: set.reps,
              rpe: set.rir,
              restSeconds: exercise.restSeconds,
              completed: set.isCompleted,
              kind: strengthSetKind(set.type)
            }))
        };

        return exercise.supersetGroupId
          ? { ...entry, supersetGroupId: exercise.supersetGroupId }
          : entry;
      })
  };
}

async function upsertPrivateExercise(tx: Prisma.TransactionClient, userId: string, name: string) {
  const trimmedName = name.trim() || "Untitled Exercise";
  const slug = slugifyName(trimmedName);
  const sourceKey = `user:${userId}:exercise:${slug}`;

  return tx.exercise.upsert({
    where: { sourceKey },
    create: {
      ownerId: userId,
      sourceKey,
      name: trimmedName,
      slug,
      primaryMuscleGroup: "FULL_BODY",
      equipment: "OTHER",
      category: "BODYWEIGHT",
      difficulty: "BEGINNER",
      isPublic: false
    },
    update: {
      name: trimmedName
    },
    select: {
      id: true,
      name: true,
      primaryMuscleGroup: true,
      equipment: true,
      category: true
    }
  });
}

export async function listStrengthWorkouts() {
  const user = await requireUser();
  const sessions = await prisma.workoutSession.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          sets: {
            orderBy: { orderIndex: "asc" }
          }
        }
      }
    }
  });

  return sessions.map(toStrengthWorkout);
}

export async function saveStrengthWorkout(workout: StrengthWorkout): Promise<StrengthActionResult> {
  "use server";

  const user = await requireUser();
  const exercises = workout.exercises.filter((exercise) => exercise.name.trim());

  if (exercises.length === 0) {
    return {
      status: "error",
      message: "Add at least one exercise before saving."
    };
  }

  try {
    const savedWorkout = await prisma.$transaction(async (tx) => {
      const existingSession = await tx.workoutSession.findUnique({
        where: { id: workout.id },
        select: { userId: true }
      });

      if (existingSession && existingSession.userId !== user.id) {
        throw new Error("UNAUTHORIZED_WORKOUT_SAVE");
      }

      const session = await tx.workoutSession.upsert({
        where: { id: workout.id },
        create: {
          id: workout.id,
          userId: user.id,
          name: nullableTrimmed(workout.name) ?? "Workout",
          notes: nullableTrimmed(workout.notes),
          status: SessionStatus.COMPLETED,
          startedAt: startedAtForWorkout(workout),
          completedAt: completedAtForWorkout(workout)
        },
        update: {
          name: nullableTrimmed(workout.name) ?? "Workout",
          notes: nullableTrimmed(workout.notes),
          status: SessionStatus.COMPLETED,
          startedAt: startedAtForWorkout(workout),
          completedAt: completedAtForWorkout(workout)
        }
      });

      await tx.sessionExercise.deleteMany({
        where: { sessionId: session.id }
      });

      for (const [exerciseIndex, exercise] of exercises.entries()) {
        const savedExercise = await upsertPrivateExercise(tx, user.id, exercise.name);
        const sessionExercise = await tx.sessionExercise.create({
          data: {
            sessionId: session.id,
            exerciseId: savedExercise.id,
            exerciseNameSnapshot: savedExercise.name,
            muscleGroupSnapshot: savedExercise.primaryMuscleGroup,
            equipmentSnapshot: savedExercise.equipment,
            categorySnapshot: savedExercise.category,
            orderIndex: exerciseIndex,
            note: nullableTrimmed(exercise.notes),
            restSeconds: exercise.sets.find((set) => set.restSeconds)?.restSeconds ?? null,
            supersetGroupId: exercise.supersetGroupId ?? null
          }
        });

        await tx.workoutSet.createMany({
          data: exercise.sets.map((set, setIndex) => ({
            id: set.id,
            sessionExerciseId: sessionExercise.id,
            type: setTypeForStrengthSet(set),
            orderIndex: setIndex,
            weightKg: set.weight === null ? null : new Prisma.Decimal(set.weight),
            reps: set.reps,
            rir: set.rpe ?? null,
            isCompleted: set.completed
          }))
        });
      }

      return tx.workoutSession.findUniqueOrThrow({
        where: { id: session.id },
        include: {
          exercises: {
            orderBy: { orderIndex: "asc" },
            include: {
              sets: {
                orderBy: { orderIndex: "asc" }
              }
            }
          }
        }
      });
    });

    revalidatePath("/strength");

    return {
      status: "success",
      workout: toStrengthWorkout(savedWorkout)
    };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED_WORKOUT_SAVE") {
      return {
        status: "error",
        message: "You can only update your own workout sessions."
      };
    }

    return {
      status: "error",
      message: "Unable to save workout right now."
    };
  }
}

export async function deleteStrengthWorkout(workoutId: string): Promise<StrengthActionResult> {
  "use server";

  const user = await requireUser();

  if (!workoutId.trim()) {
    return {
      status: "error",
      message: "Workout session id is required."
    };
  }

  try {
    const deleted = await prisma.workoutSession.deleteMany({
      where: {
        id: workoutId,
        userId: user.id
      }
    });

    if (deleted.count === 0) {
      return {
        status: "error",
        message: "Workout session was not found or does not belong to you."
      };
    }

    revalidatePath("/strength");

    return { status: "success" };
  } catch {
    return {
      status: "error",
      message: "Unable to delete workout session right now."
    };
  }
}
