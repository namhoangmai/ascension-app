import type { Prisma } from "@prisma/client";

export interface UserAccessContext {
  userId: string;
}

export function accessibleExerciseWhere(
  userId: string,
  extra?: Prisma.ExerciseWhereInput
): Prisma.ExerciseWhereInput {
  return {
    AND: [
      {
        OR: [{ ownerId: userId }, { isPublic: true }]
      },
      extra ?? {}
    ]
  };
}

export function privateExerciseWhere(
  userId: string,
  extra?: Prisma.ExerciseWhereInput
): Prisma.ExerciseWhereInput {
  return {
    AND: [{ ownerId: userId }, extra ?? {}]
  };
}

export function accessibleFoodWhere(
  userId: string,
  extra?: Prisma.FoodWhereInput
): Prisma.FoodWhereInput {
  return {
    AND: [
      {
        OR: [{ ownerId: userId }, { ownerId: null, verified: true }]
      },
      extra ?? {}
    ]
  };
}

export function privateFoodWhere(
  userId: string,
  extra?: Prisma.FoodWhereInput
): Prisma.FoodWhereInput {
  return {
    AND: [{ ownerId: userId }, extra ?? {}]
  };
}

export function ownedSavedMealWhere(
  userId: string,
  extra?: Prisma.SavedMealWhereInput
): Prisma.SavedMealWhereInput {
  return {
    AND: [{ userId }, extra ?? {}]
  };
}

export function assertOwned<T extends { userId: string } | null>(
  record: T,
  userId: string,
  message = "Record is not accessible."
): NonNullable<T> {
  if (!record || record.userId !== userId) {
    throw new Error(message);
  }

  return record;
}
