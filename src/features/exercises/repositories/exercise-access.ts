import type { Prisma } from "@prisma/client";

import { accessibleExerciseWhere, privateExerciseWhere } from "@/lib/auth/access-control";

export function buildAccessibleExerciseQuery(
  userId: string,
  where?: Prisma.ExerciseWhereInput
): Prisma.ExerciseWhereInput {
  return accessibleExerciseWhere(userId, where);
}

export function buildPrivateExerciseMutationQuery(
  userId: string,
  where?: Prisma.ExerciseWhereInput
): Prisma.ExerciseWhereInput {
  return privateExerciseWhere(userId, where);
}

export function buildExerciseSourceKey(input: {
  ownerId?: string;
  slug: string;
  sourceKey?: string;
}) {
  if (input.sourceKey) {
    return input.sourceKey;
  }

  if (!input.ownerId) {
    return `seed:exercise:${input.slug}`;
  }

  return `user:${input.ownerId}:exercise:${input.slug}`;
}
