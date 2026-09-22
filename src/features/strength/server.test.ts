import { SessionStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import type { StrengthWorkout } from "@/types/strength";

import {
  saveStrengthWorkoutAction,
  cancelInProgressStrengthWorkoutAction,
  deleteStrengthWorkoutAction
} from "./actions";
import {
  cancelInProgressStrengthWorkout,
  deleteStrengthWorkout,
  saveStrengthWorkout
} from "./server";
import { saveStrengthWorkoutInputSchema, strengthSaveIntentSchema } from "./validation";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    workoutSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    sessionExercise: { deleteMany: vi.fn(), create: vi.fn() },
    workoutSet: { createMany: vi.fn() },
    exercise: { upsert: vi.fn() }
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback: (t: typeof tx) => unknown) => callback(tx)),
      workoutSession: { findUnique: vi.fn(), deleteMany: vi.fn() }
    },
    requireUser: vi.fn(),
    revalidatePath: vi.fn()
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { tx } = mocks;
const USER = { id: "user-1" };

function workout(overrides: Partial<StrengthWorkout> = {}): StrengthWorkout {
  return {
    id: "w1",
    date: "2026-04-01",
    startTime: "10:00",
    endTime: "11:00",
    name: "Push",
    exercises: [
      {
        id: "e1",
        name: "Bench Press",
        sets: [{ id: "s1", weight: 60, reps: 8, completed: true }]
      }
    ],
    createdAt: 1,
    updatedAt: 2,
    ...overrides
  };
}

function sessionRow(status: SessionStatus) {
  return {
    id: "w1",
    name: "Push",
    notes: null,
    status,
    startedAt: new Date("2026-04-01T10:00:00Z"),
    completedAt: status === SessionStatus.COMPLETED ? new Date("2026-04-01T11:00:00Z") : null,
    createdAt: new Date("2026-04-01T10:00:00Z"),
    updatedAt: new Date("2026-04-01T10:00:00Z"),
    exercises: []
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(USER);
  mocks.prisma.$transaction.mockImplementation((callback: (t: typeof tx) => unknown) =>
    callback(tx)
  );
  tx.workoutSession.findUnique.mockResolvedValue(null);
  tx.workoutSession.findFirst.mockResolvedValue(null);
  tx.workoutSession.upsert.mockImplementation(({ create }: { create: { id: string } }) => ({
    id: create.id
  }));
  tx.workoutSession.findUniqueOrThrow.mockImplementation(() => {
    const args = tx.workoutSession.upsert.mock.calls.at(-1)?.[0] as {
      update: { status: SessionStatus };
    };
    return sessionRow(args.update.status);
  });
  tx.exercise.upsert.mockResolvedValue({
    id: "ex1",
    name: "Bench Press",
    primaryMuscleGroup: "FULL_BODY",
    equipment: "OTHER",
    category: "BODYWEIGHT"
  });
  tx.sessionExercise.create.mockResolvedValue({ id: "se1" });
});

const upsertArgs = () =>
  tx.workoutSession.upsert.mock.calls[0]?.[0] as {
    create: { status: SessionStatus; completedAt: Date | null; userId: string };
    update: { status: SessionStatus; completedAt: Date | null };
  };

