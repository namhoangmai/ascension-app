import type { FoodSource, Prisma } from "@prisma/client";

import {
  accessibleFoodWhere,
  ownedSavedMealWhere,
  privateFoodWhere
} from "@/lib/auth/access-control";

export function buildAccessibleFoodQuery(
  userId: string,
  where?: Prisma.FoodWhereInput
): Prisma.FoodWhereInput {
  return accessibleFoodWhere(userId, where);
}

export function buildPrivateFoodMutationQuery(
  userId: string,
  where?: Prisma.FoodWhereInput
): Prisma.FoodWhereInput {
  return privateFoodWhere(userId, where);
}

export function buildOwnedSavedMealQuery(
  userId: string,
  where?: Prisma.SavedMealWhereInput
): Prisma.SavedMealWhereInput {
  return ownedSavedMealWhere(userId, where);
}

export function buildFoodSourceKey(input: {
  source: FoodSource;
  ownerId?: string;
  externalId?: string;
  barcode?: string;
  slug?: string;
}) {
  if (input.source === "OPEN_FOOD_FACTS") {
    const openFoodFactsId = input.externalId ?? input.barcode;

    if (!openFoodFactsId) {
      throw new Error("OpenFoodFacts foods require an external id or barcode.");
    }

    return `off:${openFoodFactsId}`;
  }

  if (input.source === "SEEDED") {
    if (!input.slug) {
      throw new Error("Seeded foods require a stable slug.");
    }

    return `seed:food:${input.slug}`;
  }

  if (!input.ownerId || !input.slug) {
    throw new Error("Custom foods require an owner id and stable slug.");
  }

  return `user:${input.ownerId}:food:${input.slug}`;
}