describe("saveStrengthWorkout intent mapping", () => {
  it('"continue" saves as IN_PROGRESS with no completedAt', async () => {
    const result = await saveStrengthWorkout(workout(), "continue");

    expect(result.status).toBe("success");
    expect(upsertArgs().create).toMatchObject({
      status: SessionStatus.IN_PROGRESS,
      completedAt: null,
      userId: USER.id
    });
    expect(upsertArgs().update).toMatchObject({
      status: SessionStatus.IN_PROGRESS,
      completedAt: null
    });
    expect(result.workout?.status).toBe("in_progress");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/strength");
  });

  it('"end" saves as COMPLETED with completedAt from the end time', async () => {
    const result = await saveStrengthWorkout(workout(), "end");

    expect(result.status).toBe("success");
    expect(upsertArgs().create.status).toBe(SessionStatus.COMPLETED);
    expect(upsertArgs().create.completedAt).toEqual(new Date("2026-04-01T11:00:00.000Z"));
    expect(result.workout?.status).toBe("completed");
  });

  it('"end" crossing midnight rolls completedAt to the next day', async () => {
    await saveStrengthWorkout(workout({ startTime: "23:30", endTime: "00:15" }), "end");

    expect(upsertArgs().create.completedAt).toEqual(new Date("2026-04-02T00:15:00.000Z"));
  });

  it('"end" with no exercises is rejected before touching the database', async () => {
    const result = await saveStrengthWorkout(workout({ exercises: [] }), "end");

    expect(result).toEqual({
      status: "error",
      message: "Add at least one exercise before saving."
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('"end" with only blank-named exercises is rejected', async () => {
    const result = await saveStrengthWorkout(
      workout({ exercises: [{ id: "e", name: "   ", sets: [] }] }),
      "end"
    );

    expect(result.status).toBe("error");
  });

  it('"continue" with no exercises is allowed (draft)', async () => {
    expect((await saveStrengthWorkout(workout({ exercises: [] }), "continue")).status).toBe(
      "success"
    );
  });

  it("takes a per-user advisory lock before checking for an in-progress session", async () => {
    await saveStrengthWorkout(workout(), "continue");

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.workoutSession.findFirst.mock.invocationCallOrder[0] ?? 0
    );
  });
});

describe("one in-progress workout rule", () => {
  it("rejects a NEW continue-save while another workout is in progress", async () => {
    tx.workoutSession.findFirst.mockResolvedValue({ id: "other" });

    const result = await saveStrengthWorkout(workout(), "continue");

    expect(result).toEqual({
      status: "error",
      message: "You already have a workout in progress. Resume or cancel it first.",
      inProgressWorkoutId: "other"
    });
    expect(tx.workoutSession.upsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("looks only at this user's other in-progress sessions", async () => {
    await saveStrengthWorkout(workout(), "continue");

    expect(tx.workoutSession.findFirst).toHaveBeenCalledWith({
      where: { userId: USER.id, status: SessionStatus.IN_PROGRESS, id: { not: "w1" } },
      select: { id: true }
    });
  });

  it("allows updating the SAME in-progress workout (resume/autosave)", async () => {
    tx.workoutSession.findUnique.mockResolvedValue({
      userId: USER.id,
      status: SessionStatus.IN_PROGRESS
    });
    tx.workoutSession.findFirst.mockResolvedValue({ id: "other" });

    expect((await saveStrengthWorkout(workout(), "continue")).status).toBe("success");
  });

  it('does not apply the rule to "end" (finishing is always allowed)', async () => {
    tx.workoutSession.findFirst.mockResolvedValue({ id: "other" });

    expect((await saveStrengthWorkout(workout(), "end")).status).toBe("success");
    expect(tx.workoutSession.findFirst).not.toHaveBeenCalled();
  });

  it("refuses to continue a workout that is already COMPLETED", async () => {
    tx.workoutSession.findUnique.mockResolvedValue({
      userId: USER.id,
      status: SessionStatus.COMPLETED
    });

    expect(await saveStrengthWorkout(workout(), "continue")).toEqual({
      status: "error",
      message: "This workout is already completed."
    });
  });

  it("refuses to save over another user's workout id", async () => {
    tx.workoutSession.findUnique.mockResolvedValue({
      userId: "someone-else",
      status: SessionStatus.IN_PROGRESS
    });

    for (const intent of ["continue", "end"] as const) {
      expect(await saveStrengthWorkout(workout(), intent)).toEqual({
        status: "error",
        message: "You can only update your own workout sessions."
      });
    }
    expect(tx.workoutSession.upsert).not.toHaveBeenCalled();
  });

  it("returns a generic error (no internals) for unexpected failures", async () => {
    tx.workoutSession.upsert.mockRejectedValue(new Error("connection refused at 10.0.0.5"));

    expect(await saveStrengthWorkout(workout(), "end")).toEqual({
      status: "error",
      message: "Unable to save workout right now."
    });
  });
});

describe("cancelInProgressStrengthWorkout", () => {
  const find = mocks.prisma.workoutSession.findUnique;
  const del = mocks.prisma.workoutSession.deleteMany;

  it("deletes an in-progress workout owned by the user, scoped by user and status", async () => {
    find.mockResolvedValue({ userId: USER.id, status: SessionStatus.IN_PROGRESS });

    expect(await cancelInProgressStrengthWorkout("w1")).toEqual({ status: "success" });
    expect(del).toHaveBeenCalledWith({
      where: { id: "w1", userId: USER.id, status: SessionStatus.IN_PROGRESS }
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/strength");
  });

  it("refuses a COMPLETED workout", async () => {
    find.mockResolvedValue({ userId: USER.id, status: SessionStatus.COMPLETED });

    expect(await cancelInProgressStrengthWorkout("w1")).toEqual({
      status: "error",
      message: "Only in-progress workouts can be cancelled."
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses another user's workout with the same message as a missing one (no enumeration)", async () => {
    find.mockResolvedValue({ userId: "someone-else", status: SessionStatus.IN_PROGRESS });
    const foreign = await cancelInProgressStrengthWorkout("w1");
    find.mockResolvedValue(null);
    const missing = await cancelInProgressStrengthWorkout("w1");

    expect(foreign).toEqual(missing);
    expect(foreign).toEqual({
      status: "error",
      message: "Workout session was not found or does not belong to you."
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("rejects a blank id", async () => {
    expect((await cancelInProgressStrengthWorkout("  ")).status).toBe("error");
    expect(find).not.toHaveBeenCalled();
  });

  it("reports a generic failure when the database throws", async () => {
    find.mockRejectedValue(new Error("db down"));

    expect(await cancelInProgressStrengthWorkout("w1")).toEqual({
      status: "error",
      message: "Unable to cancel workout right now."
    });
  });
});

describe("deleteStrengthWorkout", () => {
  const del = mocks.prisma.workoutSession.deleteMany;

  it("deletes only when the row belongs to the user", async () => {
    del.mockResolvedValue({ count: 1 });

    expect(await deleteStrengthWorkout("w1")).toEqual({ status: "success" });
    expect(del).toHaveBeenCalledWith({ where: { id: "w1", userId: USER.id } });
  });

  it("errors when nothing matched (missing or not owned)", async () => {
    del.mockResolvedValue({ count: 0 });

    expect((await deleteStrengthWorkout("w1")).status).toBe("error");
  });
});

describe("server actions (validation layer)", () => {
  it("rejects an unknown intent without calling the server layer", async () => {
    const result = await saveStrengthWorkoutAction(workout(), "abandon" as never);

    expect(result.status).toBe("error");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("maps intent through the action to the persisted status", async () => {
    await saveStrengthWorkoutAction(workout(), "continue");
    await saveStrengthWorkoutAction(workout({ id: "w2" }), "end");

    expect(tx.workoutSession.upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { status: SessionStatus.IN_PROGRESS }
    });
    expect(tx.workoutSession.upsert.mock.calls[1]?.[0]).toMatchObject({
      create: { status: SessionStatus.COMPLETED }
    });
  });

  it("rejects a malformed workout (bad date) with the validation message", async () => {
    const result = await saveStrengthWorkoutAction(workout({ date: "01/04/2026" }), "end");

    expect(result).toEqual({ status: "error", message: "Date must be YYYY-MM-DD." });
  });

  it("rejects blank ids for delete and cancel actions", async () => {
    expect((await deleteStrengthWorkoutAction("")).status).toBe("error");
    expect((await cancelInProgressStrengthWorkoutAction("   ")).status).toBe("error");
    expect(mocks.prisma.workoutSession.deleteMany).not.toHaveBeenCalled();
  });

  it("validation schemas accept exactly continue and end", () => {
    expect(strengthSaveIntentSchema.safeParse("continue").success).toBe(true);
    expect(strengthSaveIntentSchema.safeParse("end").success).toBe(true);
    expect(strengthSaveIntentSchema.safeParse("END").success).toBe(false);
    expect(saveStrengthWorkoutInputSchema.safeParse({ workout: workout() }).success).toBe(false);
  });
});

// Keeps the imported (mocked) client referenced so a broken mock path fails loudly.
void prisma;
